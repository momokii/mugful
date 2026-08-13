import fastify from "fastify";
import swagger from "@fastify/swagger";

import { registerIdentityRoutes } from "./identity/routes.js";
import { registerCoupleRoutes } from "./couples/routes.js";
import type { CoupleService } from "./couples/service.js";
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
  couples?: Readonly<{
    coupleService: CoupleService;
    csrfSecret: string;
    identityService: IdentityService;
    productionCookies: boolean;
    sessionCookieName: string;
    webOrigin: string;
  }>;
}>;

export const createApp = (dependencies: AppDependencies) => {
  const app = fastify({ logger: false });

  // Route schemas describe OpenAPI; existing Zod parsers remain the runtime boundary.
  app.setValidatorCompiler(() => (value) => ({ value }));

  void app.register(swagger, {
    openapi: {
      info: { title: "Mugful API", version: "v1" },
      components: {
        securitySchemes: {
          csrfCookie: { in: "cookie", name: "mugful-csrf", type: "apiKey" },
          csrfToken: { in: "header", name: "x-csrf-token", type: "apiKey" },
          sessionCookie: {
            in: "cookie",
            name: "mugful-session",
            type: "apiKey",
          },
        },
      },
    },
  });

  app.get("/health/live", () => ({ status: "live" }));

  app.get("/health/ready", (_request, reply) =>
    dependencies.databaseChecker
      .check()
      .then(() => reply.code(200).send({ status: "ready" }))
      .catch(() => reply.code(503).send({ status: "unavailable" })),
  );

  app.after(() => {
    if (dependencies.identity !== undefined)
      registerIdentityRoutes(app, dependencies.identity);
    if (dependencies.couples !== undefined)
      registerCoupleRoutes(app, dependencies.couples);

    app.get("/openapi.json", { schema: { hide: true } }, () => app.swagger());
  });

  app.setErrorHandler((_error, _request, reply) => {
    reply.code(503).send({ status: "unavailable" });
  });

  return app;
};
