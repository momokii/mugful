import { expect } from "@playwright/test";
import type { Browser, Page, Response } from "@playwright/test";

import { baseUrl } from "./auth-test-support";

const colorSchemes = ["light", "dark"] as const;
const viewportWidths = [375, 768, 1280] as const;
type StorageState = Awaited<
  ReturnType<ReturnType<Page["context"]>["storageState"]>
>;

type PageMatrixInput = Readonly<{
  browser: Browser;
  open: (page: Page) => Promise<Response | null>;
  storageState?: StorageState;
  tokenPage: boolean;
}>;

export const checkAuthPageMatrix = async ({
  browser,
  open,
  storageState,
  tokenPage,
}: PageMatrixInput): Promise<void> => {
  for (const colorScheme of colorSchemes) {
    for (const width of viewportWidths) {
      const contextOptions = {
        baseURL: baseUrl,
        colorScheme,
        viewport: { height: 900, width },
      };
      const context = await browser.newContext(
        storageState === undefined
          ? contextOptions
          : { ...contextOptions, storageState },
      );
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const response = await open(page);
      if (tokenPage) {
        expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
        expect(response?.headers()["cache-control"]).toContain("no-store");
      }
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
};
