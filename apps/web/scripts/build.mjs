import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));
const { loadEnvConfig } = nextEnv;
const { combinedEnv } = loadEnvConfig(workspaceRoot);
const result = spawnSync("next", ["build"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: combinedEnv,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exitCode = result.status ?? 1;
