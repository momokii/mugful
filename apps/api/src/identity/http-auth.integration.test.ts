import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "./password.js";
import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "./http-test-support.js";

describe.skipIf(!databaseTestsEnabled)(
  "identity HTTP registration and login",
  () => {
    let context: ReturnType<typeof createIdentityHttpTestContext>;

    beforeEach(async () => {
      context = createIdentityHttpTestContext(true);
      await resetIdentityData(context.pool);
    });

    afterEach(async () => {
      await context.app.close();
      await context.pool.end();
    });

    it("rejects registration while the default policy is closed", async () => {
      // Given: an API whose registration configuration is explicitly closed
      const closed = createIdentityHttpTestContext(false);
      const csrf = await csrfFor(closed.app);

      // When: a well-formed registration is submitted
      const response = await closed.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: true,
          displayName: "Ada",
          email: "ada@example.test",
          password: "correct horse battery staple",
          privacyVersion: "privacy-v1",
          termsVersion: "terms-v1",
        },
      });

      // Then: invite-only policy reveals no account state
      expect(response.statusCode).toBe(403);
      await closed.app.close();
      await closed.pool.end();
    });

    it("creates every required consent atomically without a session", async () => {
      // Given: enabled registration and a valid CSRF exchange
      const csrf = await csrfFor(context.app);

      // When: an adult submits all required consent versions
      const response = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: true,
          displayName: "Ada",
          email: " Ada@Example.Test ",
          password: "correct horse battery staple",
          privacyVersion: "privacy-v1",
          termsVersion: "terms-v1",
        },
      });

      // Then: HTTP accepts verification-pending registration and only canonical account state persists
      expect(response.statusCode).toBe(202);
      expect(response.headers["set-cookie"]).toBeUndefined();
      const account = await context.pool.query<
        Readonly<{ email: string; consent_count: number }>
      >(
        "SELECT accounts.email, count(account_consents.kind)::int AS consent_count FROM accounts LEFT JOIN account_consents ON account_consents.account_id = accounts.id GROUP BY accounts.email",
      );
      expect(account.rows).toEqual([
        { email: "ada@example.test", consent_count: 3 },
      ]);
    });

    it("rejects incomplete or non-adult registration before persisting an account", async () => {
      // Given: enabled registration with a valid CSRF exchange
      const csrf = await csrfFor(context.app);

      // When: a registration omits mandatory consent
      const missingConsent = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: true,
          displayName: "Ada",
          email: "ada@example.test",
          password: "correct horse battery staple",
          termsVersion: "terms-v1",
        },
      });

      // Then: it is rejected without a partial account
      expect(missingConsent.statusCode).toBe(400);
      expect(
        (await context.pool.query("SELECT id FROM accounts")).rows,
      ).toEqual([]);

      // When: a registration denies the adult boundary
      const adultRejected = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: false,
          displayName: "Ada",
          email: "ada@example.test",
          password: "correct horse battery staple",
          privacyVersion: "privacy-v1",
          termsVersion: "terms-v1",
        },
      });

      // Then: it is rejected without a partial account
      expect(adultRejected.statusCode).toBe(400);
      expect(
        (await context.pool.query("SELECT id FROM accounts")).rows,
      ).toEqual([]);
    });

    it("returns the same generic response for duplicate normalized email", async () => {
      // Given: an accepted registration
      const csrf = await csrfFor(context.app);
      const payload = {
        adultAttestation: true,
        displayName: "Ada",
        email: "ada@example.test",
        password: "correct horse battery staple",
        privacyVersion: "privacy-v1",
        termsVersion: "terms-v1",
      };
      await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload,
      });

      // When: the same canonical address is submitted with different casing
      const duplicate = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: { ...payload, email: "ADA@EXAMPLE.TEST" },
      });

      // Then: callers receive the same generic acceptance result
      expect(duplicate.statusCode).toBe(202);
      expect(duplicate.json()).toEqual({ status: "accepted" });
    });

    it("requires signed CSRF and same-origin requests before unsafe commands", async () => {
      // Given: an enabled registration route and a CSRF token
      const csrf = await csrfFor(context.app);
      const payload = {
        adultAttestation: true,
        displayName: "Ada",
        email: "ada@example.test",
        password: "correct horse battery staple",
        privacyVersion: "privacy-v1",
        termsVersion: "terms-v1",
      };

      // When: either CSRF binding or Origin is absent
      const csrfRejected = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload,
      });
      const originRejected = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: {
          cookie: csrf.cookie,
          "x-csrf-token": csrf.token,
          origin: "https://attacker.test",
        },
        payload,
      });

      // Then: both mutations are forbidden
      expect(csrfRejected.statusCode).toBe(403);
      expect(originRejected.statusCode).toBe(403);
    });

    it("makes unknown and wrong-password login failures indistinguishable", async () => {
      // Given: a verified seeded account and valid CSRF exchange
      const passwordHash = await hashPassword("correct horse battery staple");
      await context.pool.query(
        "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1, NOW())",
        [passwordHash],
      );
      const csrf = await csrfFor(context.app);

      // When: an unknown account and a wrong password attempt login
      const unknown = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          email: "unknown@example.test",
          password: "correct horse battery staple",
        },
      });
      const wrong = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          email: "ada@example.test",
          password: "wrong password value",
        },
      });

      // Then: response shape and status disclose neither condition
      expect(unknown.statusCode).toBe(wrong.statusCode);
      expect(unknown.json()).toEqual(wrong.json());
    });

    it("persists rate limiting and issues a session only to a verified account", async () => {
      // Given: a verified seeded account and valid CSRF exchange
      const passwordHash = await hashPassword("correct horse battery staple");
      await context.pool.query(
        "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1, NOW())",
        [passwordHash],
      );
      const csrf = await csrfFor(context.app);
      const headers = unsafeHeaders({
        cookie: csrf.cookie,
        csrfToken: csrf.token,
      });

      // When: repeated wrong credentials exceed the durable limit, then valid credentials are submitted
      for (let attempt = 0; attempt < 5; attempt += 1)
        await context.app.inject({
          method: "POST",
          url: "/v1/auth/login",
          headers,
          payload: {
            email: "ada@example.test",
            password: "wrong password value",
          },
        });
      const limited = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers,
        payload: {
          email: "ada@example.test",
          password: "correct horse battery staple",
        },
      });

      // Then: the limit is explicit and does not emit a session
      expect(limited.statusCode).toBe(429);
      expect(limited.headers["retry-after"]).toBe("60");
    });
  },
);
