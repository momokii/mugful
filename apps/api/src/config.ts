import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
  );

const secretSchema = z.string().min(32);

const apiConfigSchema = z.object({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  CSRF_SECRET: secretSchema,
  DATABASE_URL: databaseUrlSchema,
  RATE_LIMIT_PRINCIPAL_PEPPER: secretSchema,
  REGISTRATION_DEFAULT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SESSION_TOKEN_PEPPER: secretSchema,
  WEB_ORIGIN: z.string().url(),
});

export type ApiConfig = Readonly<{
  csrfSecret: string;
  host: string;
  port: number;
  rateLimitPrincipalPepper: string;
  registrationDefaultEnabled: boolean;
  sessionTokenPepper: string;
  webOrigin: string;
  databaseUrl: string;
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
    host: result.data.API_HOST,
    port: result.data.API_PORT,
    rateLimitPrincipalPepper: result.data.RATE_LIMIT_PRINCIPAL_PEPPER,
    registrationDefaultEnabled: result.data.REGISTRATION_DEFAULT_ENABLED,
    sessionTokenPepper: result.data.SESSION_TOKEN_PEPPER,
    webOrigin: result.data.WEB_ORIGIN.replace(/\/$/, ""),
    databaseUrl: result.data.DATABASE_URL,
  };
};
