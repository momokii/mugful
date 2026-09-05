import { createApp } from "./app.js";
import { parseApiConfig } from "./config.js";
import { createDatabaseConnection } from "./database.js";
import { createIdentityEmailService } from "./identity/email-service.js";
import { createSmtpMailer } from "./identity/mailer.js";
import { rateLimitPrincipalPepperSchema } from "./identity/rate-limit.js";
import {
  sessionCookiePolicyForPublicOrigin,
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
import { createGuessMyAnswerService } from "./activities/guess-my-answer/service.js";
import type { GuessMyAnswerService } from "./activities/guess-my-answer/service.js";
import { createPrivacyService } from "./privacy/service.js";
import { Server as SocketIOServer } from "socket.io";
import {
  wireRealtimeGateway,
  type RoundEventBus,
} from "./activities/guess-my-answer/realtime.js";
import type { IdentityService } from "./identity/service.js";

export const main = async (): Promise<void> => {
  const config = parseApiConfig(process.env);
  const database = createDatabaseConnection(config.databaseUrl);
  const cookiePolicy = sessionCookiePolicyForPublicOrigin(config.webOrigin);
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
  const roundService = createGuessMyAnswerService({
    repository: database.identityRepository,
  });
  const privacyService = createPrivacyService({
    repository: database.identityRepository,
  });
  const activitiesDependencies: {
    csrfSecret: string;
    events: RoundEventBus | undefined;
    identityService: IdentityService;
    productionCookies: boolean;
    roundService: GuessMyAnswerService;
    sessionCookieName: string;
    webOrigin: string;
  } = {
    csrfSecret: config.csrfSecret,
    events: undefined,
    identityService,
    productionCookies: cookiePolicy.secure,
    roundService,
    sessionCookieName: cookiePolicy.name,
    webOrigin: config.webOrigin,
  };
  const app = createApp({
    databaseChecker: database.checker,
    identity: {
      csrfSecret: config.csrfSecret,
      identityEmailService,
      identityService,
      productionCookies: cookiePolicy.secure,
      registrationEnabled: config.registrationDefaultEnabled,
      sessionCookieName: cookiePolicy.name,
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
      productionCookies: cookiePolicy.secure,
      sessionCookieName: cookiePolicy.name,
      webOrigin: config.webOrigin,
    },
    superadmin: {
      ceremony: superadminCeremony,
      csrfSecret: config.csrfSecret,
      identityService,
      mfaService: superadminMfaService,
      productionCookies: cookiePolicy.secure,
      promptService: createPromptCatalogService({
        repository: database.identityRepository,
      }),
      sessionCookieName: cookiePolicy.name,
      superadminService,
      webOrigin: config.webOrigin,
    },
    activities: activitiesDependencies,
    privacy: {
      csrfSecret: config.csrfSecret,
      identityService,
      privacyService,
      productionCookies: cookiePolicy.secure,
      sessionCookieName: cookiePolicy.name,
      webOrigin: config.webOrigin,
    },
  });

  const io = new SocketIOServer(app.server, {
    cors: { credentials: true, origin: config.webOrigin },
    path: "/api/socket.io",
  });
  activitiesDependencies.events = wireRealtimeGateway(io, {
    identityService,
    roundService,
    sessionCookieName: cookiePolicy.name,
  });

  app.addHook("onClose", async () => {
    io.close();
    await database.close();
  });

  await app.ready();
  await app.server.listen({ host: config.host, port: config.port });
};

void main().catch(() => {
  console.error("Mugful API startup failed.");
  process.exitCode = 1;
});
