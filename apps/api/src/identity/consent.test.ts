import { describe, expect, it } from "vitest";

import {
  consentKindSchema,
  consentVersionSchema,
  requiredConsentKinds,
} from "./consent.js";

describe("versioned identity consent", () => {
  it("defines separate adult, terms, and privacy consent records", () => {
    // Given: the consent vocabulary required before identity onboarding
    const version = consentVersionSchema.parse("2026-08-09");

    // When: the required kinds are inspected
    const kinds = requiredConsentKinds;

    // Then: each independently versioned consent can be represented
    expect(kinds).toEqual(["adult_attestation", "terms", "privacy"]);
    expect(consentKindSchema.parse("adult_attestation")).toBe(
      "adult_attestation",
    );
    expect(version).toBe("2026-08-09");
  });
});
