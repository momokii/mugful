import type { NextConfig } from "next";
import { z } from "zod";

const webConfigSchema = z.object({
  API_INTERNAL_ORIGIN: z.string().url(),
});

export type WebConfig = Readonly<{
  apiInternalOrigin: string;
}>;

type Environment = Readonly<Record<string, string | undefined>>;

export const parseWebConfig = (environment: Environment): WebConfig => {
  const result = webConfigSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("Invalid web configuration");
  }

  return {
    apiInternalOrigin: result.data.API_INTERNAL_ORIGIN.replace(/\/$/, ""),
  };
};

export const createNextConfig = (environment: Environment): NextConfig => {
  const config = parseWebConfig(environment);

  return {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: `${config.apiInternalOrigin}/:path*`,
        },
      ];
    },
  };
};

const nextConfig: NextConfig = {
  async rewrites() {
    return createNextConfig(process.env).rewrites?.() ?? [];
  },
};

export default nextConfig;
