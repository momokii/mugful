import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    exclude: ["e2e/**"],
  },
});
