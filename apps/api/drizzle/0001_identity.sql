CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "display_name" varchar(80) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "email_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_email_unique" UNIQUE("email")
);

CREATE TABLE "account_consents" (
  "account_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "version" varchar(64) NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "withdrawn_at" timestamp with time zone,
  CONSTRAINT "account_consents_primary_key" PRIMARY KEY("account_id", "kind", "version"),
  CONSTRAINT "account_consents_account_id_accounts_id_foreign" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade,
  CONSTRAINT "account_consents_kind_check" CHECK ("kind" IN ('adult_attestation', 'terms', 'privacy'))
);

CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "sessions_account_id_accounts_id_foreign" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade
);

CREATE TABLE "identity_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "kind" varchar(32) NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "identity_tokens_token_hash_unique" UNIQUE("token_hash"),
  CONSTRAINT "identity_tokens_account_id_accounts_id_foreign" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE cascade,
  CONSTRAINT "identity_tokens_kind_check" CHECK ("kind" IN ('email_verification', 'password_reset'))
);

CREATE INDEX "sessions_account_id_index" ON "sessions" ("account_id");
CREATE INDEX "identity_tokens_account_id_index" ON "identity_tokens" ("account_id");
