import { Pool } from "pg";

import { createApp } from "../app.js";
import { createIdentityEmailService } from "./email-service.js";
import type { IdentityMailer } from "./mailer.js";
import { createIdentityRepository } from "./repository.js";
import { rateLimitPrincipalPepperSchema } from "./rate-limit.js";
import { sessionPepperSchema } from "./session.js";
import { createIdentityService } from "./service.js";
import { tokenPepperSchema } from "./token.js";
import { createCoupleService } from "../couples/service.js";
import { inviteTokenPepperSchema } from "../couples/invite-token.js";

const databaseUrl = process.env["MUGFUL_TEST_DATABASE_URL"] ?? "";
export const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true" && databaseUrl !== "";

export const createIdentityHttpTestContext = (
  registrationEnabled = false,
  mailer: IdentityMailer = { send: async () => undefined },
) => {
  const pool = new Pool({ connectionString: databaseUrl });
  const identityEmailService = createIdentityEmailService({
    mailer,
    publicOrigin: "https://mugful.test",
    rateLimitPrincipalPepper: rateLimitPrincipalPepperSchema.parse(
      "r".repeat(32),
    ),
    repository: createIdentityRepository(pool),
    tokenPepper: tokenPepperSchema.parse("t".repeat(32)),
  });
  const identityService = createIdentityService({
    emailService: identityEmailService,
    rateLimitPrincipalPepper: rateLimitPrincipalPepperSchema.parse(
      "r".repeat(32),
    ),
    repository: createIdentityRepository(pool),
    sessionPepper: sessionPepperSchema.parse("s".repeat(32)),
  });
  const app = createApp({
    databaseChecker: { check: async () => undefined },
    identity: {
      csrfSecret: "c".repeat(32),
      identityEmailService,
      identityService,
      productionCookies: false,
      registrationEnabled,
      sessionCookieName: "mugful-session",
      webOrigin: "https://mugful.test",
    },
    couples: {
      coupleService: createCoupleService({
        inviteTokenPepper: inviteTokenPepperSchema.parse("i".repeat(32)),
        repository: createIdentityRepository(pool),
      }),
      csrfSecret: "c".repeat(32),
      identityService,
      productionCookies: false,
      sessionCookieName: "mugful-session",
      webOrigin: "https://mugful.test",
    },
  });

  return { app, pool };
};

export const cookieFromResponse = (
  value: string | string[] | number | undefined,
): string => {
  const header = Array.isArray(value) ? value[0] : value;
  if (typeof header !== "string")
    throw new Error("Expected a cookie response header");
  const [cookie] = header.split(";", 1);
  if (cookie === undefined) throw new Error("Expected a cookie value");
  return cookie;
};

export const csrfFor = async (
  app: ReturnType<typeof createIdentityHttpTestContext>["app"],
) => {
  const response = await app.inject({ method: "GET", url: "/v1/csrf" });
  return {
    cookie: cookieFromResponse(response.headers["set-cookie"]),
    token: response.json<Readonly<{ csrfToken: string }>>().csrfToken,
  };
};

export const unsafeHeaders = (
  input: Readonly<{ cookie: string; csrfToken: string }>,
) => ({
  cookie: input.cookie,
  origin: "https://mugful.test",
  "x-csrf-token": input.csrfToken,
});

export const resetIdentityData = async (pool: Pool): Promise<void> => {
  await pool.query(
    "TRUNCATE accounts, rate_limit_buckets, couple_spaces, couple_memberships, couple_invites CASCADE",
  );
};
