import { describe, expect, it } from "vitest";

import {
  base32SecretSchema,
  cosePublicKeySchema,
  superadminAuditActionSchema,
  totpDigitsSchema,
  totpPeriodSchema,
  webauthnCredentialIdSchema,
  webauthnSignCountSchema,
} from "./authorization.js";

describe("superadmin authorization schemas", () => {
  it("accepts base64url credential IDs and rejects other encodings", () => {
    // Given: a base64url WebAuthn credential ID
    expect(webauthnCredentialIdSchema.parse("dGVzdC1jcmVkZW50aWFsLWlk")).toBe(
      "dGVzdC1jcmVkZW50aWFsLWlk",
    );

    // When: credential IDs use standard base64 padding or are too short
    // Then: they are rejected
    expect(() =>
      webauthnCredentialIdSchema.parse("dGVzdC1jcmVkZW50aWFsLWlk=="),
    ).toThrow();
    expect(() => webauthnCredentialIdSchema.parse("short$")).toThrow();
    expect(() => webauthnCredentialIdSchema.parse("a".repeat(513))).toThrow();
  });

  it("requires base64url COSE public keys of realistic length", () => {
    // Given: a plausible COSE public key payload
    const publicKey =
      "pQECAyYgASFYIHK_d45nKzR2xSamplePublicKeyValueForTestIgYIiiQeVQ";
    expect(cosePublicKeySchema.parse(publicKey)).toBe(publicKey);

    // When: the payload is empty or non-base64url
    // Then: it is rejected
    expect(() => cosePublicKeySchema.parse("")).toThrow();
    expect(() => cosePublicKeySchema.parse("short")).toThrow();
  });

  it("bounds WebAuthn signature counters to unsigned 32-bit values", () => {
    // Given: valid counters
    expect(webauthnSignCountSchema.parse(0)).toBe(0);
    expect(webauthnSignCountSchema.parse(4_294_967_295)).toBe(4_294_967_295);

    // When: counters are negative or overflow unsigned 32-bit range
    // Then: they are rejected
    expect(() => webauthnSignCountSchema.parse(-1)).toThrow();
    expect(() => webauthnSignCountSchema.parse(4_294_967_296)).toThrow();
  });

  it("accepts only RFC 4648 base32 TOTP secrets of 160-bit length", () => {
    // Given: a 32-character base32 secret (160 bits)
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    expect(base32SecretSchema.parse(secret)).toBe(secret);

    // When: secrets contain invalid base32 characters or wrong lengths
    // Then: they are rejected
    expect(() =>
      base32SecretSchema.parse("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PX1"),
    ).toThrow();
    expect(() => base32SecretSchema.parse("JBSWY3DP")).toThrow();
    expect(() => base32SecretSchema.parse(secret.toLowerCase())).toThrow();
  });

  it("restricts TOTP parameters to supported digits and periods", () => {
    // Given: supported TOTP configurations
    expect(totpDigitsSchema.parse(6)).toBe(6);
    expect(totpDigitsSchema.parse(8)).toBe(8);
    expect(totpPeriodSchema.parse(30)).toBe(30);
    expect(totpPeriodSchema.parse(60)).toBe(60);

    // When: unsupported configurations are submitted
    // Then: they are rejected
    expect(() => totpDigitsSchema.parse(7)).toThrow();
    expect(() => totpPeriodSchema.parse(15)).toThrow();
  });

  it("limits audit actions to the superadmin lifecycle", () => {
    // Given: every documented superadmin lifecycle action
    const actions = [
      "granted",
      "revoked",
      "passkey_registered",
      "passkey_revoked",
      "totp_enrolled",
      "totp_revoked",
      "authentication_succeeded",
      "authentication_failed",
    ];

    // When: each action is parsed
    // Then: all are accepted while invented actions are rejected
    for (const action of actions)
      expect(superadminAuditActionSchema.parse(action)).toBe(action);
    expect(() => superadminAuditActionSchema.parse("login")).toThrow();
  });
});
