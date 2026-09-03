import { randomUUID } from "node:crypto";

import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createGuessMyAnswerService } from "./service.js";
import { wireRealtimeGateway, type RoundEventType } from "./realtime.js";
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
import { createIdentityRepository } from "../../identity/repository.js";

const waitForEvent = (client: Socket, event: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      5000,
    );
    client.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe.skipIf(!databaseTestsEnabled)(
  "Guess My Answer realtime gateway",
  () => {
    const context = createIdentityHttpTestContext(false);
    const { activitiesDependencies, app, identityService, pool } = context;
    const roundService = createGuessMyAnswerService({
      repository: createIdentityRepository(pool),
    });
    const io = new SocketIOServer(app.server, { path: "/api/socket.io" });
    activitiesDependencies.events = wireRealtimeGateway(io, {
      identityService,
      roundService,
      sessionCookieName: "mugful-session",
    });
    const createdAccountIds: string[] = [];
    let baseUrl = "";
    let client: Socket | undefined;

    const createAccountWithSession = async (): Promise<{
      accountId: string;
      cookie: string;
    }> => {
      const accountId = randomUUID();
      const email = `${accountId}@round.test`;
      const token = createSessionToken();
      const tokenHash = hashSessionToken({
        pepper: sessionPepperSchema.parse("s".repeat(32)),
        token,
      });
      await pool.query(
        "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [accountId, email, email, "Round", "test-only-not-a-real-hash"],
      );
      await pool.query(
        "INSERT INTO sessions (id, account_id, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')",
        [randomUUID(), accountId, tokenHash],
      );
      createdAccountIds.push(accountId);
      return { accountId, cookie: `mugful-session=${token}` };
    };

    const createCouple = async (): Promise<{
      cookieA: string;
      cookieB: string;
    }> => {
      const partnerA = await createAccountWithSession();
      const partnerB = await createAccountWithSession();
      const spaceId = randomUUID();
      await pool.query(
        "INSERT INTO couple_spaces (id, created_by_account_id) VALUES ($1, $2)",
        [spaceId, partnerA.accountId],
      );
      await pool.query(
        "INSERT INTO couple_memberships (couple_space_id, account_id) VALUES ($1, $2), ($1, $3)",
        [spaceId, partnerA.accountId, partnerB.accountId],
      );
      return { cookieA: partnerA.cookie, cookieB: partnerB.cookie };
    };

    const createPromptVersion = async (): Promise<string> => {
      const promptId = randomUUID();
      const versionId = randomUUID();
      await pool.query("INSERT INTO prompts (id) VALUES ($1)", [promptId]);
      await pool.query(
        "INSERT INTO prompt_versions (id, prompt_id, version, text, category) VALUES ($1, $2, 1, $3, $4)",
        [versionId, promptId, "Favorite dessert?", "daily-life"],
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

    const connectClient = (
      cookie: string | undefined,
    ): Promise<{ client: Socket; failure: string | undefined }> =>
      new Promise((resolve) => {
        const peer = ioClient(baseUrl, {
          extraHeaders: cookie === undefined ? {} : { cookie },
          path: "/api/socket.io",
          reconnection: false,
        });
        peer.on("connect", () => resolve({ client: peer, failure: undefined }));
        peer.on("connect_error", (error: Error) => {
          peer.disconnect();
          resolve({ client: peer, failure: error.message });
        });
      });

    beforeAll(async () => {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (typeof address !== "object" || address === null)
        throw new Error("Realtime server did not bind a port");
      baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      client?.disconnect();
      io.close();
      await resetIdentityData(pool);
      await pool.query("DELETE FROM prompts");
      await app.close();
      await pool.end();
    });

    it("delivers round events to the subscribing couple member", async () => {
      // Given: a couple with one member connected over the socket
      const { cookieA, cookieB } = await createCouple();
      const versionId = await createPromptVersion();
      const connected = await connectClient(cookieA);
      expect(connected.failure).toBeUndefined();
      client = connected.client;
      const eventQueue: Array<{ roundId: string; type: RoundEventType }> = [];
      connected.client.on("round-updated", (payload) => {
        eventQueue.push(payload as { roundId: string; type: RoundEventType });
      });
      const nextEvent = async (): Promise<{
        roundId: string;
        type: RoundEventType;
      }> => {
        while (eventQueue.length === 0)
          await waitForEvent(connected.client, "round-updated");
        const [event] = eventQueue.splice(0, 1);
        if (event === undefined) throw new Error("Expected a round event");
        return event;
      };

      // When: the partner starts a round through HTTP
      const started = await app.inject({
        method: "POST",
        headers: await headersFor(cookieB),
        url: "/v1/activities/guess-my-answer/rounds",
        payload: { promptVersionId: versionId },
      });
      const roundId = started.json<{ roundId: string }>().roundId;

      // Then: the connected member receives the start event with no answers
      const started2 = await nextEvent();
      expect(started2).toEqual({ roundId, type: "round-started" });

      // When: the partner submits an answer
      await app.inject({
        method: "POST",
        headers: await headersFor(cookieB),
        url: `/v1/activities/guess-my-answer/rounds/${roundId}/answer`,
        payload: { answer: "Tiramisu" },
      });

      // Then: the event confirms the submission without carrying content
      const submitted = await nextEvent();
      expect(submitted).toEqual({ roundId, type: "answer-submitted" });
    });

    it("rejects unauthenticated and spaceless sockets", async () => {
      // Given: no session cookie, then a session without a couple space
      const anonymous = await connectClient(undefined);
      const loneCookie = await createAccountWithSession();

      // When: both attempt to connect
      const spaceless = await connectClient(loneCookie.cookie);

      // Then: both are refused before joining any room
      expect(anonymous.failure).toBe("unauthorized");
      expect(spaceless.failure).toBe("no couple space");
    });
  },
);
