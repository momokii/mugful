import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const mailpitUrl = process.env["MUGFUL_TEST_MAILPIT_URL"];
const baseUrl = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3100";
const apiOrigin = process.env["MUGFUL_TEST_API_ORIGIN"];

const required = (value: string | undefined, name: string): string => {
  if (value === undefined)
    throw new Error(`${name} is required for the auth lifecycle`);
  return value;
};

const uniqueEmail = (): string => `browser-${randomUUID()}@mugful.test`;

const tokenFromMessage = (message: string): string => {
  const match = message.match(/#token=([^\s"<]+)/);
  if (match?.[1] === undefined)
    throw new Error("Mailpit message did not include a fragment token");
  return match[1];
};

type SanitizableResponse = Readonly<{
  status: () => number;
  text: () => Promise<string>;
}>;

const sanitizedResult = async (
  response: SanitizableResponse,
): Promise<string> => {
  const text = await response.text();
  return `${response.status()}:${text.slice(0, 120)}`;
};

const mailpitToken = async (mailpit: string, path: string): Promise<string> => {
  const response = await fetch(`${mailpit}/api/v1/messages`);
  const list: unknown = await response.json();
  if (
    typeof list !== "object" ||
    list === null ||
    !("messages" in list) ||
    !Array.isArray(list.messages)
  )
    throw new Error("Mailpit messages response is invalid");
  for (const item of list.messages) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("ID" in item) ||
      typeof item.ID !== "string"
    )
      continue;
    const messageResponse = await fetch(`${mailpit}/api/v1/message/${item.ID}`);
    const message: unknown = await messageResponse.json();
    const text =
      typeof message === "object" &&
      message !== null &&
      "Text" in message &&
      typeof message.Text === "string"
        ? message.Text
        : "";
    if (text.includes(path)) return tokenFromMessage(text);
  }
  throw new Error(`Mailpit did not include a ${path} message`);
};

test.describe.configure({ mode: "serial" });

test("registration, verification, sessions, reset, and password change use isolated browser data", async ({
  browser,
  page,
}) => {
  const email = uniqueEmail();
  const password = "browser-lifecycle-password";
  const replacementPassword = "browser-replacement-password";

  await page.goto("/register");
  await page.getByLabel("Your name").fill("Browser lifecycle");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Create a password").fill(password);
  await page.getByLabel(/I confirm that I am at least 18/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();

  const mailpit = required(mailpitUrl, "MUGFUL_TEST_MAILPIT_URL");
  await expect
    .poll(async () => {
      const response = await fetch(`${mailpit}/api/v1/messages`);
      const body: unknown = await response.json();
      return typeof body === "object" &&
        body !== null &&
        "messages" in body &&
        Array.isArray(body.messages)
        ? body.messages.length
        : 0;
    })
    .toBeGreaterThan(0);
  const verifyToken = await mailpitToken(mailpit, "/verify-email");

  await page.goto(`/verify-email#token=${verifyToken}`);
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByText(/email address is verified/i)).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/settings\/security$/);

  const secondContext = await browser.newContext({
    baseURL: baseUrl,
    userAgent: "Mugful lifecycle second session",
  });
  const secondPage = await secondContext.newPage();
  const thirdContext = await browser.newContext({
    baseURL: baseUrl,
    userAgent: "Mugful lifecycle revoke target",
  });
  const thirdPage = await thirdContext.newPage();
  try {
    await secondPage.goto("/login");
    await secondPage.getByLabel("Email address").fill(email);
    await secondPage.getByLabel("Password").fill(password);
    await secondPage.getByRole("button", { name: "Continue" }).click();
    await expect(secondPage).toHaveURL(/\/settings\/security$/);
    await thirdPage.goto("/login");
    await thirdPage.getByLabel("Email address").fill(email);
    await thirdPage.getByLabel("Password").fill(password);
    await thirdPage.getByRole("button", { name: "Continue" }).click();
    await expect(thirdPage).toHaveURL(/\/settings\/security$/);
    await page.reload();
    const targetId = await thirdPage.evaluate(async () => {
      const response = await fetch("/api/v1/auth/sessions", {
        credentials: "same-origin",
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        typeof body !== "object" ||
        body === null ||
        !("sessions" in body) ||
        !Array.isArray(body.sessions)
      )
        throw new Error("Target browser session listing is invalid");
      const target = body.sessions.find(
        (session) =>
          typeof session === "object" &&
          session !== null &&
          "deviceLabel" in session &&
          session.deviceLabel === "Mugful lifecycle revoke target" &&
          "id" in session &&
          typeof session.id === "string",
      );
      if (
        target === undefined ||
        typeof target !== "object" ||
        target === null ||
        !("id" in target) ||
        typeof target.id !== "string"
      )
        throw new Error("Target browser session was not found");
      return target.id;
    });
    const revoke = page
      .locator(`li[data-session-id="${targetId}"]`)
      .getByRole("button", { name: "Revoke" });
    const deletion = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().endsWith(`/api/v1/auth/sessions/${targetId}`),
    );
    await revoke.click();
    const deletionResponse = await deletion;
    if (deletionResponse.status() !== 204) {
      const csrfToken = await page.evaluate(async () => {
        const response = await fetch("/api/v1/csrf", {
          credentials: "same-origin",
        });
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("csrfToken" in body) ||
          typeof body.csrfToken !== "string"
        )
          throw new Error("CSRF response is invalid");
        return body.csrfToken;
      });
      const cookies = await page.context().cookies(baseUrl);
      const cookieHeader = cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join("; ");
      const direct = await fetch(
        `${required(apiOrigin, "MUGFUL_TEST_API_ORIGIN")}/v1/auth/sessions/${targetId}`,
        {
          headers: {
            cookie: cookieHeader,
            origin: baseUrl,
            "x-csrf-token": csrfToken,
          },
          method: "DELETE",
        },
      );
      throw new Error(
        `Session revoke comparison: proxy=${await sanitizedResult(deletionResponse)} direct=${direct.status}:${(await direct.text()).slice(0, 120)}`,
      );
    }
    await expect
      .poll(async () =>
        thirdPage.evaluate(
          async () =>
            (
              await fetch("/api/v1/auth/session", {
                credentials: "same-origin",
              })
            ).status,
        ),
      )
      .toBe(401);
    await thirdPage.goto("/settings/security");
    await expect(thirdPage.getByText(/sign in to review/i)).toBeVisible();

    await page.getByLabel("Current password").fill(password);
    await page.getByLabel("New password").fill(replacementPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/done/i)).toBeVisible();
    await page.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
    await expect
      .poll(async () => {
        const response = await fetch(`${mailpit}/api/v1/messages`);
        const body: unknown = await response.json();
        return typeof body === "object" &&
          body !== null &&
          "messages" in body &&
          Array.isArray(body.messages)
          ? body.messages.length
          : 0;
      })
      .toBeGreaterThan(1);
    const resetToken = await mailpitToken(mailpit, "/reset-password");
    await page.goto(`/reset-password#token=${resetToken}`);
    await page.getByLabel("New password").fill(password);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/done/i)).toBeVisible();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/settings\/security$/);
  } finally {
    await secondContext.close();
    await thirdContext.close();
  }
});

test("token pages prevent referrers, avoid cache, and fit each visual viewport", async ({
  browser,
}) => {
  for (const width of [375, 768, 1280]) {
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { height: 900, width },
    });
    const page = await context.newPage();
    const response = await page.goto("/reset-password#token=not-a-real-token");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page).toHaveURL(/\/reset-password$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await context.close();
  }
});
