import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createCsrfProtection } from "../identity/csrf.js";
import { sessionTokenSchema } from "../identity/session.js";
import type { IdentityService } from "../identity/service.js";
import type { PrivacyService } from "./service.js";

type PrivacyRouteDependencies = Readonly<{
  csrfSecret: string;
  identityService: IdentityService;
  privacyService: PrivacyService;
  productionCookies: boolean;
  sessionCookieName: string;
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

const sendUnauthorized = (reply: FastifyReply): FastifyReply =>
  reply.code(401).send({ error: "unauthorized" });

export const registerPrivacyRoutes = (
  app: FastifyInstance,
  dependencies: PrivacyRouteDependencies,
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

  app.get(
    "/v1/privacy/export",
    { schema: { hide: true } },
    async (request, reply) => {
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const data = await dependencies.privacyService.exportData(
        session.accountId,
      );
      return reply.send(data);
    },
  );

  app.post(
    "/v1/privacy/correction",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return reply.code(403).send({ error: "forbidden" });
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const parsed = z
        .object({ displayName: z.string().trim().min(1).max(80) })
        .loose()
        .safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid correction" });
      await dependencies.privacyService.correctProfile({
        accountId: session.accountId,
        displayName: parsed.data.displayName,
      });
      return reply.send({ status: "corrected" });
    },
  );

  app.post(
    "/v1/privacy/deletion",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return reply.code(403).send({ error: "forbidden" });
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const result = await dependencies.privacyService.requestDeletion(
        session.accountId,
      );
      return reply.send({ status: result });
    },
  );

  app.post(
    "/v1/privacy/withdrawal",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return reply.code(403).send({ error: "forbidden" });
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const result = await dependencies.privacyService.withdrawConsent(
        session.accountId,
      );
      return reply.send({ status: result });
    },
  );

  app.post(
    "/v1/privacy/restriction",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return reply.code(403).send({ error: "forbidden" });
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const parsed = z
        .object({ reason: z.string().trim().min(1).max(500).optional() })
        .loose()
        .safeParse(request.body ?? {});
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid restriction" });
      const result = await dependencies.privacyService.restrictProcessing({
        accountId: session.accountId,
        reason: parsed.data.reason,
      });
      return reply.send({ status: result });
    },
  );

  app.post(
    "/v1/privacy/restriction/lift",
    { schema: { hide: true } },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request))
        return reply.code(403).send({ error: "forbidden" });
      const session = await authenticate(request);
      if (session === undefined) return sendUnauthorized(reply);
      const result = await dependencies.privacyService.liftRestriction(
        session.accountId,
      );
      return reply.send({ status: result });
    },
  );
};
