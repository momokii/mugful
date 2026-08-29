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
import { inviteTokenPepperSchema } from "./couples/invite-token.js";
import { createCoupleService } from "./couples/service.js";
import { createPromptCatalogService } from "./prompts/service.js";
import { createSuperadminMfaService } from "./superadmin/mfa.js";
import { createSuperadminService } from "./superadmin/service.js";
import { createSuperadminWebauthnService } from "./superadmin/webauthn.js";

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
  const identityService = createIdentityService({
    emailService: identityEmailService,
    localAuthBypassEmailVerification: config.localAuthBypassEmailVerification,
    rateLimitPrincipalPepper: rateLimitPrincipalPepperSchema.parse(
      config.rateLimitPrincipalPepper,
    ),
    repository: database.identityRepository,
    sessionPepper: sessionPepperSchema.parse(config.sessionTokenPepper),
  });
  const superadminService = createSuperadminService({
    repository: database.identityRepository,
  });
  const superadminMfaService = createSuperadminMfaService({
    repository: database.identityRepository,
  });
  const superadminCeremony = createSuperadminWebauthnService({
    origin: config.webOrigin,
    repository: database.identityRepository,
    rpID: new URL(config.webOrigin).hostname,
    rpName: "Mugful",
    superadminService,
  });
  const app = createApp({
    databaseChecker: database.checker,
    identity: {
      csrfSecret: config.csrfSecret,
      identityEmailService,
      identityService,
      productionCookies,
      registrationEnabled: config.registrationDefaultEnabled,
      sessionCookieName: sessionCookie.name,
      webOrigin: config.webOrigin,
    },
    couples: {
      coupleService: createCoupleService({
        inviteTokenPepper: inviteTokenPepperSchema.parse(
          config.inviteTokenPepper,
        ),
        repository: database.identityRepository,
      }),
      csrfSecret: config.csrfSecret,
      identityService,
      productionCookies,
      sessionCookieName: sessionCookie.name,
      webOrigin: config.webOrigin,
    },
    superadmin: {
      ceremony: superadminCeremony,
      csrfSecret: config.csrfSecret,
      identityService,
      mfaService: superadminMfaService,
      productionCookies,
      promptService: createPromptCatalogService({
        repository: database.identityRepository,
      }),
      sessionCookieName: sessionCookie.name,
      superadminService,
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
