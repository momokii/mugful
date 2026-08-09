import { createHmac, randomBytes } from "node:crypto";

import { z } from "zod";

export const sessionTokenSchema = z.string().min(32).brand<"SessionToken">();
export const sessionTokenHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .brand<"SessionTokenHash">();
export const sessionPepperSchema = z.string().min(32).brand<"SessionPepper">();

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

type SessionCookieTiming = Readonly<{
  expires: Date;
  now: Date;
}>;

type SessionCookiePolicy = Readonly<{
  name: string;
  secure: boolean;
}>;

export type ProductionSessionCookieOptions = Readonly<{
  expires: Date;
  httpOnly: true;
  maxAge: number;
  name: "__Host-mugful-session";
  path: "/";
  sameSite: "lax";
  secure: true;
}>;

export type LocalDevelopmentSessionCookieOptions = Readonly<{
  expires: Date;
  httpOnly: true;
  maxAge: number;
  name: "mugful-session";
  path: "/";
  sameSite: "lax";
  secure: false;
}>;

const productionCookiePolicy = {
  name: "__Host-mugful-session",
  secure: true,
} as const;

const localDevelopmentCookiePolicy = {
  name: "mugful-session",
  secure: false,
} as const;

const buildSessionCookieOptions = <TPolicy extends SessionCookiePolicy>(
  input: SessionCookieTiming,
  policy: TPolicy,
): Readonly<{
  expires: Date;
  httpOnly: true;
  maxAge: number;
  name: TPolicy["name"];
  path: "/";
  sameSite: "lax";
  secure: TPolicy["secure"];
}> => ({
  expires: input.expires,
  httpOnly: true,
  maxAge: Math.max(
    0,
    Math.floor((input.expires.getTime() - input.now.getTime()) / 1_000),
  ),
  name: policy.name,
  path: "/",
  sameSite: "lax",
  secure: policy.secure,
});

export const buildProductionSessionCookieOptions = (
  input: Readonly<{
    expiresAt: Date;
    now: Date;
  }>,
): ProductionSessionCookieOptions =>
  buildSessionCookieOptions(
    { expires: input.expiresAt, now: input.now },
    productionCookiePolicy,
  );

export const buildLocalDevelopmentSessionCookieOptions = (
  input: Readonly<{
    expiresAt: Date;
    now: Date;
  }>,
): LocalDevelopmentSessionCookieOptions =>
  buildSessionCookieOptions(
    { expires: input.expiresAt, now: input.now },
    localDevelopmentCookiePolicy,
  );
