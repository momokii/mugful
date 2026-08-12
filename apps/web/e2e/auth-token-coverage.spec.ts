import { expect, test } from "@playwright/test";

import { baseUrl } from "./auth-test-support";

const registrationClosed =
  process.env["MUGFUL_TEST_REGISTRATION_CLOSED"] === "true";
const viewportWidths = [375, 768, 1280] as const;
const colorSchemes = ["light", "dark"] as const;

test("token pages prevent referrers, avoid cache, and fit each visual viewport", async ({
  browser,
}) => {
  for (const colorScheme of colorSchemes) {
    for (const width of viewportWidths) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        colorScheme,
        viewport: { height: 900, width },
      });
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const response = await page.goto(
        "/reset-password#token=not-a-real-token",
      );
      expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
      expect(response?.headers()["cache-control"]).toContain("no-store");
      await expect(page).toHaveURL(/\/reset-password$/);
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus-visible")).toBeVisible();
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      ).toBe(colorScheme);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth),
      );
      await context.close();
    }
  }
});

test("default registration is visibly invite-only and has no mutation form", async ({
  page,
}) => {
  test.skip(
    !registrationClosed,
    "This test requires the default-closed build.",
  );
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") mutations.push(request.url());
  });
  await page.goto("/register");
  await expect(page.getByText(/registration is invite-only/i)).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  expect(mutations).toEqual([]);
});
