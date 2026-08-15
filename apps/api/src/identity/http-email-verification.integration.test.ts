import { describe, expect, it } from "vitest";

import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "./http-test-support.js";

describe.skipIf(!databaseTestsEnabled)(
  "identity HTTP registration email-verification policy",
  () => {
    it("bypasses verification locally without issuing mail and permits immediate login", async () => {
      // Given: local verification bypass is enabled and the mailer records deliveries
      const sends: Array<Readonly<{ to: string }>> = [];
      const mailer = {
        send: async (message: Readonly<{ to: string }>) => {
          sends.push(message);
        },
      };
      const context = createIdentityHttpTestContext(true, mailer, true);
      await resetIdentityData(context.pool);
      const csrf = await csrfFor(context.app);

      // When: a valid registration is submitted
      const registered = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: true,
          displayName: "Ada",
          email: "ada@example.test",
          password: "correct horse battery staple",
          privacyAccepted: true,
          termsAccepted: true,
        },
      });
      const login = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          email: "ada@example.test",
          password: "correct horse battery staple",
        },
      });

      // Then: the account is verified atomically, no mail is sent, and login succeeds
      expect(registered.statusCode).toBe(202);
      expect(
        (await context.pool.query("SELECT email_verified_at FROM accounts"))
          .rows[0]?.email_verified_at,
      ).not.toBeNull();
      expect(sends).toHaveLength(0);
      expect(login.statusCode).toBe(200);
      await context.app.close();
      await context.pool.end();
    });

    it("keeps normal registration unverified, sends mail, and rejects immediate login", async () => {
      // Given: the default verification policy and a recording mailer
      const sends: Array<Readonly<{ to: string }>> = [];
      const mailer = {
        send: async (message: Readonly<{ to: string }>) => {
          sends.push(message);
        },
      };
      const context = createIdentityHttpTestContext(true, mailer, false);
      await resetIdentityData(context.pool);
      const csrf = await csrfFor(context.app);

      // When: a valid registration is submitted and login is attempted
      const registered = await context.app.inject({
        method: "POST",
        url: "/v1/auth/register",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          adultAttestation: true,
          displayName: "Ada",
          email: "ada@example.test",
          password: "correct horse battery staple",
          privacyAccepted: true,
          termsAccepted: true,
        },
      });
      const login = await context.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
        payload: {
          email: "ada@example.test",
          password: "correct horse battery staple",
        },
      });

      // Then: verification remains required and the verification mail is issued
      expect(registered.statusCode).toBe(202);
      expect(
        (await context.pool.query("SELECT email_verified_at FROM accounts"))
          .rows[0]?.email_verified_at,
      ).toBeNull();
      expect(sends).toHaveLength(1);
      expect(login.statusCode).toBe(401);
      await context.app.close();
      await context.pool.end();
    });
  },
);
