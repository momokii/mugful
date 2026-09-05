import { expect, test } from "@playwright/test";

const baseUrl = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3100";
const routes = ["/", "/login", "/register"] as const;
const gatedRoutes = [
  "/home",
  "/onboarding",
  "/privacy",
  "/settings/security",
] as const;
const colorSchemes = ["light", "dark"] as const;

const relativeLuminance = (
  red: number,
  green: number,
  blue: number,
): number => {
  const linearize = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * linearize(red) +
    0.7152 * linearize(green) +
    0.0722 * linearize(blue)
  );
};

const contrastRatio = (foreground: string, background: string): number => {
  const parseRgb = (value: string): readonly [number, number, number] => {
    const channels = value.match(/\d+/g);
    if (!channels || channels.length < 3) {
      throw new Error(`Unable to parse browser color: ${value}`);
    }

    return [Number(channels[0]), Number(channels[1]), Number(channels[2])];
  };

  const foregroundLuminance = relativeLuminance(...parseRgb(foreground));
  const backgroundLuminance = relativeLuminance(...parseRgb(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

test.describe("authenticated route gating", () => {
  for (const route of gatedRoutes) {
    test(`unauthenticated GET ${route} redirects to /login`, async ({
      request,
    }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toBe("/login");
    });
  }
});

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

  test("auth forms expose labels and native validation", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "required",
      "",
    );
  });

  test("auth text and action pairings meet WCAG AA in both themes", async ({
    browser,
  }) => {
    for (const colorScheme of colorSchemes) {
      const context = await browser.newContext({
        baseURL: baseUrl,
        colorScheme,
      });
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/login");
      const colors = await page.evaluate(() => {
        const panel = document.querySelector("section");
        const label = document.querySelector("label");
        const hint = document.querySelector("form p");
        const button = document.querySelector("form button");
        if (!panel || !label || !hint || !button) {
          throw new Error("Auth contrast fixtures are missing");
        }

        return {
          label: [
            getComputedStyle(label).color,
            getComputedStyle(panel).backgroundColor,
          ] as const,
          hint: [
            getComputedStyle(hint).color,
            getComputedStyle(panel).backgroundColor,
          ] as const,
          action: [
            getComputedStyle(button).color,
            getComputedStyle(button).backgroundColor,
          ] as const,
        };
      });

      for (const [name, [foreground, background]] of Object.entries(colors)) {
        expect(
          contrastRatio(foreground, background),
          `${colorScheme} ${name}`,
        ).toBeGreaterThanOrEqual(4.5);
      }

      const action = page.getByRole("button", { name: "Continue" });
      await action.hover();
      await expect(action).toHaveCSS(
        "background-color",
        colorScheme === "light" ? "rgb(238, 241, 239)" : "rgb(23, 29, 32)",
      );
      const hoverColors = await page.evaluate(() => {
        const button = document.querySelector("form button");
        if (!button) throw new Error("Auth action fixture is missing");
        return [
          getComputedStyle(button).color,
          getComputedStyle(button).backgroundColor,
        ] as const;
      });
      expect(
        contrastRatio(hoverColors[0], hoverColors[1]),
        `${colorScheme} action hover`,
      ).toBeGreaterThanOrEqual(4.5);
      await context.close();
    }
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
      baseURL: baseUrl,
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

  test("auth fields retain entered values", async ({ page }) => {
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

  test("unauthenticated header links wordmark home and offers sign in", async ({
    page,
  }) => {
    await page.goto("/");

    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "Mugful home" }),
    ).toHaveAttribute("href", "/");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(
      header.getByRole("link", { name: "Create your space" }),
    ).toHaveAttribute("href", "/register");
  });
});
