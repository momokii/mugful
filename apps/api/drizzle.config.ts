import { defineConfig } from "drizzle-kit";

import { parseDatabaseUrl } from "./src/config.js";

export default defineConfig({
  dbCredentials: { url: parseDatabaseUrl(process.env) },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.ts",
});
