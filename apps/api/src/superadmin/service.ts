import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { IdentityRepository } from "../identity/repository.js";
import {
  base32SecretSchema,
  cosePublicKeySchema,
  totpDigitsSchema,
  totpPeriodSchema,
  webauthnCredentialIdSchema,
  webauthnSignCountSchema,
  type SuperadminAuditAction,
  type TotpDigits,
  type TotpPeriod,
} from "./authorization.js";
import { verifyTotp } from "./totp.js";

const accountIdSchema = z.string().uuid();
const detailSchema = z.string().trim().min(1).max(500);

type GrantRow = Readonly<{ account_id: string; revoked_at: Date | null }>;
type TotpRow = Readonly<{
  digits: number;
  last_used_step: string;
  period_seconds: number;
  revoked_at: Date | null;
  secret: string;
}>;
type CredentialRow = Readonly<{ id: string }>;

type SuperadminServiceDependencies = Readonly<{
  repository: IdentityRepository;
}>;

export type SuperadminService = Readonly<{
  enrollTotpRecovery: (
    input: Readonly<{
      accountId: string;
      digits?: TotpDigits | undefined;
      period?: TotpPeriod | undefined;
      secret: string;
    }>,
  ) => Promise<"enrolled" | "not-superadmin">;
  grantSuperadmin: (
    input: Readonly<{
      accountId: string;
      actorAccountId?: string | undefined;
    }>,
  ) => Promise<"already-active" | "granted">;
  isSuperadmin: (accountId: string) => Promise<boolean>;
  registerPasskey: (
    input: Readonly<{
      accountId: string;
      credentialId: string;
      publicKey: string;
      signCount: number;
    }>,
  ) => Promise<
    | "duplicate-credential"
    | "not-superadmin"
    | Readonly<{ credentialId: string }>
  >;
  revokePasskey: (
    input: Readonly<{
      accountId: string;
      credentialId: string;
    }>,
  ) => Promise<"revoked" | "unknown-credential">;
  revokeSuperadmin: (
    input: Readonly<{
      accountId: string;
      actorAccountId?: string | undefined;
    }>,
  ) => Promise<"not-active" | "revoked">;
  verifyTotpRecovery: (
    input: Readonly<{
      accountId: string;
      code: string;
      nowMs: number;
    }>,
  ) => Promise<"invalid" | "not-enrolled" | "replayed" | "valid">;
}>;

const nullable = (value: string | undefined): string | null => value ?? null;

const recordAudit = (
  transaction: Parameters<Parameters<IdentityRepository["transaction"]>[0]>[0],
  values: {
    action: SuperadminAuditAction;
    actorAccountId?: string | undefined;
    detail?: string | undefined;
    accountId: string;
  },
): Promise<unknown> =>
  transaction.query(
    "INSERT INTO superadmin_audit_events (account_id, action, detail, changed_by_account_id) VALUES ($1, $2, $3, $4)",
    [
      values.accountId,
      values.action,
      nullable(
        values.detail === undefined
          ? undefined
          : detailSchema.parse(values.detail),
      ),
      nullable(values.actorAccountId),
    ],
  );

