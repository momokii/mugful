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
import { hash } from "@node-rs/argon2";
import { Pool } from "pg";

import { Server as SocketIOServer } from "socket.io";
import {
  wireRealtimeGateway,
  type RoundEventBus,
} from "./activities/guess-my-answer/realtime.js";
import type { IdentityService } from "./identity/service.js";

const ensureInitialSuperadmin = async (input: {
  bootstrapEmail: string;
  bootstrapPassword: string;
  databaseUrl: string;
}): Promise<void> => {
  const normalizedEmail = input.bootstrapEmail.trim().toLowerCase();
  const pool = new Pool({
    connectionString: input.databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    max: 2,
  });
  try {
    const existing = await pool.query(
      "SELECT count(*)::int AS count FROM superadmin_accounts WHERE revoked_at IS NULL",
    );
    if ((existing.rows[0]?.count ?? 0) > 0) return;
    const passwordHash = await hash(input.bootstrapPassword);
    const accountResult = await pool.query(
      `INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (normalized_email) DO UPDATE SET email_verified_at = COALESCE(accounts.email_verified_at, now())
       RETURNING id`,
      [input.bootstrapEmail, normalizedEmail, "Admin", passwordHash],
    );
    const accountId: string | undefined = accountResult.rows[0]?.id
      ?? (
        await pool.query("SELECT id FROM accounts WHERE normalized_email = $1", [
          normalizedEmail,
        ])
      ).rows[0]?.id;
    if (accountId === undefined) return;
    await pool.query(
      "INSERT INTO superadmin_accounts (account_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [accountId],
    );
    console.log(`Bootstrap superadmin ensured: ${input.bootstrapEmail}`);
  } catch (error) {
    console.warn("Superadmin bootstrap check failed (will retry on next deploy):", error);
  } finally {
    await pool.end().catch(() => undefined);
  }
};

export const main = async (): Promise<void> => {
  const config = parseApiConfig(process.env);
  const database = createDatabaseConnection(config.databaseUrl);
  await ensureInitialSuperadmin({
    bootstrapEmail: config.superadminBootstrapEmail,
    bootstrapPassword: config.superadminBootstrapPassword,
    databaseUrl: config.databaseUrl,
  });
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
