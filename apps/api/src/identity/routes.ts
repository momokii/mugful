// allow: SIZE_OK - one cohesive Fastify identity route table is clearer than route-per-file indirection.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createCsrfProtection } from "./csrf.js";
import { identityOpenApiSchemas } from "./openapi.js";
import type { IdentityEmailService } from "./email-service.js";
import { registerIdentityEmailRoutes } from "./email-routes.js";
import { sessionTokenSchema } from "./session.js";
import type { IdentityService } from "./service.js";

const registrationSchema = z.object({
  adultAttestation: z.literal(true),
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(256),
  privacyVersion: z.string().min(1).max(64),
  termsVersion: z.string().min(1).max(64),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(256),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});

const sessionParamsSchema = z.object({ sessionId: z.string().uuid() });

type IdentityRouteDependencies = Readonly<{
  csrfSecret: string;
  identityEmailService: IdentityEmailService;
  identityService: IdentityService;
  productionCookies: boolean;
  registrationEnabled: boolean;
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

const cookieAttributes = (
  input: Readonly<{ httpOnly: boolean; maxAge: number; production: boolean }>,
): string =>
  `Path=/; SameSite=${input.httpOnly ? "Lax" : "Strict"}; Max-Age=${input.maxAge};${input.production ? " Secure;" : ""}${input.httpOnly ? " HttpOnly;" : ""}`;

const setSessionCookie = (
  reply: FastifyReply,
  dependencies: IdentityRouteDependencies,
  input: Readonly<{ expiresAt: Date; token: string }>,
): void => {
  const maxAge = Math.max(
    0,
    Math.floor((input.expiresAt.getTime() - Date.now()) / 1000),
  );
  reply.header(
    "set-cookie",
    `${dependencies.sessionCookieName}=${input.token}; ${cookieAttributes({ httpOnly: true, maxAge, production: dependencies.productionCookies })}`,
  );
};

const setCsrfCookie = (
  reply: FastifyReply,
  dependencies: IdentityRouteDependencies,
  value: string,
): void => {
  const name = dependencies.productionCookies
    ? "__Host-mugful-csrf"
    : "mugful-csrf";
  reply.header(
    "set-cookie",
    `${name}=${value}; ${cookieAttributes({ httpOnly: false, maxAge: 60 * 60, production: dependencies.productionCookies })}`,
  );
};

const deviceLabel = (request: FastifyRequest): string | undefined => {
  const userAgent = request.headers["user-agent"];
  if (userAgent === undefined) return undefined;
  return (
    Array.from(userAgent)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join("")
      .slice(0, 120) || undefined
  );
};

const sendForbidden = (reply: FastifyReply): FastifyReply =>
  reply.code(403).send({ error: "forbidden" });

export const registerIdentityRoutes = (
  app: FastifyInstance,
  dependencies: IdentityRouteDependencies,
): void => {
  const csrfCookieName = dependencies.productionCookies
    ? "__Host-mugful-csrf"
    : "mugful-csrf";
  const csrf = createCsrfProtection({
    cookieName: csrfCookieName,
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
    const parsedToken = sessionTokenSchema.safeParse(token);
    return parsedToken.success
      ? dependencies.identityService.authenticate(parsedToken.data)
      : undefined;
  };

  registerIdentityEmailRoutes(app, {
    identityEmailService: dependencies.identityEmailService,
    sendForbidden,
    verifyUnsafeRequest,
  });

  app.get(
    "/v1/csrf",
    { schema: identityOpenApiSchemas.csrf },
    (_request, reply) => {
      const issued = csrf.create();
      setCsrfCookie(reply, dependencies, issued.cookieValue);
      return reply.send({ csrfToken: issued.token });
    },
  );

  app.post(
    "/v1/auth/register",
    { schema: identityOpenApiSchemas.register },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request)) return sendForbidden(reply);
      if (!dependencies.registrationEnabled) return sendForbidden(reply);
      const parsed = registrationSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid registration" });
      const result = await dependencies.identityService.register(parsed.data);
      if (result === "rate-limited")
        return reply
          .code(429)
          .header("retry-after", "60")
          .send({ error: "try again later" });
      return reply.code(202).send({ status: "accepted" });
    },
  );

  app.post(
    "/v1/auth/login",
    { schema: identityOpenApiSchemas.login },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request)) return sendForbidden(reply);
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid credentials" });
      const result = await dependencies.identityService.login({
        ...parsed.data,
        deviceLabel: deviceLabel(request),
      });
      if (result === "rate-limited")
        return reply
          .code(429)
          .header("retry-after", "60")
          .send({ error: "try again later" });
      if (result === "invalid-credentials")
        return reply.code(401).send({ error: "invalid credentials" });
      setSessionCookie(reply, dependencies, result);
      return reply.send({
        session: {
          email: result.email,
          expiresAt: result.expiresAt.toISOString(),
        },
      });
    },
  );

  app.post(
    "/v1/auth/logout",
    { schema: identityOpenApiSchemas.logout },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request)) return sendForbidden(reply);
      const token = parseCookies(request.headers.cookie)[
        dependencies.sessionCookieName
      ];
      const parsedToken = sessionTokenSchema.safeParse(token);
      if (parsedToken.success)
        await dependencies.identityService.revokeSessionToken(parsedToken.data);
      reply.header(
        "set-cookie",
        `${dependencies.sessionCookieName}=; ${cookieAttributes({ httpOnly: true, maxAge: 0, production: dependencies.productionCookies })}`,
      );
      return reply.code(204).send();
    },
  );

  app.get(
    "/v1/auth/session",
    { schema: identityOpenApiSchemas.currentSession },
    async (request, reply) => {
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      return reply.send({
        session: {
          email: session.email,
          expiresAt: session.expiresAt.toISOString(),
        },
      });
    },
  );

  app.post(
    "/v1/auth/password",
    { schema: identityOpenApiSchemas.changePassword },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request)) return sendForbidden(reply);
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      const parsed = passwordChangeSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid password" });
      const result = await dependencies.identityService.changePassword({
        ...parsed.data,
        session,
      });
      if (result === "invalid-password")
        return reply.code(401).send({ error: "invalid password" });
      setSessionCookie(reply, dependencies, result);
      return reply.send({
        session: {
          email: result.email,
          expiresAt: result.expiresAt.toISOString(),
        },
      });
    },
  );

  app.get(
    "/v1/auth/sessions",
    { schema: identityOpenApiSchemas.sessions },
    async (request, reply) => {
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      const sessions = await dependencies.identityService.sessions(
        session.accountId,
      );
      return reply.send({
        sessions: sessions.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          current: item.id === session.sessionId,
          lastSeenAt: item.lastSeenAt?.toISOString() ?? null,
        })),
      });
    },
  );

  app.delete(
    "/v1/auth/sessions/:sessionId",
    { schema: identityOpenApiSchemas.revokeSession },
    async (request, reply) => {
      if (!verifyUnsafeRequest(request)) return sendForbidden(reply);
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      const params = sessionParamsSchema.safeParse(request.params);
      if (!params.success) return sendForbidden(reply);
      const result = await dependencies.identityService.revokeSession({
        accountId: session.accountId,
        currentSessionId: session.sessionId,
        sessionId: params.data.sessionId,
      });
      return result === "revoked"
        ? reply.code(204).send()
        : sendForbidden(reply);
    },
  );
};
