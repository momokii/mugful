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
      localAuthBypassEmailVerification: false,
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

  it("defaults local email-verification bypass to disabled", () => {
    // Given: valid configuration without a local bypass override
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

    // Then: email verification bypass remains disabled
    expect(config.localAuthBypassEmailVerification).toBe(false);
  });

  it.each(["development", "test"])(
    "accepts local email-verification bypass in %s",
    (nodeEnv) => {
      // Given: a development/test environment with the local bypass enabled
      const environment = {
        NODE_ENV: nodeEnv,
        LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION: "true",
        REGISTRATION_DEFAULT_ENABLED: "true",
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

      // Then: only the local bypass is enabled and registration stays independent
      expect(config.localAuthBypassEmailVerification).toBe(true);
      expect(config.registrationDefaultEnabled).toBe(true);
    },
  );

  it("rejects local email-verification bypass in production", () => {
    // Given: a production environment with the local bypass enabled
    const environment = {
      NODE_ENV: "production",
      LOCAL_AUTH_BYPASS_EMAIL_VERIFICATION: "true",
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
    const parse = (): void => {
      parseApiConfig(environment);
    };

    // Then: startup fails without exposing configuration details
    expect(parse).toThrow("Invalid API configuration");
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

  it("normalizes a trailing slash on the web origin", () => {
    // Given: a valid configuration whose web origin ends with a slash
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
      WEB_ORIGIN: "http://100.124.184.116:3002/",
    };

    // When: configuration is parsed
    const config = parseApiConfig(environment);

    // Then: consumers receive a normalized origin without the trailing slash
    expect(config.webOrigin).toBe("http://100.124.184.116:3002");
  });
});
