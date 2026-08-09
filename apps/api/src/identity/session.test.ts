import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildLocalDevelopmentSessionCookieOptions,
  buildProductionSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
  sessionPepperSchema,
} from "./session.js";

describe("session primitives", () => {
  it("returns a hashed session value and a fixed production cookie policy", () => {
    // Given: a session secret and a future expiry
    const pepper = sessionPepperSchema.parse(
      randomBytes(32).toString("base64url"),
    );
    const expiresAt = new Date("2026-08-10T00:00:00.000Z");
    const now = new Date("2026-08-09T00:00:00.000Z");

    // When: a session is represented for production persistence and the browser
    const token = createSessionToken();
    const tokenHash = hashSessionToken({ pepper, token });
    const cookie = buildProductionSessionCookieOptions({ expiresAt, now });

    // Then: the persistence value is fixed-length and the cookie is constrained
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).toEqual({
      expires: expiresAt,
      httpOnly: true,
      maxAge: 86_400,
      name: "__Host-mugful-session",
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("uses an explicit local-development HTTP cookie policy", () => {
    // Given: a local development session expiry
    const expiresAt = new Date("2026-08-10T00:00:00.000Z");
    const now = new Date("2026-08-09T00:00:00.000Z");

    // When: local development options are built
    const cookie = buildLocalDevelopmentSessionCookieOptions({
      expiresAt,
      now,
    });

    // Then: only the explicit local path uses a non-secure, non-__Host cookie
    expect(cookie).toEqual({
      expires: expiresAt,
      httpOnly: true,
      maxAge: 86_400,
      name: "mugful-session",
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("rejects a session pepper shorter than the runtime configuration minimum", () => {
    // Given: a pepper that is shorter than 32 characters
    const shortPepper = "s".repeat(31);

    // When: the session primitive parses it
    const parse = (): void => {
      sessionPepperSchema.parse(shortPepper);
    };

    // Then: the primitive enforces the same minimum as runtime configuration
    expect(parse).toThrow();
  });
});
