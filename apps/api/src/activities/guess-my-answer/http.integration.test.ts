import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "../../identity/http-test-support.js";
import {
  createSessionToken,
  hashSessionToken,
  sessionPepperSchema,
} from "../../identity/session.js";

describe.skipIf(!databaseTestsEnabled)("Guess My Answer HTTP surface", () => {
  const context = createIdentityHttpTestContext(false);
  const { app, pool } = context;

  const createAccount = async (): Promise<string> => {
    const accountId = randomUUID();
    const email = `${accountId}@round.test`;
    await pool.query(
      "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [accountId, email, email, "Round", "test-only-not-a-real-hash"],
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

  const createCouple = async (): Promise<{
    partnerA: string;
    partnerB: string;
    spaceId: string;
  }> => {
    const partnerA = await createAccount();
    const partnerB = await createAccount();
    const spaceId = randomUUID();
    await pool.query(
      "INSERT INTO couple_spaces (id, created_by_account_id) VALUES ($1, $2)",
      [spaceId, partnerA],
    );
    await pool.query(
      "INSERT INTO couple_memberships (couple_space_id, account_id) VALUES ($1, $2), ($1, $3)",
      [spaceId, partnerA, partnerB],
    );
    return { partnerA, partnerB, spaceId };
  };

  const createPromptVersion = async (
    category: string,
    text: string,
  ): Promise<string> => {
    const promptId = randomUUID();
    const versionId = randomUUID();
    await pool.query("INSERT INTO prompts (id) VALUES ($1)", [promptId]);
    await pool.query(
      "INSERT INTO prompt_versions (id, prompt_id, version, text, category) VALUES ($1, $2, 1, $3, $4)",
      [versionId, promptId, text, category],
    );
    return versionId;
  };

  const headersFor = async (
    cookie: string,
  ): Promise<ReturnType<typeof unsafeHeaders>> => {
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
    await resetIdentityData(pool);
    await pool.query("DELETE FROM prompts");
    await app.close();
    await pool.end();
  });

  it("rejects anonymous access and accounts without a couple space", async () => {
    // Given: no session cookie, then a session for an account without a space
    const anonymous = await app.inject({
      method: "GET",
      url: "/v1/activities/guess-my-answer/prompt",
    });
    const loneCookie = await createSessionCookie(await createAccount());
    const lone = await app.inject({
      method: "GET",
      headers: await headersFor(loneCookie),
      url: "/v1/activities/guess-my-answer/prompt",
    });

    // Then: anonymous callers are unauthorized and spaceless accounts get 404
    expect(anonymous.statusCode).toBe(401);
    expect(lone.statusCode).toBe(404);
    expect(lone.json()).toEqual({ error: "no couple space" });
  });

  it("runs the full round lifecycle over HTTP", async () => {
    // Given: a couple with one active prompt version
    const { partnerA, partnerB } = await createCouple();
    const versionId = await createPromptVersion(
      "daily-life",
      "Favorite dessert?",
    );
    const headersA = await headersFor(await createSessionCookie(partnerA));
    const headersB = await headersFor(await createSessionCookie(partnerB));

    // When: the round is suggested, started, answered, revealed, and reacted
    const suggestion = await app.inject({
      method: "GET",
      headers: headersA,
      url: "/v1/activities/guess-my-answer/prompt",
    });
    expect(suggestion.statusCode).toBe(200);
    expect(suggestion.json<{ promptVersionId: string }>().promptVersionId).toBe(
      versionId,
    );
    const started = await app.inject({
      method: "POST",
      headers: headersA,
      url: "/v1/activities/guess-my-answer/rounds",
      payload: { promptVersionId: versionId },
    });
    const roundId = started.json<{ roundId: string }>().roundId;
    const duplicate = await app.inject({
      method: "POST",
      headers: headersB,
      url: "/v1/activities/guess-my-answer/rounds",
      payload: { promptVersionId: versionId },
    });
    const submitA = await app.inject({
      method: "POST",
      headers: headersA,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/answer`,
      payload: { answer: "  Cake  " },
    });
    const partnerView = await app.inject({
      method: "GET",
      headers: headersB,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}`,
    });
    const submitB = await app.inject({
      method: "POST",
      headers: headersB,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/answer`,
      payload: { answer: "cake" },
    });
    const revealed = await app.inject({
      method: "POST",
      headers: headersA,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/reveal`,
    });
    const reacted = await app.inject({
      method: "POST",
      headers: headersB,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/react`,
      payload: { reaction: "🎉" },
    });
    const listed = await app.inject({
      method: "GET",
      headers: headersA,
      url: "/v1/activities/guess-my-answer/rounds",
    });

    // Then: every lifecycle step behaves per the documented contract
    expect(started.statusCode).toBe(201);
    expect(started.json()).toEqual({ roundId, status: "active" });
    expect(duplicate.statusCode).toBe(409);
    expect(submitA.statusCode).toBe(200);
    expect(submitA.json()).toEqual({ status: "waiting-for-partner" });
    expect(partnerView.statusCode).toBe(200);
    const partnerBody = partnerView.json<{
      ownAnswer: string | undefined;
      partnerSubmitted: boolean;
      status: string;
    }>();
    expect(partnerBody.status).toBe("waiting-for-partner");
    expect(partnerBody.ownAnswer).toBeUndefined();
    expect(partnerBody.partnerSubmitted).toBe(true);
    expect(submitB.statusCode).toBe(200);
    expect(submitB.json()).toEqual({ status: "ready-to-reveal" });
    expect(revealed.statusCode).toBe(200);
    const revealedBody = revealed.json<{
      match: boolean;
      answers: readonly { answer: string }[];
      status: string;
    }>();
    expect(revealedBody.status).toBe("completed");
    expect(revealedBody.match).toBe(true);
    expect(revealedBody.answers).toHaveLength(2);
    expect(reacted.statusCode).toBe(200);
    expect(reacted.json()).toEqual({ status: "reacted" });
    expect(listed.statusCode).toBe(200);
    expect(
      listed.json<{ rounds: readonly { status: string }[] }>().rounds,
    ).toHaveLength(1);
  });

  it("rejects CSRF-less mutations and invalid answers", async () => {
    // Given: a pending round with both partner cookies prepared
    const { partnerA } = await createCouple();
    const versionId = await createPromptVersion("daily-life", "Ideal Sunday?");
    const cookieA = await createSessionCookie(partnerA);
    const started = await app.inject({
      method: "POST",
      headers: await headersFor(cookieA),
      url: "/v1/activities/guess-my-answer/rounds",
      payload: { promptVersionId: versionId },
    });
    const roundId = started.json<{ roundId: string }>().roundId;

    // When: an answer is submitted without CSRF, then with a blank answer
    const missingCsrf = await app.inject({
      method: "POST",
      headers: { cookie: cookieA },
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/answer`,
      payload: { answer: "No CSRF" },
    });
    const blank = await app.inject({
      method: "POST",
      headers: await headersFor(cookieA),
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/answer`,
      payload: { answer: "   " },
    });

    // Then: CSRF-less mutations are forbidden and blank answers rejected
    expect(missingCsrf.statusCode).toBe(403);
    expect(blank.statusCode).toBe(400);
  });

  it("frees the pending slot after cancellation", async () => {
    // Given: a pending round
    const { partnerA, partnerB } = await createCouple();
    const versionId = await createPromptVersion(
      "future",
      "Next trip together?",
    );
    const headersA = await headersFor(await createSessionCookie(partnerA));
    const started = await app.inject({
      method: "POST",
      headers: headersA,
      url: "/v1/activities/guess-my-answer/rounds",
      payload: { promptVersionId: versionId },
    });
    const roundId = started.json<{ roundId: string }>().roundId;

    // When: the round is cancelled and a fresh one starts
    const cancelled = await app.inject({
      method: "POST",
      headers: headersA,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/cancel`,
    });
    const cancelledAgain = await app.inject({
      method: "POST",
      headers: headersA,
      url: `/v1/activities/guess-my-answer/rounds/${roundId}/cancel`,
    });
    const restarted = await app.inject({
      method: "POST",
      headers: await headersFor(await createSessionCookie(partnerB)),
      url: "/v1/activities/guess-my-answer/rounds",
      payload: { promptVersionId: versionId },
    });

    // Then: cancellation is single-shot and the slot is released
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toEqual({ status: "cancelled" });
    expect(cancelledAgain.statusCode).toBe(409);
    expect(restarted.statusCode).toBe(201);
  });
});
