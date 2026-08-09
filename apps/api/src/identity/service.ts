import {
  hashPassword,
  passwordHashSchema,
  verifyPassword,
} from "./password.js";
import type { RateLimitPrincipalPepper } from "./rate-limit.js";
import { consumeRateLimitAttempt } from "./rate-limit-store.js";
import type { IdentityRepository } from "./repository.js";
import {
  createStoredSession,
  type AuthenticatedSession,
} from "./session-store.js";
import {
  hashSessionToken,
  type SessionPepper,
  type SessionToken,
} from "./session.js";

const dummyPasswordHash = passwordHashSchema.parse(
  "$argon2id$v=19$m=19456,t=2,p=1$QmFzZTY0RW5jb2RlZE5vbmNl$X5QPRks9+P3ocvcRAem5WktvO0LsQ0wTuWTTruhScxc",
);

type AccountRow = Readonly<{
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
}>;

type SessionRow = Readonly<{
  account_id: string;
  email: string;
  expires_at: Date;
  id: string;
  password_hash: string;
}>;

export type IdentityService = Readonly<{
  authenticate: (
    token: SessionToken,
  ) => Promise<AuthenticatedSession | undefined>;
  changePassword: (
    input: Readonly<{
      currentPassword: string;
      newPassword: string;
      session: AuthenticatedSession;
    }>,
  ) => Promise<AuthenticatedSession | "invalid-password">;
  login: (
    input: Readonly<{
      deviceLabel: string | undefined;
      email: string;
      password: string;
    }>,
  ) => Promise<AuthenticatedSession | "invalid-credentials" | "rate-limited">;
  register: (
    input: Readonly<{
      adultAttestation: true;
      displayName: string;
      email: string;
      password: string;
      privacyVersion: string;
      termsVersion: string;
    }>,
  ) => Promise<"accepted" | "rate-limited">;
  revokeSession: (
    input: Readonly<{
      accountId: string;
      currentSessionId: string;
      sessionId: string;
    }>,
  ) => Promise<"revoked" | "forbidden">;
  revokeSessionToken: (token: SessionToken) => Promise<void>;
  sessions: (accountId: string) => Promise<
    readonly Readonly<{
      createdAt: Date;
      deviceLabel: string | null;
      id: string;
      lastSeenAt: Date | null;
    }>[]
  >;
}>;

type ServiceDependencies = Readonly<{
  rateLimitPrincipalPepper: RateLimitPrincipalPepper;
  repository: IdentityRepository;
  sessionPepper: SessionPepper;
}>;

const canonicalEmail = (email: string): string => email.trim().toLowerCase();

