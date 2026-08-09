import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../../.omo/evidence/task-4-test-output",
  reporter: [
    ["list"],
    ["json", { outputFile: "../../.omo/evidence/task-4-playwright.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: ".",
    url: "http://127.0.0.1:3100",
    command: "pnpm exec next start -p 3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    { name: "tablet", use: { viewport: { width: 768, height: 900 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
