ALTER TABLE "rate_limit_buckets" ADD CONSTRAINT "rate_limit_buckets_principal_hash_check" CHECK ("principal_hash" ~ '^[a-f0-9]{64}$');
