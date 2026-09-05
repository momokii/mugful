import { describe, expect, it } from "vitest";

import { parseSessionResponse } from "./session-context.js";

describe("session context helpers", () => {
  it("parses an authenticated session body", () => {
    // Given: a documented /auth/session response body
    const body = {
      session: { email: "ari@example.com", expiresAt: "2026-09-06T00:00:00.000Z" },
    };

    // When: the body is parsed
    const session = parseSessionResponse(body);

    // Then: the session is returned with email and expiry
    expect(session).toEqual({
      email: "ari@example.com",
      expiresAt: "2026-09-06T00:00:00.000Z",
    });
  });

  it("rejects malformed or unauthorized bodies", () => {
    // Given: bodies missing the session envelope or its fields
    // When: each body is parsed
    // Then: parsing fails and yields undefined
    expect(parseSessionResponse(undefined)).toBeUndefined();
    expect(parseSessionResponse({ error: "unauthorized" })).toBeUndefined();
    expect(parseSessionResponse({ session: { email: "ari@example.com" } })).toBeUndefined();
    expect(
      parseSessionResponse({ session: { email: 42, expiresAt: "2026-09-06T00:00:00.000Z" } }),
    ).toBeUndefined();
  });
});
