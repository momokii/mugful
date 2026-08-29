import { z } from "zod";

import type { IdentityRepository } from "../identity/repository.js";

const sessionIdSchema = z.string().uuid();
const accountIdSchema = z.string().uuid();
const mfaMethodSchema = z.enum(["passkey", "totp"]);

const defaultMfaTtlMs = 15 * 60 * 1000;

type MfaVerificationRow = Readonly<{
  session_id: string;
}>;

type SuperadminMfaDependencies = Readonly<{
  repository: IdentityRepository;
  ttlMs?: number | undefined;
}>;

export type SuperadminMfaService = Readonly<{
  isSessionVerified: (
    input: Readonly<{
      nowMs: number;
      sessionId: string;
    }>,
  ) => Promise<boolean>;
  revokeSession: (
    input: Readonly<{
      sessionId: string;
    }>,
  ) => Promise<"none" | "revoked">;
  verifySession: (
    input: Readonly<{
      accountId: string;
      method: z.infer<typeof mfaMethodSchema>;
      sessionId: string;
    }>,
  ) => Promise<"verified">;
}>;

export const createSuperadminMfaService = (
  dependencies: SuperadminMfaDependencies,
): SuperadminMfaService => {
  const ttlMs = dependencies.ttlMs ?? defaultMfaTtlMs;

  return {
    verifySession: (input) => {
      const sessionId = sessionIdSchema.parse(input.sessionId);
      const accountId = accountIdSchema.parse(input.accountId);
      const method = mfaMethodSchema.parse(input.method);
      return dependencies.repository.transaction(async (transaction) => {
        await transaction.query(
          "INSERT INTO superadmin_mfa_verifications (session_id, account_id, method, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 millisecond' * $4) ON CONFLICT (session_id) DO UPDATE SET account_id = $2, method = $3, verified_at = NOW(), expires_at = NOW() + INTERVAL '1 millisecond' * $4, revoked_at = NULL",
          [sessionId, accountId, method, ttlMs],
        );
        return "verified" as const;
      });
    },

    isSessionVerified: (input) => {
      const sessionId = sessionIdSchema.parse(input.sessionId);
      return (async () => {
        const result = await dependencies.repository.query<MfaVerificationRow>(
          "SELECT session_id FROM superadmin_mfa_verifications WHERE session_id = $1 AND revoked_at IS NULL AND expires_at > to_timestamp($2 / 1000.0)",
          [sessionId, input.nowMs],
        );
        return result.rows.length > 0;
      })();
    },

    revokeSession: (input) => {
      const sessionId = sessionIdSchema.parse(input.sessionId);
      return dependencies.repository.transaction(async (transaction) => {
        const revoked = await transaction.query<MfaVerificationRow>(
          "UPDATE superadmin_mfa_verifications SET revoked_at = NOW() WHERE session_id = $1 AND revoked_at IS NULL RETURNING session_id",
          [sessionId],
        );
        return revoked.rows.length > 0
          ? ("revoked" as const)
          : ("none" as const);
      });
    },
  };
};
