import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

export const sessionTokenSchema = z.string().min(32).brand<"SessionToken">();
export const sessionTokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"SessionTokenHash">();
export const sessionPepperSchema = z.string().min(16).brand<"SessionPepper">();

export type SessionToken = z.infer<typeof sessionTokenSchema>;
export type SessionTokenHash = z.infer<typeof sessionTokenHashSchema>;
export type SessionPepper = z.infer<typeof sessionPepperSchema>;

export const createSessionToken = (): SessionToken =>
  sessionTokenSchema.parse(randomBytes(32).toString("base64url"));

export const hashSessionToken = (input: {
  readonly pepper: SessionPepper;
  readonly token: SessionToken;
}): SessionTokenHash =>
  sessionTokenHashSchema.parse(
    createHmac("sha256", input.pepper).update(input.token).digest("hex"),
  );

export type SessionCookieOptions = Readonly<{
  expires: Date;
  httpOnly: true;
  maxAge: number;
  path: "/";
  sameSite: "lax";
  secure: boolean;
}>;

export const buildSessionCookieOptions = (input: {
  readonly expiresAt: Date;
  readonly now: Date;
  readonly secure: boolean;
}): SessionCookieOptions => ({
  expires: input.expiresAt,
  httpOnly: true,
  maxAge: Math.max(
    0,
    Math.floor((input.expiresAt.getTime() - input.now.getTime()) / 1_000),
  ),
  path: "/",
  sameSite: "lax",
  secure: input.secure,
});