export const createSuperadminService = (
  dependencies: SuperadminServiceDependencies,
): SuperadminService => ({
  grantSuperadmin: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const actorAccountId =
      input.actorAccountId === undefined
        ? undefined
        : accountIdSchema.parse(input.actorAccountId);
    return dependencies.repository.transaction(async (transaction) => {
      const existing = await transaction.query<GrantRow>(
        "SELECT account_id, revoked_at FROM superadmin_accounts WHERE account_id = $1 FOR UPDATE",
        [accountId],
      );
      const grant = existing.rows[0];
      if (grant !== undefined && grant.revoked_at === null)
        return "already-active";
      if (grant === undefined) {
        await transaction.query(
          "INSERT INTO superadmin_accounts (account_id) VALUES ($1)",
          [accountId],
        );
      } else {
        await transaction.query(
          "UPDATE superadmin_accounts SET revoked_at = NULL WHERE account_id = $1",
          [accountId],
        );
      }
      await recordAudit(transaction, {
        accountId,
        actorAccountId,
        action: "granted",
      });
      return "granted";
    });
  },

  revokeSuperadmin: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const actorAccountId =
      input.actorAccountId === undefined
        ? undefined
        : accountIdSchema.parse(input.actorAccountId);
    return dependencies.repository.transaction(async (transaction) => {
      const existing = await transaction.query<GrantRow>(
        "SELECT account_id, revoked_at FROM superadmin_accounts WHERE account_id = $1 FOR UPDATE",
        [accountId],
      );
      const grant = existing.rows[0];
      if (grant === undefined || grant.revoked_at !== null) return "not-active";
      await transaction.query(
        "UPDATE superadmin_accounts SET revoked_at = NOW() WHERE account_id = $1",
        [accountId],
      );
      await recordAudit(transaction, {
        accountId,
        actorAccountId,
        action: "revoked",
      });
      return "revoked";
    });
  },

  isSuperadmin: async (rawAccountId) => {
    const accountId = accountIdSchema.parse(rawAccountId);
    const result = await dependencies.repository.query<GrantRow>(
      "SELECT account_id, revoked_at FROM superadmin_accounts WHERE account_id = $1 AND revoked_at IS NULL",
      [accountId],
    );
    return result.rows.length > 0;
  },

  registerPasskey: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const credentialId = webauthnCredentialIdSchema.parse(input.credentialId);
    const publicKey = cosePublicKeySchema.parse(input.publicKey);
    const signCount = webauthnSignCountSchema.parse(input.signCount);
    return dependencies.repository.transaction(async (transaction) => {
      const grant = await transaction.query<GrantRow>(
        "SELECT account_id, revoked_at FROM superadmin_accounts WHERE account_id = $1 AND revoked_at IS NULL FOR UPDATE",
        [accountId],
      );
      if (grant.rows.length === 0) return "not-superadmin";
      const inserted = await transaction
        .query<CredentialRow>(
          "INSERT INTO superadmin_passkey_credentials (id, account_id, credential_id, public_key, sign_count) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [randomUUID(), accountId, credentialId, publicKey, signCount],
        )
        .catch((error: unknown) => {
          if (
            error instanceof Error &&
            "code" in error &&
            typeof error.code === "string" &&
            error.code === "23505"
          )
            return undefined;
          throw error;
        });
      if (inserted === undefined) return "duplicate-credential";
      await recordAudit(transaction, {
        accountId,
        action: "passkey_registered",
        detail: `credential:${credentialId.slice(0, 16)}`,
      });
      return { credentialId };
    });
  },

  revokePasskey: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const credentialId = webauthnCredentialIdSchema.parse(input.credentialId);
    return dependencies.repository.transaction(async (transaction) => {
      const revoked = await transaction.query<CredentialRow>(
        "UPDATE superadmin_passkey_credentials SET revoked_at = NOW() WHERE account_id = $1 AND credential_id = $2 AND revoked_at IS NULL RETURNING id",
        [accountId, credentialId],
      );
      if (revoked.rows.length === 0) return "unknown-credential";
      await recordAudit(transaction, {
        accountId,
        action: "passkey_revoked",
        detail: `credential:${credentialId.slice(0, 16)}`,
      });
      return "revoked";
    });
  },

  enrollTotpRecovery: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const secret = base32SecretSchema.parse(input.secret);
    const digits = totpDigitsSchema.parse(input.digits ?? 6);
    const period = totpPeriodSchema.parse(input.period ?? 30);
    return dependencies.repository.transaction(async (transaction) => {
      const grant = await transaction.query<GrantRow>(
        "SELECT account_id, revoked_at FROM superadmin_accounts WHERE account_id = $1 AND revoked_at IS NULL FOR UPDATE",
        [accountId],
      );
      if (grant.rows.length === 0) return "not-superadmin";
      await transaction.query(
        "INSERT INTO superadmin_totp_recovery (account_id, secret, digits, period_seconds) VALUES ($1, $2, $3, $4) ON CONFLICT (account_id) DO UPDATE SET secret = $2, digits = $3, period_seconds = $4, enrolled_at = NOW(), last_used_step = 0, revoked_at = NULL",
        [accountId, secret, digits, period],
      );
      await recordAudit(transaction, {
        accountId,
        action: "totp_enrolled",
      });
      return "enrolled";
    });
  },

  verifyTotpRecovery: (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const nowMs = input.nowMs;
    return dependencies.repository.transaction(async (transaction) => {
      const recovery = await transaction.query<TotpRow>(
        "SELECT secret, digits, period_seconds, last_used_step, revoked_at FROM superadmin_totp_recovery WHERE account_id = $1 FOR UPDATE",
        [accountId],
      );
      const row = recovery.rows[0];
      if (row === undefined || row.revoked_at !== null) return "not-enrolled";
      const outcome = verifyTotp({
        code: input.code,
        digits: totpDigitsSchema.parse(row.digits),
        lastUsedStep: Number(row.last_used_step),
        nowMs,
        period: totpPeriodSchema.parse(row.period_seconds),
        secret: row.secret,
      });
      if (typeof outcome === "string") {
        await recordAudit(transaction, {
          accountId,
          actorAccountId: accountId,
          action: "authentication_failed",
          detail: outcome === "replayed" ? "totp-replay" : "totp-mismatch",
        });
        return outcome;
      }
      await transaction.query(
        "UPDATE superadmin_totp_recovery SET last_used_step = $2 WHERE account_id = $1",
        [accountId, outcome.step],
      );
      await recordAudit(transaction, {
        accountId,
        actorAccountId: accountId,
        action: "authentication_succeeded",
        detail: "totp-recovery",
      });
      return "valid";
    });
  },
});
