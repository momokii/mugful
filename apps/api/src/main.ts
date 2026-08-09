import { createApp } from "./app.js";
import { parseApiConfig } from "./config.js";
import { createDatabaseConnection } from "./database.js";
import { rateLimitPrincipalPepperSchema } from "./identity/rate-limit.js";
import {
  buildLocalDevelopmentSessionCookieOptions,
  buildProductionSessionCookieOptions,
  sessionPepperSchema,
} from "./identity/session.js";
import { createIdentityService } from "./identity/service.js";

export const main = async (): Promise<void> => {
  const config = parseApiConfig(process.env);
  const database = createDatabaseConnection(config.databaseUrl);
  const productionCookies = process.env["NODE_ENV"] === "production";
  const expiresAt = new Date(Date.now() + 1000);
  const sessionCookie = productionCookies
    ? buildProductionSessionCookieOptions({ expiresAt, now: new Date() })
    : buildLocalDevelopmentSessionCookieOptions({ expiresAt, now: new Date() });
  const app = createApp({
    databaseChecker: database.checker,
    identity: {
      csrfSecret: config.csrfSecret,
      identityService: createIdentityService({
        rateLimitPrincipalPepper: rateLimitPrincipalPepperSchema.parse(
          config.rateLimitPrincipalPepper,
        ),
        repository: database.identityRepository,
        sessionPepper: sessionPepperSchema.parse(config.sessionTokenPepper),
      }),
      productionCookies,
      registrationEnabled: config.registrationDefaultEnabled,
      sessionCookieName: sessionCookie.name,
      webOrigin: config.webOrigin,
    },
  });

  app.addHook("onClose", async () => {
    await database.close();
  });

  await app.listen({ host: config.host, port: config.port });
};

void main().catch(() => {
  console.error("Mugful API startup failed.");
  process.exitCode = 1;
});