export const createIdentityService = (
  dependencies: ServiceDependencies,
): IdentityService => ({
  authenticate: async (token) => {
    const result = await dependencies.repository.query<SessionRow>(
      `SELECT sessions.id, sessions.account_id, sessions.expires_at, accounts.email, accounts.password_hash
       FROM sessions JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = $1 AND sessions.revoked_at IS NULL AND sessions.expires_at > NOW()`,
      [hashSessionToken({ pepper: dependencies.sessionPepper, token })],
    );
    const [session] = result.rows;
    if (session === undefined) return undefined;
    await dependencies.repository.query(
      "UPDATE sessions SET last_seen_at = NOW() WHERE id = $1",
      [session.id],
    );
    return {
      accountId: session.account_id,
      email: session.email,
      expiresAt: session.expires_at,
      sessionId: session.id,
      token,
    };
  },
  changePassword: async (input) => {
    const account = await dependencies.repository.query<AccountRow>(
      "SELECT id, email, password_hash, email_verified_at FROM accounts WHERE id = $1",
      [input.session.accountId],
    );
    const [row] = account.rows;
    if (
      row === undefined ||
      !(await verifyPassword({
        password: input.currentPassword,
        passwordHash: passwordHashSchema.parse(row.password_hash),
      }))
    )
      return "invalid-password";
    const passwordHash = await hashPassword(input.newPassword);
    return dependencies.repository.transaction(async (transaction) => {
      await transaction.query(
        "UPDATE accounts SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [passwordHash, input.session.accountId],
      );
      const freshSession = await createStoredSession(transaction, {
        accountId: input.session.accountId,
        deviceLabel: undefined,
        sessionPepper: dependencies.sessionPepper,
      });
      await transaction.query(
        "UPDATE sessions SET revoked_at = NOW(), rotated_at = NOW(), replacement_session_id = $1 WHERE account_id = $2 AND id <> $1 AND revoked_at IS NULL",
        [freshSession.sessionId, input.session.accountId],
      );
      return { ...freshSession, email: input.session.email };
    });
  },
  login: async (input) => {
    const email = canonicalEmail(input.email);
    if (
      !(await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `login:${email}`,
      }))
    )
      return "rate-limited";
    const result = await dependencies.repository.query<AccountRow>(
      "SELECT id, email, password_hash, email_verified_at FROM accounts WHERE normalized_email = $1",
      [email],
    );
    const [account] = result.rows;
    const passwordHash = account?.password_hash ?? dummyPasswordHash;
    const validPassword = await verifyPassword({
      password: input.password,
      passwordHash: passwordHashSchema.parse(passwordHash),
    });
    if (
      account === undefined ||
      account.email_verified_at === null ||
      !validPassword
    )
      return "invalid-credentials";
    const session = await dependencies.repository.transaction((transaction) =>
      createStoredSession(transaction, {
        accountId: account.id,
        deviceLabel: input.deviceLabel,
        sessionPepper: dependencies.sessionPepper,
      }),
    );
    return { ...session, email: account.email };
  },
  register: async (input) => {
    const email = canonicalEmail(input.email);
    if (
      !(await consumeRateLimitAttempt(dependencies.repository, {
        pepper: dependencies.rateLimitPrincipalPepper,
        principal: `register:${email}`,
      }))
    )
      return "rate-limited";
    const passwordHash = await hashPassword(input.password);
    try {
      await dependencies.repository.transaction(async (transaction) => {
        const account = await transaction.query<Readonly<{ id: string }>>(
          "INSERT INTO accounts (email, normalized_email, display_name, password_hash) VALUES ($1, $1, $2, $3) RETURNING id",
          [email, input.displayName, passwordHash],
        );
        const [createdAccount] = account.rows;
        if (createdAccount === undefined)
          throw new Error("Account creation failed");
        await transaction.query(
          "INSERT INTO account_consents (account_id, kind, version) VALUES ($1, 'adult_attestation', $2), ($1, 'terms', $3), ($1, 'privacy', $4)",
          [
            createdAccount.id,
            "adult-v1",
            input.termsVersion,
            input.privacyVersion,
          ],
        );
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        typeof error.code !== "string" ||
        error.code !== "23505"
      )
        throw error;
    }
    return "accepted";
  },
  revokeSession: async (input) => {
    if (input.sessionId === input.currentSessionId) return "forbidden";
    const result = await dependencies.repository.query(
      "UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL RETURNING id",
      [input.sessionId, input.accountId],
    );
    return result.rows.length === 1 ? "revoked" : "forbidden";
  },
  revokeSessionToken: async (token) => {
    await dependencies.repository.query(
      "UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1",
      [hashSessionToken({ pepper: dependencies.sessionPepper, token })],
    );
  },
  sessions: async (accountId) => {
    const result = await dependencies.repository.query<
      Readonly<{
        created_at: Date;
        device_label: string | null;
        id: string;
        last_seen_at: Date | null;
      }>
    >(
      "SELECT id, created_at, device_label, last_seen_at FROM sessions WHERE account_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC",
      [accountId],
    );
    return result.rows.map((row) => ({
      createdAt: row.created_at,
      deviceLabel: row.device_label,
      id: row.id,
      lastSeenAt: row.last_seen_at,
    }));
  },
});
