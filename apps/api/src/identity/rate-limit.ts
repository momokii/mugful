import { createHmac } from "node:crypto";

import { z } from "zod";

export const normalizedRateLimitPrincipalSchema = z
  .string()
  .min(1)
  .brand<"NormalizedRateLimitPrincipal">();
export const rateLimitPrincipalHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"RateLimitPrincipalHash">();
export const rateLimitPrincipalPepperSchema = z
  .string()
  .min(32)
  .brand<"RateLimitPrincipalPepper">();

export type NormalizedRateLimitPrincipal = z.infer<
  typeof normalizedRateLimitPrincipalSchema
>;
export type RateLimitPrincipalHash = z.infer<
  typeof rateLimitPrincipalHashSchema
>;
export type RateLimitPrincipalPepper = z.infer<
  typeof rateLimitPrincipalPepperSchema
>;

export type RateLimitBucket = Readonly<{
  principalHash: RateLimitPrincipalHash;
}>;

export const normalizeRateLimitPrincipal = (
  principal: string,
): NormalizedRateLimitPrincipal =>
  normalizedRateLimitPrincipalSchema.parse(principal.trim().toLowerCase());

export const createRateLimitBucket = (input: {
  readonly pepper: RateLimitPrincipalPepper;
  readonly principal: NormalizedRateLimitPrincipal;
}): RateLimitBucket => ({
  principalHash: rateLimitPrincipalHashSchema.parse(
    createHmac("sha256", input.pepper).update(input.principal).digest("hex"),
  ),
});
