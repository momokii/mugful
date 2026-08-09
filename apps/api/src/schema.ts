import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

export const accounts = pgTable(
  "accounts",
  {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 320 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("accounts_email_unique").on(table.email),
    unique("accounts_normalized_email_unique").on(table.normalizedEmail),
    check(
      "accounts_normalized_email_canonical",
      sql`${table.normalizedEmail} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const accountConsents = pgTable(
  "account_consents",
  {
    accountId: uuid("account_id").notNull(),
    kind: varchar({ length: 32 }).notNull(),
    version: varchar({ length: 64 }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({
      columns: [table.accountId, table.kind, table.version],
      name: "account_consents_primary_key",
    }),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "account_consents_account_id_accounts_id_foreign",
    }).onDelete("cascade"),
    check(
      "account_consents_kind_check",
      sql`${table.kind} IN ('adult_attestation', 'terms', 'privacy')`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deviceLabel: varchar("device_label", { length: 120 }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    replacementSessionId: uuid("replacement_session_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("sessions_token_hash_unique").on(table.tokenHash),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "sessions_account_id_accounts_id_foreign",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.replacementSessionId],
      foreignColumns: [table.id],
      name: "sessions_replacement_session_id_sessions_id_foreign",
    }).onDelete("set null"),
  ],
);

export const registrationPolicies = pgTable(
  "registration_policies",
  {
    id: integer().primaryKey(),
    state: varchar({ length: 8 }).notNull().default("disabled"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    changedByAccountId: uuid("changed_by_account_id"),
    changeReason: varchar("change_reason", { length: 500 }),
  },
  (table) => [
    check("registration_policies_singleton", sql`${table.id} = 1`),
    check(
      "registration_policies_state_check",
      sql`${table.state} IN ('disabled', 'enabled')`,
    ),
    foreignKey({
      columns: [table.changedByAccountId],
      foreignColumns: [accounts.id],
      name: "registration_policies_changed_by_account_id_accounts_id_foreign",
    }).onDelete("set null"),
  ],
);

export const registrationPolicyAuditEvents = pgTable(
  "registration_policy_audit_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    previousState: varchar("previous_state", { length: 8 }).notNull(),
    nextState: varchar("next_state", { length: 8 }).notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    changedByAccountId: uuid("changed_by_account_id"),
    reason: varchar({ length: 500 }),
  },
  (table) => [
    check(
      "registration_policy_audit_events_previous_state_check",
      sql`${table.previousState} IN ('disabled', 'enabled')`,
    ),
    check(
      "registration_policy_audit_events_next_state_check",
      sql`${table.nextState} IN ('disabled', 'enabled')`,
    ),
    foreignKey({
      columns: [table.changedByAccountId],
      foreignColumns: [accounts.id],
      name: "registration_policy_audit_events_changed_by_account_id_accounts_id_foreign",
    }).onDelete("set null"),
  ],
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  principalHash: varchar("principal_hash", { length: 64 }).primaryKey(),
  attemptCount: integer("attempt_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const identityTokens = pgTable(
  "identity_tokens",
  {
    id: uuid().defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    kind: varchar({ length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("identity_tokens_token_hash_unique").on(table.tokenHash),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: "identity_tokens_account_id_accounts_id_foreign",
    }).onDelete("cascade"),
    check(
      "identity_tokens_kind_check",
      sql`${table.kind} IN ('email_verification', 'password_reset')`,
    ),
  ],
);
