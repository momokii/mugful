import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  unsafeHeaders,
} from "../identity/http-test-support.js";
import {
  createSessionToken,
  hashSessionToken,
  sessionPepperSchema,
} from "../identity/session.js";
import { createIdentityRepository } from "../identity/repository.js";
import { createSuperadminMfaService } from "./mfa.js";
import { createSuperadminService } from "./service.js";

describe.skipIf(!databaseTestsEnabled)("superadmin HTTP surface", () => {
  const context = createIdentityHttpTestContext(false);
  const { app, pool } = context;
  const superadminService = createSuperadminService({
    repository: createIdentityRepository(pool),
  });
  const mfaService = createSuperadminMfaService({
    repository: createIdentityRepository(pool),
  });
  const createdAccountIds: string[] = [];

  const createSuperadminSession = async (grant: boolean): Promise<string> => {
    const accountId = randomUUID();
    const email = `${accountId}@superadmin.test`;
    const token = createSessionToken();
    const tokenHash = hashSessionToken({
      pepper: sessionPepperSchema.parse("s".repeat(32)),
      token,
    });
    await pool.query(
      "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [accountId, email, email, "Http", "test-only-not-a-real-hash"],
    );
    await pool.query(
      "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
      [randomUUID(), accountId, tokenHash],
    );
    if (grant) await superadminService.grantSuperadmin({ accountId });
    createdAccountIds.push(accountId);
    return `mugful-session=${token}`;
  };

  const superadminHeaders = async (
    grant: boolean,
  ): Promise<ReturnType<typeof unsafeHeaders>> => {
    const cookie = await createSuperadminSession(grant);
    const csrf = await csrfFor(app);
    return unsafeHeaders({
      cookie: `${cookie}; ${csrf.cookie}`,
      csrfToken: csrf.token,
    });
  };

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    if (createdAccountIds.length > 0) {
      await pool.query(
        "DELETE FROM prompt_audit_events WHERE changed_by_account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM prompt_versions WHERE created_by_account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM prompts WHERE created_by_account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_webauthn_challenges WHERE account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_audit_events WHERE account_id = ANY($1) OR changed_by_account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_passkey_credentials WHERE account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_totp_recovery WHERE account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_mfa_verifications WHERE account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query(
        "DELETE FROM superadmin_accounts WHERE account_id = ANY($1)",
        [createdAccountIds],
      );
      await pool.query("DELETE FROM sessions WHERE account_id = ANY($1)", [
        createdAccountIds,
      ]);
      await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [
        createdAccountIds,
      ]);
    }
    await app.close();
    await pool.end();
  });

  it("rejects anonymous access and non-superadmin sessions", async () => {
    // Given: no session cookie, then a session without a grant
    const anonymous = await app.inject({
      method: "GET",
      url: "/v1/superadmin/status",
    });
    const plainHeaders = await superadminHeaders(false);
    const plain = await app.inject({
      method: "GET",
      headers: plainHeaders,
      url: "/v1/superadmin/status",
    });

    // Then: anonymous callers are unauthorized and plain users are forbidden
    expect(anonymous.statusCode).toBe(401);
    expect(plain.statusCode).toBe(403);
  });

  it("reports superadmin status with the MFA gate closed until verified", async () => {
    // Given: a granted superadmin session
    const headers = await superadminHeaders(true);

    // When: the status endpoint is queried
    const response = await app.inject({
      method: "GET",
      headers,
      url: "/v1/superadmin/status",
    });

    // Then: the account is superadmin without MFA verification
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ mfaVerified: false, superadmin: true });
  });

  it("requires MFA before prompt administration", async () => {
    // Given: a granted session without MFA verification
    const headers = await superadminHeaders(true);

    // When: the prompt catalog is queried and a prompt is created
    const list = await app.inject({
      method: "GET",
      headers,
      url: "/v1/superadmin/prompts",
    });
    const create = await app.inject({
      method: "POST",
      headers,
      url: "/v1/superadmin/prompts",
      payload: { category: "daily-life", text: "Blocked attempt" },
    });

    // Then: both requests are refused until MFA verification exists
    expect(list.statusCode).toBe(403);
    expect(list.json()).toEqual({ error: "mfa-required" });
    expect(create.statusCode).toBe(403);
    expect(create.json()).toEqual({ error: "mfa-required" });
  });

  it("administers the prompt catalog after MFA verification", async () => {
    // Given: a granted session with verified MFA
    const cookie = await createSuperadminSession(true);
    const csrf = await csrfFor(app);
    const headers = unsafeHeaders({
      cookie: `${cookie}; ${csrf.cookie}`,
      csrfToken: csrf.token,
    });
    const sessionId = await pool.query<{ readonly id: string }>(
      "SELECT id FROM sessions WHERE account_id = $1",
      [createdAccountIds[createdAccountIds.length - 1]],
    );
    const mfaSessionId = sessionId.rows[0]?.id ?? "";
    await mfaService.verifySession({
      accountId: createdAccountIds[createdAccountIds.length - 1] ?? "",
      method: "passkey",
      sessionId: mfaSessionId,
    });

    // When: a prompt is created, updated, listed, and retired
    const created = await app.inject({
      method: "POST",
      headers,
      url: "/v1/superadmin/prompts",
      payload: {
        category: "  daily-life  ",
        reason: "HTTP slice",
        text: "  What made you smile today?  ",
      },
    });
    const createdBody = created.json<{ promptId: string; version: number }>();
    const listed = await app.inject({
      method: "GET",
      headers,
      url: "/v1/superadmin/prompts",
    });
    const updated = await app.inject({
      method: "PUT",
      headers,
      url: `/v1/superadmin/prompts/${createdBody.promptId}`,
      payload: {
        category: "daily-life",
        text: "What made you smile this week?",
      },
    });
    const retired = await app.inject({
      method: "DELETE",
      headers,
      url: `/v1/superadmin/prompts/${createdBody.promptId}`,
    });
    const afterRetirement = await app.inject({
      method: "GET",
      headers,
      url: "/v1/superadmin/prompts",
    });

    // Then: the full CRUD lifecycle succeeds through HTTP
    expect(created.statusCode).toBe(201);
    expect(createdBody.version).toBe(1);
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json<{ prompts: readonly { text: string }[] }>().prompts,
    ).toEqual([
      {
        category: "daily-life",
        promptId: createdBody.promptId,
        text: "What made you smile today?",
        version: 1,
      },
    ]);
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual({ status: "updated" });
    expect(retired.statusCode).toBe(200);
    expect(retired.json()).toEqual({ status: "retired" });
    expect(
      afterRetirement.json<{ prompts: readonly unknown[] }>().prompts,
    ).toEqual([]);
  });

  it("rejects mutations without CSRF binding and malformed payloads", async () => {
    // Given: a granted, MFA-verified session and a cookie without CSRF
    const cookie = await createSuperadminSession(true);
    const sessionId = await pool.query<{ readonly id: string }>(
      "SELECT id FROM sessions WHERE account_id = $1",
      [createdAccountIds[createdAccountIds.length - 1]],
    );
    await mfaService.verifySession({
      accountId: createdAccountIds[createdAccountIds.length - 1] ?? "",
      method: "totp",
      sessionId: sessionId.rows[0]?.id ?? "",
    });

    // When: a mutation skips the CSRF token and another sends invalid text
    const missingCsrf = await app.inject({
      method: "POST",
      headers: { cookie },
      url: "/v1/superadmin/prompts",
      payload: { category: "daily-life", text: "No CSRF" },
    });
    const csrf = await csrfFor(app);
    const invalidPayload = await app.inject({
      method: "POST",
      headers: unsafeHeaders({
        cookie: `${cookie}; ${csrf.cookie}`,
        csrfToken: csrf.token,
      }),
      url: "/v1/superadmin/prompts",
      payload: { category: "daily-life", text: "   " },
    });

    // Then: CSRF-less mutations are forbidden and invalid text is rejected
    expect(missingCsrf.statusCode).toBe(403);
    expect(invalidPayload.statusCode).toBe(400);
  });

  it("issues ceremony options and refuses bogus ceremony completions", async () => {
    // Given: a granted superadmin session
    const headers = await superadminHeaders(true);

    // When: registration options are requested and a bogus assertion verified
    const options = await app.inject({
      method: "POST",
      headers,
      url: "/v1/superadmin/webauthn/authentication/options",
      payload: {},
    });
    const bogus = await app.inject({
      method: "POST",
      headers,
      url: "/v1/superadmin/webauthn/authentication/verify",
      payload: {
        id: "unknown",
        rawId: "unknown",
        response: {},
        type: "public-key",
      },
    });

    // Then: options carry a challenge and the bogus assertion is refused
    expect(options.statusCode).toBe(200);
    expect(
      options.json<{ options: { challenge: string } }>().options.challenge,
    ).toBeTruthy();
    expect(bogus.statusCode).toBe(401);
  });
});
