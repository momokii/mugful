import { hashPassword } from "./password.js";
import { consumeRateLimitAttempt } from "./rate-limit-store.js";
import type { RateLimitPrincipalPepper } from "./rate-limit.js";
import type { IdentityMailer } from "./mailer.js";
import type { IdentityRepository, IdentityTransaction } from "./repository.js";
import {
  createOpaqueToken,
  hashOpaqueToken,
  type OpaqueToken,
  type TokenPepper,
} from "./token.js";

const tokenLifetimeMilliseconds = 1000 * 60 * 15;

type AccountRow = Readonly<{ email: string; id: string }>;
type TokenRow = Readonly<{ account_id: string }>;

export type IdentityEmailService = Readonly<{
  confirmVerification: (token: OpaqueToken) => Promise<"confirmed" | "invalid">;
  issueVerificationForAccount: (account: AccountRow) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<"accepted" | "rate-limited">;
  resendVerification: (email: string) => Promise<"accepted" | "rate-limited">;
  resetPassword: (
    input: Readonly<{ newPassword: string; token: OpaqueToken }>,
  ) => Promise<"reset" | "invalid">;
}>;

type IdentityEmailDependencies = Readonly<{
  mailer: IdentityMailer;
  publicOrigin: string;
  rateLimitPrincipalPepper: RateLimitPrincipalPepper;
  repository: IdentityRepository;
  tokenPepper: TokenPepper;
}>;

const canonicalEmail = (email: string): string => email.trim().toLowerCase();

const issueToken = async (
  transaction: IdentityTransaction,
  input: Readonly<{
    accountId: string;
    kind: "email_verification" | "password_reset";
    tokenPepper: TokenPepper;
  }>,
) => {
  const token = createOpaqueToken();
  await transaction.query(
    "DELETE FROM identity_tokens WHERE account_id = $1 AND kind = $2 AND consumed_at IS NULL",
    [input.accountId, input.kind],
  );
  await transaction.query(
    "INSERT INTO identity_tokens (account_id, kind, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [
      input.accountId,
      input.kind,
      hashOpaqueToken({ pepper: input.tokenPepper, token }),
      new Date(Date.now() + tokenLifetimeMilliseconds),
    ],
  );
  return token;
};

const deliver = async (
  mailer: IdentityMailer,
  email: Readonly<{
    kind: "email_verification" | "password_reset";
    to: string;
    token: string;
    publicOrigin: string;
  }>,
): Promise<void> => {
  const path =
    email.kind === "email_verification" ? "verify-email" : "reset-password";
  const subject =
    email.kind === "email_verification"
      ? "Verify your Mugful email"
      : "Reset your Mugful password";
  await mailer.send({
    subject,
    text: `${email.publicOrigin}/${path}#token=${email.token}`,
    to: email.to,
  });
};

const consumeToken = async (
  transaction: IdentityTransaction,
  input: Readonly<{
    kind: "email_verification" | "password_reset";
    token: OpaqueToken;
    tokenPepper: TokenPepper;
  }>,
): Promise<string | undefined> => {
  const result = await transaction.query<TokenRow>(
    `UPDATE identity_tokens SET consumed_at = NOW()
     WHERE kind = $1 AND token_hash = $2 AND consumed_at IS NULL AND expires_at > NOW()
     RETURNING account_id`,
    [
      input.kind,
      hashOpaqueToken({
        pepper: input.tokenPepper,
        token: input.token,
      }),
    ],
  );
  return result.rows[0]?.account_id;
};

export const createIdentityEmailService = (
  dependencies: IdentityEmailDependencies,
): IdentityEmailService => {
  const issue = async (
    account: AccountRow,
    kind: "email_verification" | "password_reset",
  ): Promise<void> => {
    const token = await dependencies.repository.transaction((transaction) =>
      issueToken(transaction, {
        accountId: account.id,
        kind,
        tokenPepper: dependencies.tokenPepper,
      }),
    );
    try {
      await deliver(dependencies.mailer, {
        kind,
        publicOrigin: dependencies.publicOrigin,
        to: account.email,
        token,
      });
    } catch {
      // Delivery is retried by the same generic resend/request command.
    }
  };

  return {
    confirmVerification: async (token) => {
      const allowed = await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `verification-confirm:${token}`,
      });
      if (!allowed) return "invalid";
      return dependencies.repository.transaction(async (transaction) => {
        const accountId = await consumeToken(transaction, {
          kind: "email_verification",
          token,
          tokenPepper: dependencies.tokenPepper,
        });
        if (accountId === undefined) return "invalid";
        await transaction.query(
          "UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1",
          [accountId],
        );
        return "confirmed";
      });
    },
    issueVerificationForAccount: async (account) =>
      issue(account, "email_verification"),
    requestPasswordReset: async (email) => {
      const canonical = canonicalEmail(email);
      const allowed = await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `password-reset:${canonical}`,
      });
      if (!allowed) return "rate-limited";
      const account = await dependencies.repository.query<AccountRow>(
        "SELECT id, email FROM accounts WHERE normalized_email = $1",
        [canonical],
      );
      const row = account.rows[0];
      if (row !== undefined) await issue(row, "password_reset");
      return "accepted";
    },
    resendVerification: async (email) => {
      const canonical = canonicalEmail(email);
      const allowed = await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `verification-resend:${canonical}`,
      });
      if (!allowed) return "rate-limited";
      const account = await dependencies.repository.query<AccountRow>(
        "SELECT id, email FROM accounts WHERE normalized_email = $1 AND email_verified_at IS NULL",
        [canonical],
      );
      const row = account.rows[0];
      if (row !== undefined) await issue(row, "email_verification");
      return "accepted";
    },
    resetPassword: async (input) => {
      const allowed = await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `password-reset-confirm:${input.token}`,
      });
      if (!allowed) return "invalid";
      return dependencies.repository.transaction(async (transaction) => {
        const accountId = await consumeToken(transaction, {
          kind: "password_reset",
          token: input.token,
          tokenPepper: dependencies.tokenPepper,
        });
        if (accountId === undefined) return "invalid";
        const passwordHash = await hashPassword(input.newPassword);
        await transaction.query(
          "UPDATE accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2",
          [passwordHash, accountId],
        );
        await transaction.query(
          "UPDATE sessions SET revoked_at = NOW() WHERE account_id = $1 AND revoked_at IS NULL",
          [accountId],
        );
        return "reset";
      });
    },
  };
};
