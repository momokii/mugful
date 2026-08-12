import { defineConfig, devices } from "@playwright/test";

const lifecycleBaseUrl = process.env["PLAYWRIGHT_BASE_URL"];

export default defineConfig({
  testDir: "./e2e",
  outputDir:
    process.env["PLAYWRIGHT_OUTPUT_DIR"] ??
    "../../.omo/evidence/task-4-test-output",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile:
          process.env["PLAYWRIGHT_REPORT_FILE"] ??
          "../../.omo/evidence/task-4-playwright.json",
      },
    ],
  ],
  use: {
    baseURL: lifecycleBaseUrl ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  ...(lifecycleBaseUrl === undefined
    ? {
        webServer: {
          cwd: ".",
          url: "http://127.0.0.1:3100",
          command: "./node_modules/.bin/next start -p 3100",
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }
    : {}),
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
    { name: "tablet", use: { viewport: { width: 768, height: 900 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
