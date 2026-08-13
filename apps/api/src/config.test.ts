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
      CSRF_SECRET: "c".repeat(32),
      RATE_LIMIT_PRINCIPAL_PEPPER: "r".repeat(32),
      SESSION_TOKEN_PEPPER: "s".repeat(32),
      IDENTITY_TOKEN_PEPPER: "t".repeat(32),
      INVITE_TOKEN_PEPPER: "i".repeat(32),
      SMTP_FROM: "Mugful <noreply@mugful.test>",
      SMTP_HOST: "mailpit",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      WEB_ORIGIN: "https://mugful.example",
    };

    // When: configuration is parsed
    const config = parseApiConfig(environment);

    // Then: the runtime receives normalized primitive values
    expect(config).toEqual({
      host: "127.0.0.1",
      port: 3001,
      databaseUrl:
        "postgresql://mugful:local-only-password@127.0.0.1:5432/mugful",
      csrfSecret: "c".repeat(32),
      identityTokenPepper: "t".repeat(32),
      inviteTokenPepper: "i".repeat(32),
      rateLimitPrincipalPepper: "r".repeat(32),
      registrationDefaultEnabled: false,
      sessionTokenPepper: "s".repeat(32),
      smtp: {
        from: "Mugful <noreply@mugful.test>",
        host: "mailpit",
        password: undefined,
        port: 1025,
        secure: false,
        username: undefined,
      },
      webOrigin: "https://mugful.example",
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

  it("defaults registration to disabled when no override is supplied", () => {
    // Given: valid identity configuration without a registration override
    const environment = {
      DATABASE_URL:
        "postgresql://mugful:local-only-password@127.0.0.1:5432/mugful",
      CSRF_SECRET: "c".repeat(32),
      RATE_LIMIT_PRINCIPAL_PEPPER: "r".repeat(32),
      SESSION_TOKEN_PEPPER: "s".repeat(32),
      IDENTITY_TOKEN_PEPPER: "t".repeat(32),
      INVITE_TOKEN_PEPPER: "i".repeat(32),
      SMTP_FROM: "Mugful <noreply@mugful.test>",
      SMTP_HOST: "mailpit",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      WEB_ORIGIN: "https://mugful.example",
    };

    // When: configuration is parsed
    const config = parseApiConfig(environment);

    // Then: registration remains closed until explicitly enabled
    expect(config.registrationDefaultEnabled).toBe(false);
  });

  it("rejects a web URL that is not an origin", () => {
    // Given: an otherwise valid configuration with a path-bearing web URL
    const environment = {
      DATABASE_URL:
        "postgresql://mugful:local-only-password@127.0.0.1:5432/mugful",
      CSRF_SECRET: "c".repeat(32),
      RATE_LIMIT_PRINCIPAL_PEPPER: "r".repeat(32),
      SESSION_TOKEN_PEPPER: "s".repeat(32),
      IDENTITY_TOKEN_PEPPER: "t".repeat(32),
      INVITE_TOKEN_PEPPER: "i".repeat(32),
      SMTP_FROM: "Mugful <noreply@mugful.test>",
      SMTP_HOST: "mailpit",
      SMTP_PORT: "1025",
      SMTP_SECURE: "false",
      WEB_ORIGIN: "https://mugful.example/login",
    };

    // When: configuration is parsed
    const parse = (): void => {
      parseApiConfig(environment);
    };

    // Then: an origin-only policy rejects the path
    expect(parse).toThrow("Invalid API configuration");
  });
});
