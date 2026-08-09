import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      value.startsWith("postgresql://") || value.startsWith("postgres://"),
  );

const apiConfigSchema = z.object({
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: databaseUrlSchema,
});

export type ApiConfig = Readonly<{
  host: string;
  port: number;
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
    host: result.data.API_HOST,
    port: result.data.API_PORT,
    databaseUrl: result.data.DATABASE_URL,
  };
};
