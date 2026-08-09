import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "identity policy migration schema",
  () => {
    it("adds policy state and opaque rate-limit buckets through the manual migration", async () => {
      // Given: a manually migrated local PostgreSQL database
      const pool = new Pool({ connectionString: databaseUrl });

      // When: the identity schema is inspected through PostgreSQL metadata
      const [result, constraints] = await Promise.all([
        pool.query<{
          readonly column_name: string;
          readonly table_name: string;
        }>(
          `
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN (
              'accounts',
              'account_consents',
              'identity_tokens',
              'registration_policies',
              'registration_policy_audit_events',
              'rate_limit_buckets',
              'sessions'
            )
          ORDER BY table_name, column_name
        `,
        ),
        pool.query<{
          readonly conname: string;
        }>(
          `
            SELECT conname
            FROM pg_constraint
            WHERE conname = 'accounts_normalized_email_canonical'
          `,
        ),
      ]).finally(() => pool.end());

      // Then: identity persistence retains hash-only secret storage and policy state
      expect(result.rows).toContainEqual({
        column_name: "password_hash",
        table_name: "accounts",
      });
      expect(result.rows).toContainEqual({
        column_name: "token_hash",
        table_name: "identity_tokens",
      });
      expect(result.rows).toContainEqual({
        column_name: "token_hash",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "version",
        table_name: "account_consents",
      });
      expect(result.rows).toContainEqual({
        column_name: "normalized_email",
        table_name: "accounts",
      });
      expect(result.rows).toContainEqual({
        column_name: "device_label",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "last_seen_at",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "rotated_at",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "replacement_session_id",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "revoked_at",
        table_name: "sessions",
      });
      expect(result.rows).toContainEqual({
        column_name: "state",
        table_name: "registration_policies",
      });
      expect(result.rows).toContainEqual({
        column_name: "previous_state",
        table_name: "registration_policy_audit_events",
      });
      expect(result.rows).toContainEqual({
        column_name: "principal_hash",
        table_name: "rate_limit_buckets",
      });
      expect(result.rows).not.toContainEqual({
        column_name: "token",
        table_name: "identity_tokens",
      });
      expect(result.rows).not.toContainEqual({
        column_name: "token",
        table_name: "sessions",
      });
      expect(result.rows).not.toContainEqual({
        column_name: "email",
        table_name: "rate_limit_buckets",
      });
      expect(result.rows).not.toContainEqual({
        column_name: "ip_address",
        table_name: "rate_limit_buckets",
      });

      expect(constraints.rows).toContainEqual({
        conname: "accounts_normalized_email_canonical",
      });
    });
  },
);
