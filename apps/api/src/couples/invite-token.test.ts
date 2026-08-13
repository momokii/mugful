import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createInviteToken,
  hashInviteToken,
  inviteTokenPepperSchema,
} from "./invite-token.js";

describe("couple invite token", () => {
  it("creates a high-entropy token with a stable HMAC database representation", () => {
    // Given: a server-only invite token pepper
    const pepper = inviteTokenPepperSchema.parse(
      randomBytes(32).toString("base64url"),
    );

    // When: a new invite token is issued and hashed twice
    const token = createInviteToken();
    const firstHash = hashInviteToken({ pepper, token });
    const secondHash = hashInviteToken({ pepper, token });

    // Then: only a deterministic fixed-width HMAC value is suitable for storage
    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
