import { createHmac } from "node:crypto";
import { z } from "zod";

import {
  base32SecretSchema,
  totpDigitsSchema,
  totpPeriodSchema,
  type TotpDigits,
  type TotpPeriod,
} from "./authorization.js";

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const decodeBase32 = (secret: string): Buffer => {
  const canonical = base32SecretSchema.parse(secret);
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of canonical) {
    const index = base32Alphabet.indexOf(character);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const dynamicTruncate = (digest: Buffer): number => {
  const offset = (digest.at(digest.length - 1) ?? 0) & 0x0f;
  const read = (index: number): number => digest.at(offset + index) ?? 0;
  return (
    (((read(0) & 0x7f) << 24) |
      ((read(1) & 0xff) << 16) |
      ((read(2) & 0xff) << 8) |
      (read(3) & 0xff)) >>>
    0
  );
};

export const hotp = (
  secret: string,
  counter: number,
  digits: TotpDigits,
): string => {
  const parsedDigits = totpDigitsSchema.parse(digits);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  return String(dynamicTruncate(digest) % 10 ** parsedDigits).padStart(
    parsedDigits,
    "0",
  );
};

export const totpCodeAt = (
  input: Readonly<{
    digits: TotpDigits;
    nowMs: number;
    period: TotpPeriod;
    secret: string;
  }>,
): string => {
  const period = totpPeriodSchema.parse(input.period);
  const step = Math.floor(input.nowMs / 1000 / period);
  return hotp(input.secret, step, input.digits);
};

export type TotpVerification =
  "invalid" | "replayed" | Readonly<{ status: "valid"; step: number }>;

export const verifyTotp = (
  input: Readonly<{
    code: string;
    digits: TotpDigits;
    lastUsedStep: number;
    nowMs: number;
    period: TotpPeriod;
    secret: string;
  }>,
): TotpVerification => {
  const digits = totpDigitsSchema.parse(input.digits);
  const period = totpPeriodSchema.parse(input.period);
  const parsedCode = z
    .string()
    .regex(new RegExp(`^\\d{${digits}}$`))
    .safeParse(input.code);
  if (!parsedCode.success) return "invalid";
  const currentStep = Math.floor(input.nowMs / 1000 / period);
  for (const step of [currentStep, currentStep - 1, currentStep + 1]) {
    if (hotp(input.secret, step, digits) !== parsedCode.data) continue;
    return step > input.lastUsedStep ? { status: "valid", step } : "replayed";
  }
  return "invalid";
};
