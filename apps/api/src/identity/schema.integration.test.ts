import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "identity migration schema",
  () => {
    it("persists hashes and versioned consents without secret columns", async () => {
      // Given: a manually migrated local PostgreSQL database
      const pool = new Pool({ connectionString: databaseUrl });

      // When: the identity schema is inspected through PostgreSQL metadata
      const result = await pool
        .query<{
          readonly column_name: string;
          readonly table_name: string;
        }>(
          `
          SELECT table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('accounts', 'account_consents', 'identity_tokens', 'sessions')
          ORDER BY table_name, column_name
        `,
        )
        .finally(() => pool.end());

      // Then: identity persistence contains only hash columns for credentials
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
      expect(result.rows).not.toContainEqual({
        column_name: "token",
        table_name: "identity_tokens",
      });
      expect(result.rows).not.toContainEqual({
        column_name: "token",
        table_name: "sessions",
      });
    });
  },
);
