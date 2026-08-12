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
  "identity HTTP negative security matrix",
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

    it("rejects an unverified account and CSRF tokens bound to another cookie", async () => {
      // Given: an unverified account and two independently issued CSRF exchanges
      const password = "correct horse battery staple";
      await context.pool.query(
        "INSERT INTO accounts (email, normalized_email, display_name, password_hash) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1)",
        [await hashPassword(password)],
      );
      const firstCsrf = await csrfFor(context.app);
      const secondCsrf = await csrfFor(context.app);

      // When: the account logs in and a registration mixes the two CSRF values
      const unverifiedLogin = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: unsafeHeaders({
          cookie: firstCsrf.cookie,
          csrfToken: firstCsrf.token,
        }),
        payload: { email: "ada@example.test", password },
      });
      const mixedCsrf = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({
          cookie: firstCsrf.cookie,
          csrfToken: secondCsrf.token,
        }),
        payload: {
          adultAttestation: true,
          displayName: "Bea",
          email: "bea@example.test",
          password,
          privacyAccepted: true,
          privacyVersion: "privacy-v1",
          termsAccepted: true,
          termsVersion: "terms-v1",
        },
      });

      // Then: neither response creates authenticated or account state
      expect(unverifiedLogin).toMatchObject({
        statusCode: 401,
        body: '{"error":"invalid credentials"}',
      });
      expect(unverifiedLogin.headers["set-cookie"]).toBeUndefined();
      expect(mixedCsrf).toMatchObject({
        statusCode: 403,
        body: '{"error":"forbidden"}',
      });
      const accounts = await context.pool.query(
        "SELECT email FROM accounts ORDER BY email",
      );
      expect(accounts.rows).toEqual([{ email: "ada@example.test" }]);
    });
  },
);
