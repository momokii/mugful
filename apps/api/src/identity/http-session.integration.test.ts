import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "./password.js";
import {
  cookieFromResponse,
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "./http-test-support.js";

const seedVerifiedAccount = async (
  context: ReturnType<typeof createIdentityHttpTestContext>,
  input: Readonly<{ email: string; password: string }>,
): Promise<void> => {
  await context.pool.query(
    "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $1, 'Ada', $2, NOW())",
    [input.email, await hashPassword(input.password)],
  );
};

const login = async (
  context: ReturnType<typeof createIdentityHttpTestContext>,
  input: Readonly<{
    cookie: string;
    email: string;
    password: string;
    token: string;
  }>,
) => {
  const response = await context.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: unsafeHeaders({ cookie: input.cookie, csrfToken: input.token }),
    payload: { email: input.email, password: input.password },
  });
  return {
    response,
    sessionCookie: cookieFromResponse(response.headers["set-cookie"]),
  };
};

describe.skipIf(!databaseTestsEnabled)("identity HTTP sessions", () => {
  let context: ReturnType<typeof createIdentityHttpTestContext>;
  const email = "ada@example.test";
  const password = "correct horse battery staple";

  beforeEach(async () => {
    context = createIdentityHttpTestContext();
    await resetIdentityData(context.pool);
    await seedVerifiedAccount(context, { email, password });
  });

  afterEach(async () => {
    await context.app.close();
    await context.pool.end();
  });

  it("creates, exposes, and invalidates a login session through logout", async () => {
    // Given: a verified account and an issued CSRF token
    const csrf = await csrfFor(context.app);
    const loggedIn = await login(context, { ...csrf, email, password });
    const cookies = `${csrf.cookie}; ${loggedIn.sessionCookie}`;

    // When: its current session is read and then logged out
    const current = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: cookies },
    });
    const logout = await context.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: unsafeHeaders({ cookie: cookies, csrfToken: csrf.token }),
    });
    const afterLogout = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: cookies },
    });

    // Then: only the pre-logout current session is available
    expect(current.statusCode).toBe(200);
    expect(logout.statusCode).toBe(204);
    expect(afterLogout.statusCode).toBe(401);
  });

  it("rotates password credentials by invalidating every prior device session", async () => {
    // Given: two active sessions for one verified account
    const csrf = await csrfFor(context.app);
    const first = await login(context, { ...csrf, email, password });
    const second = await login(context, { ...csrf, email, password });
    const firstCookies = `${csrf.cookie}; ${first.sessionCookie}`;
    const secondCookies = `${csrf.cookie}; ${second.sessionCookie}`;

    // When: the first session changes the password
    const changed = await context.app.inject({
      method: "POST",
      url: "/v1/auth/password",
      headers: unsafeHeaders({ cookie: firstCookies, csrfToken: csrf.token }),
      payload: {
        currentPassword: password,
        newPassword: "new correct horse battery staple",
      },
    });
    const freshCookie = cookieFromResponse(changed.headers["set-cookie"]);
    const freshCurrent = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: `${csrf.cookie}; ${freshCookie}` },
    });
    const oldFirst = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: firstCookies },
    });
    const oldSecond = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: secondCookies },
    });

    // Then: the fresh replacement is valid and every old token is revoked
    expect(changed.statusCode).toBe(200);
    expect(freshCurrent.statusCode).toBe(200);
    expect(oldFirst.statusCode).toBe(401);
    expect(oldSecond.statusCode).toBe(401);
  });

  it("allows revoking an owned non-current device but denies current and foreign targets", async () => {
    // Given: two sessions for Ada and a separate foreign session
    const csrf = await csrfFor(context.app);
    const current = await login(context, { ...csrf, email, password });
    const other = await login(context, { ...csrf, email, password });
    const cookies = `${csrf.cookie}; ${current.sessionCookie}`;
    await seedVerifiedAccount(context, { email: "bea@example.test", password });
    await login(context, { ...csrf, email: "bea@example.test", password });
    const listed = await context.app.inject({
      method: "GET",
      url: "/v1/auth/sessions",
      headers: { cookie: cookies },
    });
    const sessionList = listed.json<
      Readonly<{
        sessions: readonly Readonly<{ current: boolean; id: string }>[];
      }>
    >().sessions;
    const currentId = sessionList.find((session) => session.current)?.id;
    const otherId = sessionList.find((session) => !session.current)?.id;
    const foreignSessions = await context.pool.query<Readonly<{ id: string }>>(
      "SELECT sessions.id FROM sessions JOIN accounts ON accounts.id = sessions.account_id WHERE accounts.email = 'bea@example.test'",
    );
    const foreignId = foreignSessions.rows[0]?.id;
    if (
      currentId === undefined ||
      otherId === undefined ||
      foreignId === undefined
    )
      throw new Error("Expected active test sessions");

    // When: the current user revokes the owned other, current, and foreign sessions
    const revoked = await context.app.inject({
      method: "DELETE",
      url: `/v1/auth/sessions/${otherId}`,
      headers: unsafeHeaders({ cookie: cookies, csrfToken: csrf.token }),
    });
    const currentDenied = await context.app.inject({
      method: "DELETE",
      url: `/v1/auth/sessions/${currentId}`,
      headers: unsafeHeaders({ cookie: cookies, csrfToken: csrf.token }),
    });
    const foreignDenied = await context.app.inject({
      method: "DELETE",
      url: `/v1/auth/sessions/${foreignId}`,
      headers: unsafeHeaders({ cookie: cookies, csrfToken: csrf.token }),
    });
    const revokedCurrent = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: `${csrf.cookie}; ${other.sessionCookie}` },
    });

    // Then: only the owned non-current session is revoked
    expect(revoked.statusCode).toBe(204);
    expect(currentDenied.statusCode).toBe(403);
    expect(foreignDenied.statusCode).toBe(403);
    expect(revokedCurrent.statusCode).toBe(401);
  });
});
