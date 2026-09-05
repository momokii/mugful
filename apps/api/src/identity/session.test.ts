import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildLocalDevelopmentSessionCookieOptions,
  buildProductionSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
  sessionCookiePolicyForPublicOrigin,
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

describe("sessionCookiePolicyForPublicOrigin", () => {
  it("uses the non-secure session cookie for a plain-HTTP Tailscale origin", () => {
    // Given: the deployment origin served over plain HTTP with a port
    const origin = "http://100.124.184.116:3002";

    // When: the cookie policy is derived from the origin scheme
    const policy = sessionCookiePolicyForPublicOrigin(origin);

    // Then: the session persists without the Secure flag or __Host prefix
    expect(policy).toEqual({ name: "mugful-session", secure: false });
  });

  it("uses the non-secure session cookie for the localhost development origin", () => {
    // Given: the local development origin over plain HTTP
    const origin = "http://localhost:3000";

    // When: the cookie policy is derived from the origin scheme
    const policy = sessionCookiePolicyForPublicOrigin(origin);

    // Then: local development keeps its explicit non-secure cookie
    expect(policy).toEqual({ name: "mugful-session", secure: false });
  });

  it("uses the __Host- secure cookie for an HTTPS origin", () => {
    // Given: a production HTTPS origin without a port
    const origin = "https://mugful.local";

    // When: the cookie policy is derived from the origin scheme
    const policy = sessionCookiePolicyForPublicOrigin(origin);

    // Then: the production policy constrains the cookie to __Host- and Secure
    expect(policy).toEqual({ name: "__Host-mugful-session", secure: true });
  });

  it("uses the __Host- secure cookie for HTTPS on a non-standard port", () => {
    // Given: a production HTTPS origin with an explicit port
    const origin = "https://100.124.184.116:3002";

    // When: the cookie policy is derived from the origin scheme
    const policy = sessionCookiePolicyForPublicOrigin(origin);

    // Then: the production policy applies regardless of the port
    expect(policy).toEqual({ name: "__Host-mugful-session", secure: true });
  });

  it.each(["not-a-url", "ftp://mugful.example"])(
    "fails closed for the invalid origin %s",
    (origin) => {
      // Given: an origin that is unparseable or uses a non-web scheme

      // When: the cookie policy is derived
      const derive = (): void => {
        sessionCookiePolicyForPublicOrigin(origin);
      };

      // Then: startup refuses to pick a cookie policy
      expect(derive).toThrow();
    },
  );
});
