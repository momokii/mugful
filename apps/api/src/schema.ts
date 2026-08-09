import { sql } from "drizzle-orm";
import { check, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

export const operationalBootstrap = pgTable(
  "operational_bootstrap",
  {
    id: integer().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [check("operational_bootstrap_singleton", sql`${table.id} = 1`)],
);
