import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
  sessionPepperSchema,
} from "./session.js";

describe("session primitives", () => {
  it("returns a hashed session value and a secure cookie policy", () => {
    // Given: a session secret and a future expiry
    const pepper = sessionPepperSchema.parse(
      randomBytes(32).toString("base64url"),
    );
    const expiresAt = new Date("2026-08-10T00:00:00.000Z");
    const now = new Date("2026-08-09T00:00:00.000Z");

    // When: a session is represented for persistence and the browser
    const token = createSessionToken();
    const tokenHash = hashSessionToken({ pepper, token });
    const cookie = buildSessionCookieOptions({ expiresAt, now, secure: true });

    // Then: the persistence value is fixed-length and the cookie is constrained
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).toEqual({
      expires: expiresAt,
      httpOnly: true,
      maxAge: 86_400,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});
