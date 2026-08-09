import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

export const opaqueTokenSchema = z.string().min(32).brand<"OpaqueToken">();
export const tokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"TokenHash">();
export const tokenPepperSchema = z.string().min(16).brand<"TokenPepper">();

export type OpaqueToken = z.infer<typeof opaqueTokenSchema>;
export type TokenHash = z.infer<typeof tokenHashSchema>;
export type TokenPepper = z.infer<typeof tokenPepperSchema>;

export const createOpaqueToken = (): OpaqueToken =>
  opaqueTokenSchema.parse(randomBytes(32).toString("base64url"));

export const hashOpaqueToken = (input: {
  readonly pepper: TokenPepper;
  readonly token: OpaqueToken;
}): TokenHash =>
  tokenHashSchema.parse(
    createHmac("sha256", input.pepper).update(input.token).digest("hex"),
  );

export type TokenUseStatus =
  | Readonly<{ kind: "usable" }>
  | Readonly<{ kind: "expired" }>
  | Readonly<{ kind: "consumed" }>;

export const evaluateTokenUse = (input: {
  readonly consumedAt?: Date;
  readonly expiresAt: Date;
  readonly now: Date;
}): TokenUseStatus => {
  if (input.consumedAt !== undefined) {
    return { kind: "consumed" };
  }

  if (input.expiresAt <= input.now) {
    return { kind: "expired" };
  }

  return { kind: "usable" };
};
