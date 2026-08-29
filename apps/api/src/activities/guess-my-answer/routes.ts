import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createCsrfProtection } from "../../identity/csrf.js";
import { sessionTokenSchema } from "../../identity/session.js";
import type { IdentityService } from "../../identity/service.js";
import type { GuessMyAnswerService } from "./service.js";

type GuessMyAnswerRouteDependencies = Readonly<{
  csrfSecret: string;
  identityService: IdentityService;
  productionCookies: boolean;
  roundService: GuessMyAnswerService;
  sessionCookieName: string;
  webOrigin: string;
}>;

type SpaceContext = Readonly<{
  accountId: string;
  spaceId: string;
}>;

const parseCookies = (
  header: string | undefined,
): Readonly<Record<string, string>> => {
  if (header === undefined) return {};
  return Object.fromEntries(
    header.split(";").flatMap((segment) => {
      const [name, value] = segment.trim().split("=", 2);
      return name === undefined || value === undefined ? [] : [[name, value]];
    }),
  );
};

const sendError = (
  reply: FastifyReply,
  code: number,
  error: string,
): FastifyReply => reply.code(code).send({ error });

const roundParametersSchema = z.object({
  roundId: z.string().uuid(),
});

const roundOutcomeError = (
  reply: FastifyReply,
  outcome: "not-member" | "unknown-round",
): FastifyReply => {
  if (outcome === "not-member") return sendError(reply, 403, "forbidden");
  return sendError(reply, 404, "unknown round");
};

