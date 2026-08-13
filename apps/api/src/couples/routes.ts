import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createCsrfProtection } from "../identity/csrf.js";
import type { IdentityService } from "../identity/service.js";
import { sessionTokenSchema } from "../identity/session.js";
import { coupleOpenApiSchemas } from "./openapi.js";
import { inviteTokenSchema } from "./invite-token.js";
import type { CoupleService } from "./service.js";

const acceptInviteSchema = z.object({ token: inviteTokenSchema }).strict();

type CoupleRouteDependencies = Readonly<{
  coupleService: CoupleService;
  csrfSecret: string;
  identityService: IdentityService;
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

const sendForbidden = (reply: FastifyReply): FastifyReply =>
  reply.code(403).send({ error: "forbidden" });

export const registerCoupleRoutes = (
  app: FastifyInstance,
  dependencies: CoupleRouteDependencies,
): void => {
  const csrf = createCsrfProtection({
    cookieName: dependencies.productionCookies
      ? "__Host-mugful-csrf"
      : "mugful-csrf",
    secret: dependencies.csrfSecret,
  });
  const authenticate = async (request: FastifyRequest) => {
    const token = parseCookies(request.headers.cookie)[
      dependencies.sessionCookieName
    ];
    const parsed = sessionTokenSchema.safeParse(token);
    return parsed.success
      ? dependencies.identityService.authenticate(parsed.data)
      : undefined;
  };
  const safeMutation = (request: FastifyRequest): boolean => {
    const cookies = parseCookies(request.headers.cookie);
    const token = request.headers["x-csrf-token"];
    const csrfCookie = cookies[csrf.cookieName];
    return (
      request.headers.origin === dependencies.webOrigin &&
      typeof token === "string" &&
      csrfCookie !== undefined &&
      csrf.verify({ cookieValue: csrfCookie, token })
    );
  };

  app.post(
    "/v1/couple-space",
    { schema: coupleOpenApiSchemas.createSpace },
    async (request, reply) => {
      if (!safeMutation(request)) return sendForbidden(reply);
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      const result = await dependencies.coupleService.createSpace(
        session.accountId,
      );
      if (result === "already-coupled") return sendForbidden(reply);
      return reply.code(201).send({
        inviteUrl: `${dependencies.webOrigin}/join#token=${result.inviteToken}`,
      });
    },
  );

  app.post(
    "/v1/couple-invites/accept",
    { schema: coupleOpenApiSchemas.acceptInvite },
    async (request, reply) => {
      if (!safeMutation(request)) return sendForbidden(reply);
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      const parsed = acceptInviteSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: "invalid invite" });
      const result = await dependencies.coupleService.acceptInvite({
        accountId: session.accountId,
        token: parsed.data.token,
      });
      if (result === "accepted") return reply.code(204).send();
      return result === "invalid-invite"
        ? reply.code(400).send({ error: "invalid invite" })
        : sendForbidden(reply);
    },
  );

  app.post(
    "/v1/couple-space/end",
    { schema: coupleOpenApiSchemas.endSpace },
    async (request, reply) => {
      if (!safeMutation(request)) return sendForbidden(reply);
      const session = await authenticate(request);
      if (session === undefined)
        return reply.code(401).send({ error: "unauthorized" });
      return (await dependencies.coupleService.endSpace(session.accountId)) ===
        "ended"
        ? reply.code(204).send()
        : sendForbidden(reply);
    },
  );
};
