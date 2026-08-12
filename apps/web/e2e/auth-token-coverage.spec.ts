import { expect, test } from "@playwright/test";

const registrationClosed =
  process.env["MUGFUL_TEST_REGISTRATION_CLOSED"] === "true";

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
