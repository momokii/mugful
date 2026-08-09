import {
  createRateLimitBucket,
  normalizeRateLimitPrincipal,
  type RateLimitPrincipalPepper,
} from "./rate-limit.js";
import type { IdentityRepository } from "./repository.js";

const rateLimitWindowMilliseconds = 1000 * 60;
const rateLimitMaximumAttempts = 5;

export const consumeRateLimitAttempt = async (
  repository: IdentityRepository,
  input: Readonly<{ pepper: RateLimitPrincipalPepper; principal: string }>,
): Promise<boolean> => {
  const bucket = createRateLimitBucket({
    pepper: input.pepper,
    principal: normalizeRateLimitPrincipal(input.principal),
  });
  const now = new Date();
  const windowStartedAt = new Date(now.getTime() - rateLimitWindowMilliseconds);
  const result = await repository.query<Readonly<{ attempt_count: number }>>(
    `INSERT INTO rate_limit_buckets (principal_hash, attempt_count, window_started_at, updated_at)
     VALUES ($1, 1, $2, $2)
     ON CONFLICT (principal_hash) DO UPDATE SET
       attempt_count = CASE WHEN rate_limit_buckets.window_started_at <= $3 THEN 1 ELSE rate_limit_buckets.attempt_count + 1 END,
       window_started_at = CASE WHEN rate_limit_buckets.window_started_at <= $3 THEN EXCLUDED.window_started_at ELSE rate_limit_buckets.window_started_at END,
       updated_at = EXCLUDED.updated_at
     RETURNING attempt_count`,
    [bucket.principalHash, now, windowStartedAt],
  );
  const [row] = result.rows;
  return row !== undefined && row.attempt_count <= rateLimitMaximumAttempts;
};
