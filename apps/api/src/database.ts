import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import type { DatabaseChecker } from "./app.js";

export type DatabaseConnection = Readonly<{
  checker: DatabaseChecker;
  close: () => Promise<void>;
}>;

export const createDatabaseConnection = (
  databaseUrl: string,
): DatabaseConnection => {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 10,
  });
  pool.on("error", () => undefined);
  const database = drizzle({ client: pool });

  return {
    checker: {
      check: async () => {
        await database.execute(sql`SELECT 1`);
      },
    },
    close: async () => {
      await pool.end();
    },
  };
};
