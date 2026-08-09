import fastify from "fastify";

import { registerIdentityRoutes } from "./identity/routes.js";
import type { IdentityEmailService } from "./identity/email-service.js";
import type { IdentityService } from "./identity/service.js";

export type DatabaseChecker = Readonly<{
  check: () => Promise<void>;
}>;

export type AppDependencies = Readonly<{
  databaseChecker: DatabaseChecker;
  identity?: Readonly<{
    csrfSecret: string;
    identityEmailService: IdentityEmailService;
    identityService: IdentityService;
    productionCookies: boolean;
    registrationEnabled: boolean;
    sessionCookieName: string;
    webOrigin: string;
  }>;
}>;

export const createApp = (dependencies: AppDependencies) => {
  const app = fastify({ logger: false });

  app.get("/health/live", () => ({ status: "live" }));

  app.get("/health/ready", (_request, reply) =>
    dependencies.databaseChecker
      .check()
      .then(() => reply.code(200).send({ status: "ready" }))
      .catch(() => reply.code(503).send({ status: "unavailable" })),
  );

  if (dependencies.identity !== undefined)
    registerIdentityRoutes(app, dependencies.identity);

  app.setErrorHandler((_error, _request, reply) => {
    reply.code(503).send({ status: "unavailable" });
  });

  return app;
};
