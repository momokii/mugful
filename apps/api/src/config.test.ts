import { describe, expect, it } from "vitest";

import { parseApiConfig } from "./config.js";

describe("parseApiConfig", () => {
  it("returns typed API configuration for valid environment values", () => {
    // Given: valid API environment values
    const environment = {
      API_HOST: "127.0.0.1",
      API_PORT: "3001",
      DATABASE_URL:
        "postgresql://mugful:local-only-password@127.0.0.1:5432/mugful",
    };

    // When: configuration is parsed
    const config = parseApiConfig(environment);

    // Then: the runtime receives normalized primitive values
    expect(config).toEqual({
      host: "127.0.0.1",
      port: 3001,
      databaseUrl:
        "postgresql://mugful:local-only-password@127.0.0.1:5432/mugful",
    });
  });

  it("rejects missing or malformed database configuration without echoing it", () => {
    // Given: an invalid database URL that must not be exposed
    const environment = { DATABASE_URL: "not-a-database-url" };

    // When: configuration is parsed
    const parse = (): void => {
      parseApiConfig(environment);
    };

    // Then: startup fails with a generic configuration error
    expect(parse).toThrow("Invalid API configuration");
    expect(parse).not.toThrow("not-a-database-url");
  });
});