export const registerGuessMyAnswerRoutes = (
  app: FastifyInstance,
  dependencies: GuessMyAnswerRouteDependencies,
): void => {
  const csrf = createCsrfProtection({
    cookieName: dependencies.productionCookies
      ? "__Host-mugful-csrf"
      : "mugful-csrf",
    secret: dependencies.csrfSecret,
  });

  const verifyUnsafeRequest = (request: FastifyRequest): boolean => {
    const cookies = parseCookies(request.headers.cookie);
    const token = request.headers["x-csrf-token"];
    const csrfCookieValue = cookies[csrf.cookieName];
    return (
      request.headers.origin === dependencies.webOrigin &&
      typeof token === "string" &&
      csrfCookieValue !== undefined &&
      csrf.verify({ cookieValue: csrfCookieValue, token })
    );
  };

  const requireSpace = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<SpaceContext | undefined> => {
    const token = parseCookies(request.headers.cookie)[
      dependencies.sessionCookieName
    ];
    const parsed = sessionTokenSchema.safeParse(token);
    if (!parsed.success) {
      sendError(reply, 401, "unauthorized");
      return undefined;
    }
    const session = await dependencies.identityService.authenticate(
      parsed.data,
    );
    if (session === undefined) {
      sendError(reply, 401, "unauthorized");
      return undefined;
    }
    const spaceId = await dependencies.roundService.activeSpaceId(
      session.accountId,
    );
    if (spaceId === undefined) {
      sendError(reply, 404, "no couple space");
      return undefined;
    }
    return { accountId: session.accountId, spaceId };
  };

  const roundParameters = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): string | undefined => {
    const parsed = roundParametersSchema.safeParse(request.params);
    if (!parsed.success) {
      sendError(reply, 404, "unknown round");
      return undefined;
    }
    return parsed.data.roundId;
  };

  const parseBody = <T>(
    request: FastifyRequest,
    schema: z.ZodType<T>,
  ): T | undefined => {
    const parsed = schema.safeParse(request.body);
    return parsed.success ? parsed.data : undefined;
  };

  app.get(
    "/v1/activities/guess-my-answer/prompt",
    { schema: { hide: true } },
    async (request, reply) => {
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const query = z
        .object({
          category: z.string().trim().min(1).max(64).optional(),
          exclude: z.string().optional(),
        })
        .loose()
        .safeParse(request.query ?? {});
      const exclude =
        query.success && query.data.exclude !== undefined
          ? query.data.exclude.split(",").filter((value) => value !== "")
          : undefined;
      try {
        const suggestion = await dependencies.roundService.suggestPrompt({
          actorAccountId: space.accountId,
          category: query.success ? query.data.category : undefined,
          excludePromptVersionIds: exclude,
          spaceId: space.spaceId,
        });
        if (suggestion === "not-member")
          return sendError(reply, 403, "forbidden");
        if (suggestion === "no-prompt-available")
          return sendError(reply, 404, "no prompt available");
        return reply.send(suggestion);
      } catch {
        return sendError(reply, 400, "invalid request");
      }
    },
  );

  app.post(
    "/v1/activities/guess-my-answer/rounds",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const body = parseBody(
        request,
        z.object({ promptVersionId: z.string().uuid() }).loose(),
      );
      if (body === undefined) return sendError(reply, 400, "invalid request");
      const started = await dependencies.roundService.startRound({
        actorAccountId: space.accountId,
        promptVersionId: body.promptVersionId,
        spaceId: space.spaceId,
      });
      if (started === "not-member") return sendError(reply, 403, "forbidden");
      if (started === "invalid-prompt")
        return sendError(reply, 400, "invalid prompt");
      if (started === "pending-exists")
        return sendError(reply, 409, "a pending round already exists");
      return reply.code(201).send(started);
    },
  );

  app.get(
    "/v1/activities/guess-my-answer/rounds",
    { schema: { hide: true } },
    async (request, reply) => {
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const rounds = await dependencies.roundService.listRounds({
        actorAccountId: space.accountId,
        spaceId: space.spaceId,
      });
      if (rounds === "not-member") return sendError(reply, 403, "forbidden");
      return reply.send({ rounds });
    },
  );

  app.get(
    "/v1/activities/guess-my-answer/rounds/:roundId",
    { schema: { hide: true } },
    async (request, reply) => {
      const roundId = roundParameters(request, reply);
      if (roundId === undefined) return reply;
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const view = await dependencies.roundService.getRound({
        actorAccountId: space.accountId,
        roundId,
      });
      if (view === "not-member" || view === "unknown-round")
        return roundOutcomeError(reply, view);
      return reply.send(view);
    },
  );

  app.post(
    "/v1/activities/guess-my-answer/rounds/:roundId/answer",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const roundId = roundParameters(request, reply);
      if (roundId === undefined) return reply;
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const body = parseBody(request, z.object({ answer: z.string() }).loose());
      if (body === undefined) return sendError(reply, 400, "invalid request");
      try {
        const submitted = await dependencies.roundService.submitAnswer({
          actorAccountId: space.accountId,
          answer: body.answer,
          roundId,
        });
        if (submitted === "not-member" || submitted === "unknown-round")
          return roundOutcomeError(reply, submitted);
        if (submitted === "already-submitted")
          return sendError(reply, 409, "answer already submitted");
        if (submitted === "round-closed")
          return sendError(reply, 409, "round no longer accepts answers");
        return reply.send(submitted);
      } catch {
        return sendError(reply, 400, "invalid request");
      }
    },
  );

  app.post(
    "/v1/activities/guess-my-answer/rounds/:roundId/reveal",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const roundId = roundParameters(request, reply);
      if (roundId === undefined) return reply;
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const revealed = await dependencies.roundService.revealRound({
        actorAccountId: space.accountId,
        roundId,
      });
      if (revealed === "not-member" || revealed === "unknown-round")
        return roundOutcomeError(reply, revealed);
      if (revealed === "not-ready")
        return sendError(reply, 409, "round is not ready to reveal");
      return reply.send(revealed.view);
    },
  );

  app.post(
    "/v1/activities/guess-my-answer/rounds/:roundId/cancel",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const roundId = roundParameters(request, reply);
      if (roundId === undefined) return reply;
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const cancelled = await dependencies.roundService.cancelRound({
        actorAccountId: space.accountId,
        roundId,
      });
      if (cancelled === "not-member" || cancelled === "unknown-round")
        return roundOutcomeError(reply, cancelled);
      if (cancelled === "not-cancellable")
        return sendError(reply, 409, "round can no longer be cancelled");
      return reply.send({ status: cancelled });
    },
  );

  app.post(
    "/v1/activities/guess-my-answer/rounds/:roundId/react",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const roundId = roundParameters(request, reply);
      if (roundId === undefined) return reply;
      const space = await requireSpace(request, reply);
      if (space === undefined) return reply;
      const body = parseBody(
        request,
        z.object({ reaction: z.string() }).loose(),
      );
      if (body === undefined) return sendError(reply, 400, "invalid request");
      try {
        const reacted = await dependencies.roundService.reactToRound({
          actorAccountId: space.accountId,
          reaction: body.reaction,
          roundId,
        });
        if (reacted === "not-member" || reacted === "unknown-round")
          return roundOutcomeError(reply, reacted);
        if (reacted === "not-open")
          return sendError(reply, 409, "reactions open after the reveal");
        return reply.send({ status: reacted });
      } catch {
        return sendError(reply, 400, "invalid request");
      }
    },
  );
};
