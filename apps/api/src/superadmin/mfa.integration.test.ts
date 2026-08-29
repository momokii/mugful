import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { createIdentityRepository } from "../identity/repository.js";
import { createSuperadminMfaService } from "./mfa.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "superadmin MFA verification service",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository = createIdentityRepository(pool);
    const mfaService = createSuperadminMfaService({
      repository,
      ttlMs: 60_000,
    });
    const cleanupAccountIds: string[] = [];

    const createAccountWithSession = async (): Promise<{
      accountId: string;
      sessionId: string;
    }> => {
      const accountId = randomUUID();
      const sessionId = randomUUID();
      const email = `${accountId}@superadmin.test`;
      await pool.query(
        "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [accountId, email, email, "Mfa", "test-only-not-a-real-hash"],
      );
      await pool.query(
        "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
        [sessionId, accountId, randomUUID().replaceAll("-", "")],
      );
      cleanupAccountIds.push(accountId);
      return { accountId, sessionId };
    };

    afterAll(async () => {
      if (cleanupAccountIds.length > 0) {
        await pool.query(
          "DELETE FROM superadmin_mfa_verifications WHERE account_id = ANY($1)",
          [cleanupAccountIds],
        );
        await pool.query("DELETE FROM sessions WHERE account_id = ANY($1)", [
          cleanupAccountIds,
        ]);
        await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [
          cleanupAccountIds,
        ]);
      }
      await pool.end();
    });

    it("verifies a session once, reports it valid within the window, and supports re-verification", async () => {
      // Given: an account with a fresh session
      const { accountId, sessionId } = await createAccountWithSession();
      const before = await mfaService.isSessionVerified({
        nowMs: 0,
        sessionId,
      });

      // When: the session completes MFA verification
      const verified = await mfaService.verifySession({
        accountId,
        method: "passkey",
        sessionId,
      });
      const withinWindow = await mfaService.isSessionVerified({
        nowMs: Date.now() + 30_000,
        sessionId,
      });

      // Then: only the post-verification state is trusted
      expect(before).toBe(false);
      expect(verified).toBe("verified");
      expect(withinWindow).toBe(true);
    });

    it("expires verifications after the configured window", async () => {
      // Given: a verified session whose window is sixty seconds
      const { accountId, sessionId } = await createAccountWithSession();
      const verifiedAt = Date.now();
      await mfaService.verifySession({
        accountId,
        method: "totp",
        sessionId,
      });

      // When: the current time is checked inside and beyond the window
      const inside = await mfaService.isSessionVerified({
        nowMs: verifiedAt + 59_000,
        sessionId,
      });
      const expired = await mfaService.isSessionVerified({
        nowMs: verifiedAt + 61_000,
        sessionId,
      });

      // Then: the verification is honored only while unexpired
      expect(inside).toBe(true);
      expect(expired).toBe(false);
    });

    it("re-verifies by extending expiry and revokes explicitly", async () => {
      // Given: a verified session
      const { accountId, sessionId } = await createAccountWithSession();
      await mfaService.verifySession({
        accountId,
        method: "passkey",
        sessionId,
      });
      const firstExpiry = await pool.query<{ readonly expires_at: string }>(
        "SELECT expires_at FROM superadmin_mfa_verifications WHERE session_id = $1",
        [sessionId],
      );

      // When: the session re-verifies through a different method, then revokes
      await new Promise((resolve) => setTimeout(resolve, 5));
      await mfaService.verifySession({
        accountId,
        method: "totp",
        sessionId,
      });
      const secondExpiry = await pool.query<{
        readonly expires_at: string;
        readonly method: string;
      }>(
        "SELECT expires_at, method FROM superadmin_mfa_verifications WHERE session_id = $1",
        [sessionId],
      );
      const stillValid = await mfaService.isSessionVerified({
        nowMs: Date.now(),
        sessionId,
      });
      const revoked = await mfaService.revokeSession({ sessionId });
      const revokedAgain = await mfaService.revokeSession({ sessionId });
      const afterRevocation = await mfaService.isSessionVerified({
        nowMs: Date.now(),
        sessionId,
      });

      // Then: re-verification extends the window, and revocation is final
      const firstExpiryRow = firstExpiry.rows[0];
      const secondExpiryRow = secondExpiry.rows[0];
      if (firstExpiryRow === undefined || secondExpiryRow === undefined)
        throw new Error("MFA verification rows were expected");
      expect(new Date(secondExpiryRow.expires_at).getTime()).toBeGreaterThan(
        new Date(firstExpiryRow.expires_at).getTime(),
      );
      expect(secondExpiryRow.method).toBe("totp");
      expect(stillValid).toBe(true);
      expect(revoked).toBe("revoked");
      expect(revokedAgain).toBe("none");
      expect(afterRevocation).toBe(false);
    });
  },
);
