import type { Pool, PoolClient, QueryResultRow } from "pg";

export type IdentityTransaction = Readonly<{
  query: <TRow extends QueryResultRow>(
    query: string,
    values?: unknown[],
  ) => Promise<Readonly<{ rows: readonly TRow[] }>>;
}>;

export type IdentityRepository = Readonly<{
  query: IdentityTransaction["query"];
  transaction: <T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ) => Promise<T>;
}>;

const transactionFromClient = (client: PoolClient): IdentityTransaction => ({
  query: async <TRow extends QueryResultRow>(
    query: string,
    values?: unknown[],
  ) => client.query<TRow>(query, values),
});

export const createIdentityRepository = (pool: Pool): IdentityRepository => ({
  query: async <TRow extends QueryResultRow>(
    query: string,
    values?: unknown[],
  ) => pool.query<TRow>(query, values),
  transaction: async <T>(
    operation: (transaction: IdentityTransaction) => Promise<T>,
  ) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const result = await operation(transactionFromClient(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
});
