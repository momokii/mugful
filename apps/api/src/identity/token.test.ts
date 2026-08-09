import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createOpaqueToken,
  evaluateTokenUse,
  hashOpaqueToken,
  tokenPepperSchema,
} from "./token.js";

describe("opaque token primitives", () => {
  it("creates an opaque random token and derives a stable HMAC hash", () => {
    // Given: a configured server-side token pepper
    const pepper = tokenPepperSchema.parse(
      randomBytes(32).toString("base64url"),
    );

    // When: a random token is created and hashed twice
    const token = createOpaqueToken();
    const firstHash = hashOpaqueToken({ token, pepper });
    const secondHash = hashOpaqueToken({ token, pepper });

    // Then: the database value is deterministic and fixed-length
    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports expired and consumed tokens as unusable", () => {
    // Given: a fixed instant and token records in each invalid state
    const now = new Date("2026-08-09T00:00:00.000Z");

    // When: their ability to be used is evaluated
    const expired = evaluateTokenUse({
      expiresAt: new Date("2026-08-08T23:59:59.999Z"),
      now,
    });
    const consumed = evaluateTokenUse({
      consumedAt: now,
      expiresAt: new Date("2026-08-10T00:00:00.000Z"),
      now,
    });

    // Then: neither state can be redeemed again
    expect(expired.kind).toBe("expired");
    expect(consumed.kind).toBe("consumed");
  });
});
