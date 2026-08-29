import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createCsrfProtection } from "../identity/csrf.js";
import { sessionTokenSchema } from "../identity/session.js";
import type { IdentityService } from "../identity/service.js";
import type { PromptCatalogService } from "../prompts/service.js";
import type { SuperadminMfaService } from "./mfa.js";
import type { SuperadminService } from "./service.js";
import type { SuperadminWebauthnService } from "./webauthn.js";

type SuperadminRouteDependencies = Readonly<{
  ceremony: SuperadminWebauthnService;
  csrfSecret: string;
  identityService: IdentityService;
  mfaService: SuperadminMfaService;
  productionCookies: boolean;
  promptService: PromptCatalogService;
  sessionCookieName: string;
  superadminService: SuperadminService;
  webOrigin: string;
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

export const registerSuperadminRoutes = (
  app: FastifyInstance,
  dependencies: SuperadminRouteDependencies,
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

  const authenticate = async (request: FastifyRequest) => {
    const token = parseCookies(request.headers.cookie)[
      dependencies.sessionCookieName
    ];
    const parsed = sessionTokenSchema.safeParse(token);
    return parsed.success
      ? dependencies.identityService.authenticate(parsed.data)
      : undefined;
  };

  const requireSuperadmin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const session = await authenticate(request);
    if (session === undefined) {
      sendError(reply, 401, "unauthorized");
      return undefined;
    }
    if (
      !(await dependencies.superadminService.isSuperadmin(session.accountId))
    ) {
      sendError(reply, 403, "forbidden");
      return undefined;
    }
    return session;
  };

  const requireMfa = async (
    reply: FastifyReply,
    sessionId: string,
  ): Promise<boolean> => {
    const verified = await dependencies.mfaService.isSessionVerified({
      nowMs: Date.now(),
      sessionId,
    });
    if (!verified) sendError(reply, 403, "mfa-required");
    return verified;
  };

  const parseJsonBody = <T>(
    request: FastifyRequest,
    schema: z.ZodType<T>,
  ): T | undefined => {
    const parsed = schema.safeParse(request.body);
    return parsed.success ? parsed.data : undefined;
  };

  app.get(
    "/v1/superadmin/status",
    { schema: { hide: true } },
    async (request, reply) => {
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      const mfaVerified = await dependencies.mfaService.isSessionVerified({
        nowMs: Date.now(),
        sessionId: session.sessionId,
      });
      return reply.send({ mfaVerified, superadmin: true });
    },
  );

  app.post(
    "/v1/superadmin/webauthn/registration/options",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      const options = await dependencies.ceremony.beginPasskeyRegistration({
        accountId: session.accountId,
      });
      return reply.send({ options });
    },
  );

  app.post(
    "/v1/superadmin/webauthn/registration/verify",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      const body = parseJsonBody(request, z.object({}).loose());
      if (body === undefined) return sendError(reply, 400, "invalid request");
      const result = await dependencies.ceremony.completePasskeyRegistration({
        accountId: session.accountId,
        response: request.body as never,
      });
      if (result === "invalid")
        return sendError(reply, 400, "invalid registration");
      if (result === "duplicate-credential")
        return sendError(reply, 409, "credential already registered");
      return reply.send({ status: result });
    },
  );

  app.post(
    "/v1/superadmin/webauthn/authentication/options",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      const options = await dependencies.ceremony.beginPasskeyAuthentication({
        accountId: session.accountId,
      });
      return reply.send({ options });
    },
  );

  app.post(
    "/v1/superadmin/webauthn/authentication/verify",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      const body = parseJsonBody(request, z.object({}).loose());
      if (body === undefined) return sendError(reply, 400, "invalid request");
      const result = await dependencies.ceremony.completePasskeyAuthentication({
        accountId: session.accountId,
        response: request.body as never,
      });
      if (result !== "authenticated")
        return sendError(reply, 401, "invalid authentication");
      await dependencies.mfaService.verifySession({
        accountId: session.accountId,
        method: "passkey",
        sessionId: session.sessionId,
      });
      return reply.send({ method: "passkey", mfaVerified: true });
    },
  );

  app.get(
    "/v1/superadmin/prompts",
    { schema: { hide: true } },
    async (request, reply) => {
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      if (!(await requireMfa(reply, session.sessionId))) return reply;
      const prompts = await dependencies.promptService.listActivePrompts();
      return reply.send({ prompts });
    },
  );

  app.post(
    "/v1/superadmin/prompts",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      if (!(await requireMfa(reply, session.sessionId))) return reply;
      const body = parseJsonBody(
        request,
        z
          .object({
            category: z.string(),
            reason: z.string().optional(),
            text: z.string(),
          })
          .loose(),
      );
      if (body === undefined) return sendError(reply, 400, "invalid request");
      try {
        const created = await dependencies.promptService.createPrompt({
          actorAccountId: session.accountId,
          category: body.category,
          reason: body.reason,
          text: body.text,
        });
        return reply.code(201).send(created);
      } catch {
        return sendError(reply, 400, "invalid request");
      }
    },
  );

  app.put(
    "/v1/superadmin/prompts/:promptId",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      if (!(await requireMfa(reply, session.sessionId))) return reply;
      const parameters = z
        .object({ promptId: z.string().uuid() })
        .safeParse(request.params);
      if (!parameters.success) return sendError(reply, 400, "invalid request");
      const body = parseJsonBody(
        request,
        z
          .object({
            category: z.string(),
            reason: z.string().optional(),
            text: z.string(),
          })
          .loose(),
      );
      if (body === undefined) return sendError(reply, 400, "invalid request");
      try {
        const result = await dependencies.promptService.updatePrompt({
          actorAccountId: session.accountId,
          category: body.category,
          promptId: parameters.data.promptId,
          reason: body.reason,
          text: body.text,
        });
        if (result === "unknown-prompt")
          return sendError(reply, 404, "unknown prompt");
        if (result === "retired-prompt")
          return sendError(reply, 409, "prompt retired");
        return reply.send({ status: result });
      } catch {
        return sendError(reply, 400, "invalid request");
      }
    },
  );

  app.delete(
    "/v1/superadmin/prompts/:promptId",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return sendError(reply, 403, "forbidden");
      const session = await requireSuperadmin(request, reply);
      if (session === undefined) return reply;
      if (!(await requireMfa(reply, session.sessionId))) return reply;
      const parameters = z
        .object({ promptId: z.string().uuid() })
        .safeParse(request.params);
      if (!parameters.success) return sendError(reply, 400, "invalid request");
      const result = await dependencies.promptService.retirePrompt({
        actorAccountId: session.accountId,
        promptId: parameters.data.promptId,
      });
      if (result === "unknown-prompt")
        return sendError(reply, 404, "unknown prompt");
      if (result === "retired-prompt")
        return sendError(reply, 409, "prompt retired");
      return reply.send({ status: result });
    },
  );
};
