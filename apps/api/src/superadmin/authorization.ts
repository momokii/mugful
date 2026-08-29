import { z } from "zod";

export const webauthnCredentialIdSchema = z
  .string()
  .max(512)
  .regex(/^[A-Za-z0-9_-]{16,512}$/, "Credential ID must be base64url");

export const cosePublicKeySchema = z
  .string()
  .max(512)
  .regex(/^[A-Za-z0-9_-]{32,512}$/, "Public key must be base64url COSE");

export const webauthnSignCountSchema = z
  .number()
  .int()
  .min(0)
  .max(4_294_967_295);

export const base32SecretSchema = z
  .string()
  .regex(/^[A-Z2-7]{32}$/, "TOTP secret must be 32-character RFC 4648 base32");

export const totpDigitsSchema = z.union([z.literal(6), z.literal(8)]);

export const totpPeriodSchema = z.union([z.literal(30), z.literal(60)]);

export const superadminAuditActionSchema = z.enum([
  "granted",
  "revoked",
  "passkey_registered",
  "passkey_revoked",
  "totp_enrolled",
  "totp_revoked",
  "authentication_succeeded",
  "authentication_failed",
]);

export type WebauthnCredentialId = z.infer<typeof webauthnCredentialIdSchema>;

export type CosePublicKey = z.infer<typeof cosePublicKeySchema>;

export type WebauthnSignCount = z.infer<typeof webauthnSignCountSchema>;

export type Base32Secret = z.infer<typeof base32SecretSchema>;

export type TotpDigits = z.infer<typeof totpDigitsSchema>;

export type TotpPeriod = z.infer<typeof totpPeriodSchema>;

export type SuperadminAuditAction = z.infer<typeof superadminAuditActionSchema>;
