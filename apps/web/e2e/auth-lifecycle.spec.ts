import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  baseUrl,
  mailpitToken,
  mailpitUrl,
  required,
  waitForMailpitMessages,
} from "./auth-test-support";

const apiOrigin = process.env["MUGFUL_TEST_API_ORIGIN"];
const registrationClosed =
  process.env["MUGFUL_TEST_REGISTRATION_CLOSED"] === "true";

const uniqueEmail = (): string => `browser-${randomUUID()}@mugful.test`;

test.describe.configure({ mode: "serial" });

test("registration, verification, sessions, reset, and password change use isolated browser data", async ({
  browser,
  page,
}, testInfo) => {
  test.skip(
    registrationClosed,
    "This lifecycle requires enabled registration.",
  );
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
  await waitForMailpitMessages(mailpit, 1);
  const verifyToken = await mailpitToken(mailpit, "/verify-email");

  const tokenRequests: string[] = [];
  page.on("request", (request) => tokenRequests.push(request.url()));
  await page.goto(`/verify-email#token=${verifyToken}`);
  await expect(page).toHaveURL(/\/verify-email$/);
  const tokenScreenshot = testInfo.outputPath("verification-page.png");
  await page.screenshot({ path: tokenScreenshot });
  expect(page.url()).not.toContain(verifyToken);
  expect(tokenRequests.some((url) => url.includes(verifyToken))).toBe(false);
  expect(
    Buffer.from(await readFile(tokenScreenshot)).includes(
      Buffer.from(verifyToken),
    ),
  ).toBe(false);
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
    const sessionIds = await page.evaluate(async () => {
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
      const ids = body.sessions.flatMap((session) =>
        typeof session === "object" &&
        session !== null &&
        "deviceLabel" in session &&
        "id" in session &&
        typeof session.id === "string" &&
        typeof session.deviceLabel === "string"
          ? [{ id: session.id, label: session.deviceLabel }]
          : [],
      );
      const direct = ids.find(
        (session) => session.label === "Mugful lifecycle second session",
      );
      const proxy = ids.find(
        (session) => session.label === "Mugful lifecycle revoke target",
      );
      if (direct === undefined || proxy === undefined)
        throw new Error("Target browser sessions were not found");
      return { direct: direct.id, proxy: proxy.id };
    });
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
      `${required(apiOrigin, "MUGFUL_TEST_API_ORIGIN")}/v1/auth/sessions/${sessionIds.direct}`,
      {
        headers: {
          cookie: cookieHeader,
          origin: baseUrl,
          "x-csrf-token": csrfToken,
        },
        method: "DELETE",
      },
    );
    expect(direct.status).toBe(204);
    await expect
      .poll(async () =>
        secondPage.evaluate(
          async () =>
            (
              await fetch("/api/v1/auth/session", {
                credentials: "same-origin",
              })
            ).status,
        ),
      )
      .toBe(401);
    const revoke = page
      .locator(`li[data-session-id="${sessionIds.proxy}"]`)
      .getByRole("button", { name: "Revoke" });
    const deletion = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().endsWith(`/api/v1/auth/sessions/${sessionIds.proxy}`),
    );
    await revoke.click();
    const deletionResponse = await deletion;
    expect(deletionResponse.status()).toBe(204);
    const headers = await deletionResponse.request().allHeaders();
    expect(headers["content-type"]).toBeUndefined();
    expect(headers["origin"]).toBe(baseUrl);
    const cookieNames = (headers["cookie"] ?? "")
      .split(";")
      .map((item) => item.trim().split("=", 1)[0])
      .filter((name): name is string => name !== undefined && name !== "")
      .sort();
    expect(cookieNames).toEqual(["mugful-csrf", "mugful-session"]);
    expect(headers["x-csrf-token"]).toBeDefined();
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
    await waitForMailpitMessages(mailpit, 2);
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
