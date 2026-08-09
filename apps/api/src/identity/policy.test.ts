import { describe, expect, it } from "vitest";

import {
  createRateLimitBucket,
  normalizeRateLimitPrincipal,
  rateLimitPrincipalPepperSchema,
} from "./rate-limit.js";
import {
  registrationPolicyStateFromDefault,
  registrationPolicyStateSchema,
} from "./registration-policy.js";

describe("identity policy primitives", () => {
  it("represents disabled registration as the default policy state", () => {
    // Given: the configured registration default is disabled
    const registrationDefaultEnabled = false;

    // When: the persisted policy state is derived
    const state = registrationPolicyStateFromDefault(
      registrationDefaultEnabled,
    );

    // Then: the closed state is an allowed policy value
    expect(registrationPolicyStateSchema.parse(state)).toBe("disabled");
  });

  it("stores only an HMAC of a normalized rate-limit principal", () => {
    // Given: two case variants of the same email principal
    const firstPrincipal = normalizeRateLimitPrincipal("Person@Example.COM");
    const secondPrincipal = normalizeRateLimitPrincipal("person@example.com");
    const pepper = rateLimitPrincipalPepperSchema.parse("r".repeat(32));

    // When: durable bucket records are created
    const firstBucket = createRateLimitBucket({
      pepper,
      principal: firstPrincipal,
    });
    const secondBucket = createRateLimitBucket({
      pepper,
      principal: secondPrincipal,
    });

    // Then: equivalent principals share an opaque key and raw values are absent
    expect(firstBucket.principalHash).toBe(secondBucket.principalHash);
    expect(JSON.stringify(firstBucket)).not.toContain("Person@Example.COM");
    expect(JSON.stringify(firstBucket)).not.toContain("person@example.com");
  });

  it("does not retain raw IP addresses in rate-limit bucket records", () => {
    // Given: an IP-address principal and HMAC pepper
    const principal = normalizeRateLimitPrincipal("203.0.113.8");
    const pepper = rateLimitPrincipalPepperSchema.parse("r".repeat(32));

    // When: a durable bucket record is created
    const bucket = createRateLimitBucket({ pepper, principal });

    // Then: the raw address is absent from the persistence shape
    expect(JSON.stringify(bucket)).not.toContain("203.0.113.8");
  });
});
