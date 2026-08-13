import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

export const inviteTokenSchema = z.string().min(32).brand<"InviteToken">();
export const inviteTokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"InviteTokenHash">();
export const inviteTokenPepperSchema = z
  .string()
  .min(16)
  .brand<"InviteTokenPepper">();

export type InviteToken = z.infer<typeof inviteTokenSchema>;
export type InviteTokenHash = z.infer<typeof inviteTokenHashSchema>;
export type InviteTokenPepper = z.infer<typeof inviteTokenPepperSchema>;

export const createInviteToken = (): InviteToken =>
  inviteTokenSchema.parse(randomBytes(32).toString("base64url"));

export const hashInviteToken = (
  input: Readonly<{
    pepper: InviteTokenPepper;
    token: InviteToken;
  }>,
): InviteTokenHash =>
  inviteTokenHashSchema.parse(
    createHmac("sha256", input.pepper).update(input.token).digest("hex"),
  );
