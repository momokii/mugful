import { describe, expect, it } from "vitest";

import { createNextConfig, parseWebConfig } from "../next.config.js";

describe("web runtime configuration", () => {
  it("rejects a missing API internal origin", () => {
    // Given: no server-side API origin
    const environment = {};

    // When: configuration is parsed
    const parse = (): void => {
      parseWebConfig(environment);
    };

    // Then: Next startup receives a generic configuration error
    expect(parse).toThrow("Invalid web configuration");
  });

  it("rewrites the API prefix exactly once", async () => {
    // Given: a valid internal Fastify origin
    const config = createNextConfig({
      API_INTERNAL_ORIGIN: "http://127.0.0.1:3001",
    });

    // When: Next resolves rewrites
    const rewrites = await config.rewrites?.();

    // Then: /api/health/live becomes /health/live upstream
    expect(rewrites).toEqual([
      {
        destination: "http://127.0.0.1:3001/:path*",
        source: "/api/:path*",
      },
    ]);
  });
});
