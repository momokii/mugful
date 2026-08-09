import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSmtpMailer } from "./mailer.js";
import { hashPassword } from "./password.js";
import {
  createIdentityHttpTestContext,
  csrfFor,
  databaseTestsEnabled,
  resetIdentityData,
  unsafeHeaders,
} from "./http-test-support.js";

const mailpitUrl = process.env["MUGFUL_TEST_MAILPIT_URL"] ?? "";
const mailpitTestsEnabled = databaseTestsEnabled && mailpitUrl !== "";

const clearMailpit = async (): Promise<void> => {
  await fetch(`${mailpitUrl}/api/v1/messages`, { method: "DELETE" });
};

const latestMailText = async (): Promise<string> => {
  const response = await fetch(`${mailpitUrl}/view/latest.txt`);
  if (!response.ok) throw new Error("Expected a Mailpit message");
  return response.text();
};

const tokenFrom = (message: string, path: string): string => {
  const match = new RegExp(`${path}#token=([A-Za-z0-9_-]+)`).exec(message);
  if (match === null || match[1] === undefined)
    throw new Error("Expected a fragment token link");
  return match[1];
};

describe.skipIf(!mailpitTestsEnabled)("identity HTTP email commands", () => {
  let context: ReturnType<typeof createIdentityHttpTestContext>;

  beforeEach(async () => {
    context = createIdentityHttpTestContext(
      true,
      createSmtpMailer({
        from: "Mugful <noreply@mugful.test>",
        host: "127.0.0.1",
        password: undefined,
        port: Number(process.env["MUGFUL_TEST_SMTP_PORT"] ?? "51025"),
        secure: false,
        username: undefined,
      }),
    );
    await resetIdentityData(context.pool);
    await clearMailpit();
  });

  afterEach(async () => {
    await context.app.close();
    await context.pool.end();
  });

  it("issues a fragment verification link whose token is single-use and not persisted raw", async () => {
    // Given: a verified account and a signed, same-origin CSRF exchange
    const passwordHash = await hashPassword("correct horse battery staple");
    await context.pool.query(
      "INSERT INTO accounts (email, normalized_email, display_name, password_hash) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1)",
      [passwordHash],
    );
    const csrf = await csrfFor(context.app);

    // When: verification is resent and the delivered token is confirmed
    const resent = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verification/resend",
      headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
      payload: { email: "ada@example.test" },
    });
    const message = await latestMailText();
    const token = tokenFrom(message, "verify-email");
    const confirmed = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
      payload: { token },
    });
    const replay = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      headers: unsafeHeaders({ cookie: csrf.cookie, csrfToken: csrf.token }),
      payload: { token },
    });

    // Then: mail uses a fragment link and the token cannot be reused or leaked
    expect(resent.statusCode).toBe(202);
    expect(message).toContain(`verify-email#token=${token}`);
    expect(message).not.toContain(`?token=${token}`);
    expect(confirmed.statusCode).toBe(204);
    expect(replay.statusCode).toBe(400);
    expect(replay.body).not.toContain(token);
    const stored = await context.pool.query<Readonly<{ token_hash: string }>>(
      "SELECT token_hash FROM identity_tokens",
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.token_hash).not.toBe(token);
  });

  it("keeps absent recovery requests generic and revokes sessions after one reset", async () => {
    // Given: a verified account with an authenticated device and a CSRF exchange
    const passwordHash = await hashPassword("correct horse battery staple");
    await context.pool.query(
      "INSERT INTO accounts (email, normalized_email, display_name, password_hash, email_verified_at) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1, NOW())",
      [passwordHash],
    );
    const csrf = await csrfFor(context.app);
    const headers = unsafeHeaders({
      cookie: csrf.cookie,
      csrfToken: csrf.token,
    });
    const login = await context.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers,
      payload: {
        email: "ada@example.test",
        password: "correct horse battery staple",
      },
    });
    const sessionCookie = Array.isArray(login.headers["set-cookie"])
      ? login.headers["set-cookie"][0]
      : login.headers["set-cookie"];
    if (sessionCookie === undefined)
      throw new Error("Expected a session cookie");

    // When: an unknown address and then the account request recovery and reset the password
    const absent = await context.app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      headers,
      payload: { email: "absent@example.test" },
    });
    const absentMail = await fetch(`${mailpitUrl}/api/v1/message/latest/raw`);
    const requested = await context.app.inject({
      method: "POST",
      url: "/v1/auth/password/forgot",
      headers,
      payload: { email: "ada@example.test" },
    });
    const token = tokenFrom(await latestMailText(), "reset-password");
    const reset = await context.app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      headers,
      payload: { newPassword: "another correct battery staple", token },
    });
    const replay = await context.app.inject({
      method: "POST",
      url: "/v1/auth/password/reset",
      headers,
      payload: { newPassword: "third correct battery staple", token },
    });
    const oldSession = await context.app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: sessionCookie },
    });

    // Then: only the account gets mail, reset is single-use, and old sessions are invalid
    expect(absent.statusCode).toBe(202);
    expect(absentMail.status).toBe(404);
    expect(requested.statusCode).toBe(202);
    expect(reset.statusCode).toBe(204);
    expect(reset.headers["set-cookie"]).toBeUndefined();
    expect(replay.statusCode).toBe(400);
    expect(oldSession.statusCode).toBe(401);
  });

  it("retains a fresh token when SMTP is unavailable and replaces an expired token on retry", async () => {
    // Given: an unverified account, a CSRF exchange, and a mailer pointed at a stopped SMTP port
    const passwordHash = await hashPassword("correct horse battery staple");
    await context.pool.query(
      "INSERT INTO accounts (email, normalized_email, display_name, password_hash) VALUES ('ada@example.test', 'ada@example.test', 'Ada', $1)",
      [passwordHash],
    );
    const csrf = await csrfFor(context.app);
    const headers = unsafeHeaders({
      cookie: csrf.cookie,
      csrfToken: csrf.token,
    });
    const unavailable = createIdentityHttpTestContext(
      true,
      createSmtpMailer({
        from: "Mugful <noreply@mugful.test>",
        host: "127.0.0.1",
        password: undefined,
        port: Number(process.env["MUGFUL_TEST_STOPPED_SMTP_PORT"] ?? "51026"),
        secure: false,
        username: undefined,
      }),
    );

    // When: delivery fails, then a healthy resend creates a replacement token that expires
    const failedDelivery = await unavailable.app.inject({
      method: "POST",
      url: "/v1/auth/verification/resend",
      headers,
      payload: { email: "ada@example.test" },
    });
    await unavailable.app.close();
    await unavailable.pool.end();
    const recovered = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verification/resend",
      headers,
      payload: { email: "ada@example.test" },
    });
    const token = tokenFrom(await latestMailText(), "verify-email");
    await context.pool.query(
      "UPDATE identity_tokens SET expires_at = NOW() - INTERVAL '1 second'",
    );
    const expired = await context.app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      headers,
      payload: { token },
    });

    // Then: SMTP state is not disclosed, the retry mail is delivered, and expiry rejects use
    expect(failedDelivery.statusCode).toBe(202);
    expect(failedDelivery.body).not.toContain(token);
    expect(recovered.statusCode).toBe(202);
    expect(expired.statusCode).toBe(400);
    const tokens = await context.pool.query<Readonly<{ token_hash: string }>>(
      "SELECT token_hash FROM identity_tokens",
    );
    expect(tokens.rows).toHaveLength(1);
    expect(tokens.rows.every((row) => row.token_hash !== token)).toBe(true);
  });
});
