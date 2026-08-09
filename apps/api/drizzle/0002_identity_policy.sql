ALTER TABLE "accounts" ADD COLUMN "normalized_email" varchar(320);
UPDATE "accounts" SET "normalized_email" = lower(btrim("email"));
ALTER TABLE "accounts" ALTER COLUMN "normalized_email" SET NOT NULL;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_normalized_email_unique" UNIQUE("normalized_email");
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_normalized_email_canonical" CHECK ("normalized_email" = lower(btrim("email")));

ALTER TABLE "sessions" ADD COLUMN "device_label" varchar(120);
ALTER TABLE "sessions" ADD COLUMN "last_seen_at" timestamp with time zone;
ALTER TABLE "sessions" ADD COLUMN "rotated_at" timestamp with time zone;
ALTER TABLE "sessions" ADD COLUMN "replacement_session_id" uuid;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replacement_session_id_sessions_id_foreign" FOREIGN KEY ("replacement_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;

CREATE TABLE "registration_policies" (
  "id" integer PRIMARY KEY NOT NULL,
  "state" varchar(8) DEFAULT 'disabled' NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "changed_by_account_id" uuid,
  "change_reason" varchar(500),
  CONSTRAINT "registration_policies_singleton" CHECK ("id" = 1),
  CONSTRAINT "registration_policies_state_check" CHECK ("state" IN ('disabled', 'enabled')),
  CONSTRAINT "registration_policies_changed_by_account_id_accounts_id_foreign" FOREIGN KEY ("changed_by_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL
);

INSERT INTO "registration_policies" ("id", "state") VALUES (1, 'disabled');

CREATE TABLE "registration_policy_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "previous_state" varchar(8) NOT NULL,
  "next_state" varchar(8) NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "changed_by_account_id" uuid,
  "reason" varchar(500),
  CONSTRAINT "registration_policy_audit_events_previous_state_check" CHECK ("previous_state" IN ('disabled', 'enabled')),
  CONSTRAINT "registration_policy_audit_events_next_state_check" CHECK ("next_state" IN ('disabled', 'enabled')),
  CONSTRAINT "registration_policy_audit_events_changed_by_account_id_accounts_id_foreign" FOREIGN KEY ("changed_by_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL
);

CREATE TABLE "rate_limit_buckets" (
  "principal_hash" varchar(64) PRIMARY KEY NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
