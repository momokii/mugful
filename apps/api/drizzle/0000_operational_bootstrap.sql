CREATE TABLE "operational_bootstrap" (
  "id" integer PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "operational_bootstrap_singleton" CHECK ("operational_bootstrap"."id" = 1)
);
