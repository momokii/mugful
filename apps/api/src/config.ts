import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
  );

const secretSchema = z.string().min(32);
const smtpPortSchema = z.coerce.number().int().min(1).max(65_535);
const webOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const origin = new URL(value).origin;
    return value === origin || value === `${origin}/`;
  });

const apiConfigSchema = z
  .object({
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    CSRF_SECRET: secretSchema,
    DATABASE_URL: databaseUrlSchema,
    INVITE_TOKEN_PEPPER: secretSchema,
    LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    RATE_LIMIT_PRINCIPAL_PEPPER: secretSchema,
    REGISTRATION_DEFAULT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SESSION_TOKEN_PEPPER: secretSchema,
    IDENTITY_TOKEN_PEPPER: secretSchema,
    SMTP_FROM: z.string().min(3).max(320),
    SMTP_HOST: z.string().min(1).max(253),
    SMTP_PASS: z.string().min(1).optional(),
    SMTP_PORT: smtpPortSchema,
    SMTP_SECURE: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    SMTP_USER: z.string().min(1).optional(),
    SUPERADMIN_BOOTSTRAP_EMAIL: z
      .string()
      .email()
      .max(320)
      .default("admin@mugful.test"),
    SUPERADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).max(256).default("MugfulAdmin123!"),
    WEB_ORIGIN: webOriginSchema,
  })
  .superRefine((value, context) => {
    if ((value.SMTP_USER === undefined) !== (value.SMTP_PASS === undefined))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP credentials must be configured together",
      });
    if (
      value.NODE_ENV === "production" &&
      value.LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Local email-verification bypass is not allowed in production",
      });
  });

export type ApiConfig = Readonly<{
  csrfSecret: string;
  databaseUrl: string;
  host: string;
  identityTokenPepper: string;
  inviteTokenPepper: string;
  localAuthBypassEmailVerification: boolean;
  port: number;
  rateLimitPrincipalPepper: string;
  registrationDefaultEnabled: boolean;
  sessionTokenPepper: string;
  smtp: Readonly<{
    from: string;
    host: string;
    password: string | undefined;
    port: number;
    secure: boolean;
    username: string | undefined;
  }>;
  superadminBootstrapEmail: string;
  superadminBootstrapPassword: string;
  webOrigin: string;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

export const parseDatabaseUrl = (environment: Environment): string => {
  const result = databaseUrlSchema.safeParse(environment["DATABASE_URL"]);

  if (!result.success) {
    throw new Error("Invalid database configuration");
  }

  return result.data;
};

export const parseApiConfig = (environment: Environment): ApiConfig => {
  const result = apiConfigSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("Invalid API configuration");
  }

  return {
    csrfSecret: result.data.CSRF_SECRET,
    databaseUrl: result.data.DATABASE_URL,
    host: result.data.API_HOST,
    identityTokenPepper: result.data.IDENTITY_TOKEN_PEPPER,
    inviteTokenPepper: result.data.INVITE_TOKEN_PEPPER,
    localAuthBypassEmailVerification:
      result.data.LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION,
    port: result.data.API_PORT,
    rateLimitPrincipalPepper: result.data.RATE_LIMIT_PRINCIPAL_PEPPER,
    registrationDefaultEnabled: result.data.REGISTRATION_DEFAULT_ENABLED,
    sessionTokenPepper: result.data.SESSION_TOKEN_PEPPER,
    smtp: {
      from: result.data.SMTP_FROM,
      host: result.data.SMTP_HOST,
      password: result.data.SMTP_PASS,
      port: result.data.SMTP_PORT,
      secure: result.data.SMTP_SECURE,
      username: result.data.SMTP_USER,
    },
    superadminBootstrapEmail: result.data.SUPERADMIN_BOOTSTRAP_EMAIL,
    superadminBootstrapPassword: result.data.SUPERADMIN_BOOTSTRAP_PASSWORD,
    webOrigin: result.data.WEB_ORIGIN.replace(/\/$/, ""),
  };
};
