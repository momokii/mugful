import { expect, test } from "@playwright/test";

for (const route of ["/onboarding", "/join#token=private-token"] as const) {
  test(`${route} is responsive and exposes no private content`, async ({
    page,
  }) => {
    // Given: a fresh browser visiting an onboarding route
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET") mutations.push(request.url());
    });

    // When: the page finishes hydrating
    await page.goto(route);

    // Then: it has accessible landmarks, no overflow, and does not mutate on load
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    expect(mutations).toEqual([]);
  });
}

test("join clears its fragment token before invite acceptance", async ({
  page,
}) => {
  // Given: a private fragment-only invite URL
  await page.goto("/join#token=private-token");

  // When: client-side hydration reads the token
  await expect(
    page.getByRole("button", { name: "Accept private invite" }),
  ).toBeEnabled();

  // Then: the browser address no longer contains the private token
  await expect(page).toHaveURL(/\/join$/);
});
