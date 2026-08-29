import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "superadmin authorization migration schema",
  () => {
    it("adds isolated superadmin credential and audit storage through the manual migration", async () => {
      // Given: a manually migrated local PostgreSQL database
      const pool = new Pool({ connectionString: databaseUrl });

      // When: the superadmin schema is inspected through PostgreSQL metadata
      const [tables, constraints, indexes] = await Promise.all([
        pool.query<{ readonly table_name: string }>(
          `SELECT DISTINCT table_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name IN (
               'superadmin_accounts',
               'superadmin_passkey_credentials',
               'superadmin_totp_recovery',
               'superadmin_audit_events'
             )
           ORDER BY table_name`,
        ),
        pool.query<{ readonly conname: string }>(
          `SELECT conname
           FROM pg_constraint
           WHERE conname IN (
             'superadmin_accounts_pkey',
             'superadmin_passkey_credentials_credential_id_check',
             'superadmin_passkey_credentials_credential_id_key',
             'superadmin_totp_recovery_secret_check',
             'superadmin_totp_recovery_digits_check',
             'superadmin_totp_recovery_period_seconds_check',
             'superadmin_audit_events_action_check'
           )`,
        ),
        pool.query<{ readonly indexname: string }>(
          `SELECT indexname
           FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname = 'superadmin_passkey_credentials_active_account_lookup'`,
        ),
      ]).finally(() => pool.end());

      // Then: credential, recovery, and audit storage exist with their guards
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        "superadmin_accounts",
        "superadmin_audit_events",
        "superadmin_passkey_credentials",
        "superadmin_totp_recovery",
      ]);
      const constraintNames = constraints.rows.map((row) => row.conname).sort();
      expect(constraintNames).toEqual([
        "superadmin_accounts_pkey",
        "superadmin_audit_events_action_check",
        "superadmin_passkey_credentials_credential_id_check",
        "superadmin_passkey_credentials_credential_id_key",
        "superadmin_totp_recovery_digits_check",
        "superadmin_totp_recovery_period_seconds_check",
        "superadmin_totp_recovery_secret_check",
      ]);
      expect(indexes.rows).toEqual([
        { indexname: "superadmin_passkey_credentials_active_account_lookup" },
      ]);
    });
  },
);
