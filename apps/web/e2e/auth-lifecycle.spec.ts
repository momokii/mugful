import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  baseUrl,
  mailpitUrl,
  required,
  waitForMailpitMessages,
  waitForMailpitToken,
} from "./auth-test-support";
import { checkAuthPageMatrix } from "./auth-page-matrix";

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
  const registrationPassword = page.getByLabel("Create a password");
  await expect(registrationPassword).toHaveAccessibleDescription(
    "At least 12 characters.",
  );
  const registrationPasswordField = registrationPassword.locator("..");
  await registrationPasswordField
    .getByRole("button", { name: "Show password" })
    .click();
  await expect(registrationPassword).toHaveAttribute("type", "text");
  await expect(registrationPassword).toHaveValue(password);
  await expect(
    registrationPasswordField.getByRole("button", { name: "Hide password" }),
  ).toBeFocused();
  await registrationPasswordField
    .getByRole("button", { name: "Hide password" })
    .click();
  await expect(registrationPassword).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  await page.getByLabel("Confirm password").fill("short");
  await expect(
    page.getByLabel(/Saya menyatakan bahwa saya berusia minimal 18 tahun/i),
  ).not.toBeChecked();
  await expect(
    page.getByLabel(/Saya menyetujui Syarat dan Ketentuan/i),
  ).not.toBeChecked();
  await expect(
    page.getByLabel(/Saya telah membaca dan menyetujui Pemberitahuan Privasi/i),
  ).not.toBeChecked();
  await page
    .getByLabel(/Saya menyatakan bahwa saya berusia minimal 18 tahun/i)
    .check();
  await page.getByLabel(/Saya menyetujui Syarat dan Ketentuan/i).check();
  await page
    .getByLabel(/Saya telah membaca dan menyetujui Pemberitahuan Privasi/i)
    .check();
  const registrationMutations: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/auth/register")
    )
      registrationMutations.push(request.url());
  });
  await page.getByRole("button", { name: "Create account" }).click();
  const registrationConfirmation = page.getByLabel("Confirm password", {
    exact: true,
  });
  const registrationConfirmationField =
    registrationConfirmation.locator("../..");
  await expect(registrationConfirmation).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(registrationConfirmation).toHaveAttribute(
    "aria-describedby",
    "passwordConfirmation-hint password-confirmation-error",
  );
  await expect(registrationConfirmation).toBeFocused();
  await expect(
    registrationConfirmationField.locator("p#password-confirmation-error"),
  ).toHaveText(/^Passwords do not match\.$/);
  expect(registrationMutations).toEqual([]);
  await registrationPassword.fill("short");
  await expect(registrationConfirmation).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    registrationConfirmationField.locator("p#password-confirmation-error"),
  ).toHaveCount(0);
  await registrationPassword.fill(password);
  await registrationConfirmation.fill(password);
  await expect(registrationConfirmation).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    registrationConfirmationField.locator("p#password-confirmation-error"),
  ).toHaveCount(0);
  const registrationRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/auth/register"),
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const registrationBody = (await registrationRequest).postDataJSON();
  expect(Object.keys(registrationBody).sort()).toEqual([
    "adultAttestation",
    "displayName",
    "email",
    "password",
    "privacyAccepted",
    "termsAccepted",
  ]);
  expect({
    adultAttestation: registrationBody.adultAttestation,
    displayName: registrationBody.displayName,
    email: registrationBody.email,
    privacyAccepted: registrationBody.privacyAccepted,
    termsAccepted: registrationBody.termsAccepted,
  }).toEqual({
    adultAttestation: true,
    displayName: "Browser lifecycle",
    email,
    privacyAccepted: true,
    termsAccepted: true,
  });
  expect(registrationBody.password === password).toBe(true);
  await expect(page.getByText(/verification link/i)).toBeVisible();
  await expect(page.getByText(/account created/i)).toHaveCount(0);

  const duplicateRegistration = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/auth/register"),
  );
  await page.getByLabel("Email address").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Create account" }).click();
  const duplicateResponse = await duplicateRegistration;
  expect(duplicateResponse.status()).toBe(202);
  expect(await duplicateResponse.json()).toEqual({ status: "accepted" });

  const mailpit = required(mailpitUrl, "MUGFUL_TEST_MAILPIT_URL");
  await waitForMailpitMessages(mailpit, 1);
  const verifyToken = await waitForMailpitToken(mailpit, "/verify-email");
  await checkAuthPageMatrix({
    browser,
    open: async (tokenPage) => {
      const response = await tokenPage.goto(
        `/verify-email#token=${verifyToken}`,
      );
      await expect(tokenPage).toHaveURL(/\/verify-email$/);
      return response;
    },
    tokenPage: true,
  });

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
    await page
      .getByLabel("New password", { exact: true })
      .fill(replacementPassword);
    await expect(page.getByLabel("Confirm new password")).toBeVisible();
    await page
      .getByLabel("Confirm new password")
      .fill(`${replacementPassword}-mismatch`);
    const passwordMutations: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/auth/password")
      )
        passwordMutations.push(request.url());
    });
    await page.getByRole("button", { name: "Change password" }).click();
    const passwordConfirmation = page.getByLabel("Confirm new password", {
      exact: true,
    });
    const passwordConfirmationField = passwordConfirmation.locator("../..");
    await expect(passwordConfirmation).toHaveAttribute("aria-invalid", "true");
    await expect(passwordConfirmation).toHaveAttribute(
      "aria-describedby",
      "passwordConfirmation-hint password-confirmation-error",
    );
    await expect(passwordConfirmation).toBeFocused();
    await expect(
      passwordConfirmationField.locator("p#password-confirmation-error"),
    ).toHaveText(/^Passwords do not match\.$/);
    expect(passwordMutations).toEqual([]);
    await passwordConfirmation.fill(replacementPassword);
    await expect(passwordConfirmation).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      passwordConfirmationField.locator("p#password-confirmation-error"),
    ).toHaveCount(0);
    const passwordRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/auth/password"),
    );
    await page.getByRole("button", { name: "Change password" }).click();
    const passwordBody = (await passwordRequest).postDataJSON();
    expect(Object.keys(passwordBody).sort()).toEqual([
      "currentPassword",
      "newPassword",
    ]);
    expect(passwordBody.currentPassword === password).toBe(true);
    expect(passwordBody.newPassword === replacementPassword).toBe(true);
    await expect(page.getByText(/done/i)).toBeVisible();
    await page.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
    const resetToken = await waitForMailpitToken(mailpit, "/reset-password");
    await checkAuthPageMatrix({
      browser,
      open: async (tokenPage) => {
        const response = await tokenPage.goto(
          `/reset-password#token=${resetToken}`,
        );
        await expect(tokenPage).toHaveURL(/\/reset-password$/);
        return response;
      },
      tokenPage: true,
    });
    await page.goto(`/reset-password#token=${resetToken}`);
    await page.getByLabel("New password", { exact: true }).fill(password);
    await expect(page.getByLabel("Confirm password")).toBeVisible();
    await page.getByLabel("Confirm password").fill(`${password}-mismatch`);
    const resetMutations: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/auth/password/reset")
      )
        resetMutations.push(request.url());
    });
    await page.getByRole("button", { name: "Reset password" }).click();
    const resetConfirmation = page.getByLabel("Confirm password", {
      exact: true,
    });
    const resetConfirmationField = resetConfirmation.locator("../..");
    await expect(resetConfirmation).toHaveAttribute("aria-invalid", "true");
    await expect(resetConfirmation).toHaveAttribute(
      "aria-describedby",
      "passwordConfirmation-hint password-confirmation-error",
    );
    await expect(resetConfirmation).toBeFocused();
    await expect(
      resetConfirmationField.locator("p#password-confirmation-error"),
    ).toHaveText(/^Passwords do not match\.$/);
    expect(resetMutations).toEqual([]);
    await resetConfirmation.fill(password);
    await expect(resetConfirmation).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      resetConfirmationField.locator("p#password-confirmation-error"),
    ).toHaveCount(0);
    const resetRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/auth/password/reset"),
    );
    await page.getByRole("button", { name: "Reset password" }).click();
    const resetBody = (await resetRequest).postDataJSON();
    expect(Object.keys(resetBody).sort()).toEqual(["newPassword", "token"]);
    expect(resetBody.newPassword === password).toBe(true);
    expect(resetBody.token === resetToken).toBe(true);
    await expect(page.getByText(/done/i)).toBeVisible();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/settings\/security$/);
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Pusat Privasi" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Persetujuan Anda" }),
    ).toBeVisible();
    await expect(page.getByText("privacy-v1")).toBeVisible();
    await expect(page.getByText("terms-v1")).toBeVisible();
    await expect(
      page.getByText(/Verifikasi email: terverifikasi/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Kelola kata sandi dan sesi aktif/i }),
    ).toBeVisible();
    await page.goto("/settings/security");
    const securityStorageState = await page.context().storageState();
    await checkAuthPageMatrix({
      browser,
      open: async (securityPage) => {
        await securityPage.goto("/settings/security");
        await expect(securityPage).toHaveURL(/\/settings\/security$/);
        await expect(
          securityPage.getByRole("heading", { name: "Active sessions" }),
        ).toBeVisible();
        return null;
      },
      storageState: securityStorageState,
      tokenPage: false,
    });
  } finally {
    await secondContext.close();
    await thirdContext.close();
  }
});
