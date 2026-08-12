import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "./password.js";
import {
  cookieFromResponse,
  createIdentityHttpTestContext,
  databaseTestsEnabled,
  resetIdentityData,
} from "./http-test-support.js";

describe.skipIf(!databaseTestsEnabled)("identity privacy summary", () => {
  let context: ReturnType<typeof createIdentityHttpTestContext>;

  beforeEach(async () => {
    context = createIdentityHttpTestContext(true);
    await resetIdentityData(context.pool);
  });

  afterEach(async () => {
    await context.app.close();
    await context.pool.end();
  });

  it("returns only the authenticated account's active terms and privacy consents", async () => {
    // Given: a verified account with versioned required consents
    const password = await hashPassword("correct horse battery staple");
    const account = await context.pool.query<Readonly<{ id: string }>>(
      "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1, NOW()) RETURNING id",
      [password],
    );
    const [row] = account.rows;
    if (row === undefined) throw new Error("Expected seeded account");
    await context.pool.query(
      "INSERT INTO account_consents (account_id, kind, version) VALUES ($1, 'adult_attestation', 'adult-v1'), ($1, 'terms', 'terms-v1'), ($1, 'privacy', 'privacy-v1')",
      [row.id],
    );

    // When: the account signs in and reads its privacy summary
    const csrf = await context.app.inject({ method: "GET", url: "/v1/csrf" });
    const login = await context.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: {
        cookie: cookieFromResponse(csrf.headers["set-cookie"]),
        origin: "https://mugful.test",
        "x-csrf-token": csrf.json<Readonly<{ csrfToken: string }>>().csrfToken,
      },
      payload: {
        email: "ada@example.test",
        password: "correct horse battery staple",
      },
    });
    const response = await context.app.inject({
      method: "GET",
      url: "/v1/auth/privacy",
      headers: { cookie: cookieFromResponse(login.headers["set-cookie"]) },
    });

    // Then: it exposes only the two legal notice versions and their timestamps
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      emailVerified: true,
      consents: [
        { kind: "privacy", version: "privacy-v1" },
        { kind: "terms", version: "terms-v1" },
      ],
    });
  });

  it("requires an authenticated session", async () => {
    // Given: an identity API without a session cookie
    // When: a privacy summary is requested
    const response = await context.app.inject({
      method: "GET",
      url: "/v1/auth/privacy",
    });

    // Then: no identity data is disclosed
    expect(response.statusCode).toBe(401);
  });
});
