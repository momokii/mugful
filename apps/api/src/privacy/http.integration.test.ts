import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "../identity/http-test-support.js";
import {
  createSessionToken,
  hashSessionToken,
  sessionPepperSchema,
} from "../identity/session.js";

describe.skipIf(!databaseTestsEnabled)("privacy HTTP surface", () => {
  const context = createIdentityHttpTestContext(false);
  const { app, pool } = context;

  const createAccount = async (): Promise<string> => {
    const accountId = randomUUID();
    const email = `${accountId}@privacy.test`;
    await pool.query(
      "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [accountId, email, email, "Privacy", "test-only-not-a-real-hash"],
    );
    await pool.query(
      "INSERT INTO account_consents (account_id, kind, version) VALUES ($1, 'privacy', 'privacy-v1'), ($1, 'terms', 'terms-v1')",
      [accountId],
    );
    return accountId;
  };

  const createSessionCookie = async (accountId: string): Promise<string> => {
    const token = createSessionToken();
    const tokenHash = hashSessionToken({
      pepper: sessionPepperSchema.parse("s".repeat(32)),
      token,
    });
    await pool.query(
      "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
      [randomUUID(), accountId, tokenHash],
    );
    return `mugful-session=${token}`;
  };

  const headersFor = async (cookie: string) => {
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
    await pool.query("DELETE FROM account_processing_restrictions");
    await pool.query("DELETE FROM privacy_requests");
    await resetIdentityData(pool);
    await app.close();
    await pool.end();
  });

  it("rejects unauthenticated and CSRF-less privacy requests", async () => {
    // Given: no session cookie, then a session without CSRF
    const accountId = await createAccount();
    const cookie = await createSessionCookie(accountId);

    // When: export without session and correction without CSRF
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/v1/privacy/export",
    });
    const missingCsrf = await app.inject({
      method: "POST",
      headers: { cookie },
      url: "/v1/privacy/correction",
      payload: { displayName: "New Name" },
    });

    // Then: both are rejected without touching data
    expect(unauthenticated.statusCode).toBe(401);
    expect(missingCsrf.statusCode).toBe(403);
  });

  it("exports, corrects, deletes, withdraws, and restricts through HTTP with persistence", async () => {
    // Given: an account with consents and a session
    const accountId = await createAccount();
    const cookie = await createSessionCookie(accountId);

    // When: the export is fetched
    const exported = await app.inject({
      method: "GET",
      headers: await headersFor(cookie),
      url: "/v1/privacy/export",
    });
    expect(exported.statusCode).toBe(200);
    expect(
      exported.json<{ account: { displayName: string } }>().account.displayName,
    ).toBe("Privacy");

    // When: the profile is corrected
    const corrected = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/correction",
      payload: { displayName: "  Corrected Name  " },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json()).toEqual({ status: "corrected" });
    const correctedRow = await pool.query<{ display_name: string }>(
      "SELECT display_name FROM accounts WHERE id = $1",
      [accountId],
    );
    expect(correctedRow.rows[0]?.display_name).toBe("Corrected Name");

    // When: deletion is requested twice
    const deleted = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/deletion",
      payload: {},
    });
    const deletedRow = await pool.query<{
      deletion_grace_ends_at: Date;
      deletion_requested_at: Date;
    }>(
      "SELECT deletion_requested_at, deletion_grace_ends_at FROM accounts WHERE id = $1",
      [accountId],
    );
    const deletedAgain = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/deletion",
      payload: {},
    });
    expect(deleted.json()).toEqual({ status: "deleted" });
    expect(deletedRow.rows[0]?.deletion_requested_at).toBeInstanceOf(Date);
    expect(
      (deletedRow.rows[0]?.deletion_grace_ends_at.getTime() ?? 0) -
        (deletedRow.rows[0]?.deletion_requested_at.getTime() ?? 0),
    ).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(deletedAgain.json()).toEqual({ status: "already-requested" });

    // When: consent is withdrawn twice
    const withdrawn = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/withdrawal",
      payload: {},
    });
    const withdrawnRow = await pool.query<{ withdrawn_at: Date | null }>(
      "SELECT withdrawn_at FROM account_consents WHERE account_id = $1 AND kind = 'privacy'",
      [accountId],
    );
    const withdrawnAgain = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/withdrawal",
      payload: {},
    });
    expect(withdrawn.json()).toEqual({ status: "withdrawn" });
    expect(withdrawnRow.rows[0]?.withdrawn_at).toBeInstanceOf(Date);
    expect(withdrawnAgain.json()).toEqual({ status: "already-withdrawn" });

    // When: processing is restricted and lifted
    const restricted = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction",
      payload: { reason: "Need review" },
    });
    const restrictedRow = await pool.query<{ reason: string | null }>(
      "SELECT reason FROM account_processing_restrictions WHERE account_id = $1",
      [accountId],
    );
    const restrictedAgain = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction",
      payload: {},
    });
    const lifted = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction/lift",
      payload: {},
    });
    const liftedRow = await pool.query<{ lifted_at: Date | null }>(
      "SELECT lifted_at FROM account_processing_restrictions WHERE account_id = $1",
      [accountId],
    );
    expect(restricted.json()).toEqual({ status: "restricted" });
    expect(restrictedRow.rows[0]?.reason).toBe("Need review");
    expect(restrictedAgain.json()).toEqual({ status: "already-restricted" });
    expect(lifted.json()).toEqual({ status: "lifted" });
    expect(liftedRow.rows[0]?.lifted_at).toBeInstanceOf(Date);
  });

  it("rejects malformed correction, enforces idempotency on lift, and isolates accounts", async () => {
    // Given: two accounts, one with a prior restriction
    const accountId = await createAccount();
    const otherId = await createAccount();
    const cookie = await createSessionCookie(accountId);
    const otherCookie = await createSessionCookie(otherId);
    await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction",
      payload: { reason: "Initial" },
    });
    await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction/lift",
      payload: {},
    });

    // When: malformed correction, second lift, and cross-account export are attempted
    const malformed = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/correction",
      payload: { displayName: "   " },
    });
    const secondLift = await app.inject({
      method: "POST",
      headers: await headersFor(cookie),
      url: "/v1/privacy/restriction/lift",
      payload: {},
    });
    const otherExport = await app.inject({
      method: "GET",
      headers: await headersFor(otherCookie),
      url: "/v1/privacy/export",
    });

    // Then: malformed input is 400, second lift is not-restricted, and accounts stay isolated
    expect(malformed.statusCode).toBe(400);
    expect(secondLift.json()).toEqual({ status: "not-restricted" });
    expect(otherExport.statusCode).toBe(200);
    expect(
      otherExport.json<{ account: { displayName: string } }>().account
        .displayName,
    ).toBe("Privacy");
    const unchanged = await pool.query<{ display_name: string }>(
      "SELECT display_name FROM accounts WHERE id = $1",
      [accountId],
    );
    expect(unchanged.rows[0]?.display_name).toBe("Privacy");
  });
});
