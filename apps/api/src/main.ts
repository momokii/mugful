import { createApp } from "./app.js";
import { parseApiConfig } from "./config.js";
import { createDatabaseConnection } from "./database.js";
import { createIdentityEmailService } from "./identity/email-service.js";
import { createSmtpMailer } from "./identity/mailer.js";
import { rateLimitPrincipalPepperSchema } from "./identity/rate-limit.js";
import {
  buildLocalDevelopmentSessionCookieOptions,
  buildProductionSessionCookieOptions,
  sessionPepperSchema,
} from "./identity/session.js";
import { createIdentityService } from "./identity/service.js";
import { tokenPepperSchema } from "./identity/token.js";

export const main = async (): Promise<void> => {
  const config = parseApiConfig(process.env);
  const database = createDatabaseConnection(config.databaseUrl);
  const productionCookies = process.env["NODE_ENV"] === "production";
  const expiresAt = new Date(Date.now() + 1000);
  const sessionCookie = productionCookies
    ? buildProductionSessionCookieOptions({ expiresAt, now: new Date() })
    : buildLocalDevelopmentSessionCookieOptions({ expiresAt, now: new Date() });
  const identityEmailService = createIdentityEmailService({
    mailer: createSmtpMailer(config.smtp),
    publicOrigin: config.webOrigin,
    rateLimitPrincipalPepper: rateLimitPrincipalPepperSchema.parse(
      config.rateLimitPrincipalPepper,
    ),
    repository: database.identityRepository,
    tokenPepper: tokenPepperSchema.parse(config.identityTokenPepper),
  });
  const app = createApp({
    databaseChecker: database.checker,
    identity: {
      csrfSecret: config.csrfSecret,
      identityEmailService,
      identityService: createIdentityService({
        emailService: identityEmailService,
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
