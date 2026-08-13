import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashPassword } from "../identity/password.js";
import {
  cookieFromResponse,
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "../identity/http-test-support.js";

const password = "correct horse battery staple";

const seedVerifiedAccount = async (
  context: ReturnType<typeof createIdentityHttpTestContext>,
  email: string,
): Promise<void> => {
  await context.pool.query(
    "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $1, $2, $3, NOW())",
    [email, email.split("@")[0], await hashPassword(password)],
  );
};

const authenticatedHeaders = async (
  context: ReturnType<typeof createIdentityHttpTestContext>,
  email: string,
) => {
  const csrf = await csrfFor(context.app);
  const login = await context.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
    payload: { email, password },
  });
  return unsafeHeaders({
    cookie: `${csrf.cookie}; ${cookieFromResponse(login.headers["set-cookie"])}`,
    csrfToken: csrf.token,
  });
};

describe.skipIf(!databaseTestsEnabled)("couple onboarding HTTP", () => {
  let context: ReturnType<typeof createIdentityHttpTestContext>;

  beforeEach(async () => {
    context = createIdentityHttpTestContext();
    await resetIdentityData(context.pool);
    await seedVerifiedAccount(context, "ada@example.test");
    await seedVerifiedAccount(context, "bea@example.test");
  });

  afterEach(async () => {
    await context.app.close();
    await context.pool.end();
  });

  it("creates, accepts once, and ends a couple space with immediate membership revocation", async () => {
    // Given: two verified accounts with separate authenticated same-origin sessions
    const ada = await authenticatedHeaders(context, "ada@example.test");
    const bea = await authenticatedHeaders(context, "bea@example.test");

    // When: Ada creates an invite, Bea accepts it, replays it, and ends the shared space
    const created = await context.app.inject({
      method: "POST",
      url: "/v1/couple-space",
      headers: ada,
    });
    const inviteUrl = created.json<Readonly<{ inviteUrl: string }>>().inviteUrl;
    const token = new URL(inviteUrl).hash.slice("#token=".length);
    const accepted = await context.app.inject({
      method: "POST",
      url: "/v1/couple-invites/accept",
      headers: bea,
      payload: { token },
    });
    const replayed = await context.app.inject({
      method: "POST",
      url: "/v1/couple-invites/accept",
      headers: bea,
      payload: { token },
    });
    const ended = await context.app.inject({
      method: "POST",
      url: "/v1/couple-space/end",
      headers: bea,
    });

    // Then: the token is fragment-only, replay fails, and both memberships lose access immediately
    expect(created.statusCode).toBe(201);
    expect(inviteUrl).toMatch(/^https:\/\/mugful\.test\/join#token=.+/);
    expect(accepted.statusCode).toBe(204);
    expect(replayed.statusCode).toBe(403);
    expect(ended.statusCode).toBe(204);
    const state = await context.pool.query<
      Readonly<{ active_memberships: string; grace_ends_at: Date | null }>
    >(
      `SELECT count(couple_memberships.account_id) FILTER (WHERE couple_memberships.revoked_at IS NULL)::text AS active_memberships,
              max(couple_spaces.deletion_grace_ends_at) AS grace_ends_at
       FROM couple_spaces LEFT JOIN couple_memberships ON couple_memberships.couple_space_id = couple_spaces.id`,
    );
    expect(state.rows).toEqual([
      { active_memberships: "0", grace_ends_at: expect.any(Date) },
    ]);
  });
});
