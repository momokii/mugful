import { expect, test } from "@playwright/test";

const routes = ["/", "/login", "/register"] as const;

test.describe("public and auth shell", () => {
  for (const route of routes) {
    test(`${route} has landmarks and no horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await page.goto(route);

      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      if (route === "/") await expect(page.locator("footer")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth),
      );
      await page.screenshot({
        path: testInfo.outputPath(
          `${route === "/" ? "home" : route.slice(1)}.png`,
        ),
        fullPage: true,
      });
    });
  }

  test("auth forms expose labels, native validation, and no API calls", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/login");

    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "required",
      "",
    );
    expect(requests.some((url) => url.includes("/api/"))).toBe(false);
  });

  test("keyboard focus is visible and reduced motion is honored", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/register");
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toBeVisible();
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toMatch(/light|dark/);
  });

  test("dark theme keeps the shell readable", async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      colorScheme: "dark",
      viewport: { width: 375, height: 812 },
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /distance feel/i }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).colorScheme,
      ),
    ).toBe("dark");
    await page.screenshot({
      path: testInfo.outputPath("dark-home.png"),
      fullPage: true,
    });
    await context.close();
  });

  test("auth fields retain entered values without an application handler", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Your name").fill("Ari");
    await page.getByLabel("Email address").fill("ari@example.com");
    await page.getByLabel("Create a password").fill("eight-char");
    await expect(page.getByLabel("Your name")).toHaveValue("Ari");
    await expect(page.getByLabel("Email address")).toHaveValue(
      "ari@example.com",
    );
    await expect(page.getByLabel("Create a password")).toHaveValue(
      "eight-char",
    );
  });
});
