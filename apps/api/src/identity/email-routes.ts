import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import type { IdentityEmailService } from "./email-service.js";
import { opaqueTokenSchema } from "./token.js";

const emailSchema = z.object({ email: z.string().trim().email().max(320) });
const tokenSchema = z.object({ token: opaqueTokenSchema });
const passwordResetSchema = tokenSchema.extend({
  newPassword: z.string().min(12).max(256),
});

type EmailRouteDependencies = Readonly<{
  identityEmailService: IdentityEmailService;
  sendForbidden: (reply: FastifyReply) => FastifyReply;
  verifyUnsafeRequest: (request: FastifyRequest) => boolean;
}>;

const sendRateLimited = (reply: FastifyReply): FastifyReply =>
  reply
    .code(429)
    .header("retry-after", "60")
    .send({ error: "try again later" });

export const registerIdentityEmailRoutes = (
  app: FastifyInstance,
  dependencies: EmailRouteDependencies,
): void => {
  app.post("/v1/auth/verification/resend", async (request, reply) => {
    if (!dependencies.verifyUnsafeRequest(request))
      return dependencies.sendForbidden(reply);
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid email" });
    const result = await dependencies.identityEmailService.resendVerification(
      parsed.data.email,
    );
    return result === "rate-limited"
      ? sendRateLimited(reply)
      : reply.code(202).send({ status: "accepted" });
  });

  app.post("/v1/auth/verification/confirm", async (request, reply) => {
    if (!dependencies.verifyUnsafeRequest(request))
      return dependencies.sendForbidden(reply);
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid or expired token" });
    const result = await dependencies.identityEmailService.confirmVerification(
      parsed.data.token,
    );
    return result === "confirmed"
      ? reply.code(204).send()
      : reply.code(400).send({ error: "invalid or expired token" });
  });

  app.post("/v1/auth/password/forgot", async (request, reply) => {
    if (!dependencies.verifyUnsafeRequest(request))
      return dependencies.sendForbidden(reply);
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid email" });
    const result = await dependencies.identityEmailService.requestPasswordReset(
      parsed.data.email,
    );
    return result === "rate-limited"
      ? sendRateLimited(reply)
      : reply.code(202).send({ status: "accepted" });
  });

  app.post("/v1/auth/password/reset", async (request, reply) => {
    if (!dependencies.verifyUnsafeRequest(request))
      return dependencies.sendForbidden(reply);
    const parsed = passwordResetSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid or expired token" });
    const result = await dependencies.identityEmailService.resetPassword(
      parsed.data,
    );
    return result === "reset"
      ? reply.code(204).send()
      : reply.code(400).send({ error: "invalid or expired token" });
  });
};
