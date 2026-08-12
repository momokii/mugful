import { z } from "zod";

export const requiredConsentKinds = [
  "adult_attestation",
  "terms",
  "privacy",
] as const;

export const consentKindSchema = z.enum(requiredConsentKinds);
export const currentConsentVersions = {
  adult_attestation: "adult-v1",
  privacy: "privacy-v1",
  terms: "terms-v1",
} as const;
export const consentVersionSchema = z
  .string()
  .min(1)
  .max(64)
  .brand<"ConsentVersion">();

export type ConsentKind = z.infer<typeof consentKindSchema>;
export type ConsentVersion = z.infer<typeof consentVersionSchema>;

export type VersionedConsent = Readonly<{
  grantedAt: Date;
  kind: ConsentKind;
  version: ConsentVersion;
  withdrawnAt?: Date;
}>;
