import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { createIdentityRepository } from "../identity/repository.js";
import { createSuperadminService } from "./service.js";
import { hotp } from "./totp.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "superadmin lifecycle service",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository = createIdentityRepository(pool);
    const service = createSuperadminService({ repository });
    const createdAccountIds: string[] = [];

    const createAccount = async (): Promise<string> => {
      const accountId = randomUUID();
      const email = `${accountId}@superadmin.test`;
      await pool.query(
        "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [accountId, email, email, "Lifecycle", "test-only-not-a-real-hash"],
      );
      createdAccountIds.push(accountId);
      return accountId;
    };

    afterAll(async () => {
      if (createdAccountIds.length > 0) {
        await pool.query(
          "DELETE FROM superadmin_audit_events WHERE account_id = ANY($1) OR changed_by_account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_passkey_credentials WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_totp_recovery WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_accounts WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [
          createdAccountIds,
        ]);
      }
      await pool.end();
    });

    it("grants, re-grants idempotently, revokes, and re-grants the role", async () => {
      // Given: a fresh account with no superadmin grant
      const accountId = await createAccount();

      // When: the role is granted twice, revoked twice, then granted again
      const first = await service.grantSuperadmin({ accountId });
      const second = await service.grantSuperadmin({ accountId });
      const activeWhileGranted = await service.isSuperadmin(accountId);
      const revoked = await service.revokeSuperadmin({ accountId });
      const activeAfterRevoke = await service.isSuperadmin(accountId);
      const revokeAgain = await service.revokeSuperadmin({ accountId });
      const regranted = await service.grantSuperadmin({ accountId });

      // Then: each transition behaves exactly once and audits correctly
      expect(first).toBe("granted");
      expect(second).toBe("already-active");
      expect(activeWhileGranted).toBe(true);
      expect(revoked).toBe("revoked");
      expect(activeAfterRevoke).toBe(false);
      expect(revokeAgain).toBe("not-active");
      expect(regranted).toBe("granted");
      const audit = await pool.query<{ readonly action: string }>(
        "SELECT action FROM superadmin_audit_events WHERE account_id = $1 ORDER BY changed_at",
        [accountId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "granted",
        "revoked",
        "granted",
      ]);
    });

    it("requires an active grant before passkey registration and rejects duplicates", async () => {
      // Given: an account without a grant and a plausible credential
      const accountId = await createAccount();
      const credential = {
        accountId,
        credentialId: "dGVzdC1jcmVkZW50aWFsLWlk",
        publicKey:
          "pQECAyYgASFYIHK_d45nKzR2xSamplePublicKeyValueForTestIgYIiiQeVQ",
        signCount: 0,
      };

      // When: a passkey is registered before and after granting
      const beforeGrant = await service.registerPasskey(credential);
      await service.grantSuperadmin({ accountId });
      const afterGrant = await service.registerPasskey(credential);
      const duplicate = await service.registerPasskey(credential);

      // Then: only the granted account registers, and duplicates are refused
      expect(beforeGrant).toBe("not-superadmin");
      expect(afterGrant).toEqual({ credentialId: credential.credentialId });
      expect(duplicate).toBe("duplicate-credential");
      const stored = await pool.query<{
        readonly sign_count: number;
        readonly status: string;
      }>(
        "SELECT sign_count, 'active' AS status FROM superadmin_passkey_credentials WHERE account_id = $1",
        [accountId],
      );
      expect(stored.rows).toEqual([{ sign_count: 0, status: "active" }]);
    });

    it("revokes a registered passkey exactly once", async () => {
      // Given: a granted account with one registered passkey
      const accountId = await createAccount();
      await service.grantSuperadmin({ accountId });
      const credentialId = "cmV2b2tlZC1jcmVkZW50aWFsLWlkLTAx";
      await service.registerPasskey({
        accountId,
        credentialId,
        publicKey:
          "pQECAyYgASFYIHK_d45nKzR2xSamplePublicKeyValueForTestIgYIiiQeVQ",
        signCount: 5,
      });

      // When: the passkey is revoked and then revoked again
      const first = await service.revokePasskey({ accountId, credentialId });
      const second = await service.revokePasskey({ accountId, credentialId });

      // Then: only the first revocation succeeds
      expect(first).toBe("revoked");
      expect(second).toBe("unknown-credential");
      const audit = await pool.query<{ readonly action: string }>(
        "SELECT action FROM superadmin_audit_events WHERE account_id = $1 AND detail LIKE 'credential:%' ORDER BY changed_at",
        [accountId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "passkey_registered",
        "passkey_revoked",
      ]);
    });

    it("enrolls TOTP recovery and accepts a code once with replay protection", async () => {
      // Given: a granted account with enrolled RFC reference TOTP recovery
      const accountId = await createAccount();
      await service.grantSuperadmin({ accountId });
      const enrolled = await service.enrollTotpRecovery({
        accountId,
        digits: 8,
        period: 30,
        secret: rfcSecret,
      });
      expect(enrolled).toBe("enrolled");

      // When: the current step code is verified, then reused, then an in-window stale code is tried
      const nowMs = 1_111_111_109_000;
      const firstUse = await service.verifyTotpRecovery({
        accountId,
        code: "07081804",
        nowMs,
      });
      const reused = await service.verifyTotpRecovery({
        accountId,
        code: "07081804",
        nowMs,
      });
      const previousStepCode = hotp(rfcSecret, 37_037_035, 8);
      const stale = await service.verifyTotpRecovery({
        accountId,
        code: previousStepCode,
        nowMs,
      });

      // Then: the first use is valid and both reuse attempts are replays
      expect(firstUse).toBe("valid");
      expect(reused).toBe("replayed");
      expect(stale).toBe("replayed");
      const consumed = await pool.query<{ readonly last_used_step: string }>(
        "SELECT last_used_step FROM superadmin_totp_recovery WHERE account_id = $1",
        [accountId],
      );
      expect(consumed.rows[0]?.last_used_step).toBe("37037036");
    });

    it("audits failures distinctly and reports unenrolled accounts", async () => {
      // Given: a granted account with TOTP recovery and an account without any
      const accountId = await createAccount();
      await service.grantSuperadmin({ accountId });
      await service.enrollTotpRecovery({
        accountId,
        digits: 8,
        period: 30,
        secret: rfcSecret,
      });
      const unenrolledId = await createAccount();

      // When: a wrong code is submitted and an unenrolled account verifies
      const wrong = await service.verifyTotpRecovery({
        accountId,
        code: "00000000",
        nowMs: 1_111_111_109_000,
      });
      const unenrolled = await service.verifyTotpRecovery({
        accountId: unenrolledId,
        code: "07081804",
        nowMs: 1_111_111_109_000,
      });

      // Then: the mismatch is invalid with a failure audit and the other is unenrolled
      expect(wrong).toBe("invalid");
      expect(unenrolled).toBe("not-enrolled");
      const audit = await pool.query<{
        readonly action: string;
        readonly detail: string | null;
      }>(
        "SELECT action, detail FROM superadmin_audit_events WHERE account_id = $1 AND action LIKE 'authentication%'",
        [accountId],
      );
      expect(audit.rows).toEqual([
        { action: "authentication_failed", detail: "totp-mismatch" },
      ]);
    });
  },
);
