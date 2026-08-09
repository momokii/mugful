import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../..", import.meta.url));

export const createChildEnvironment = (baseline, apiInternalOrigin) => {
  new URL(apiInternalOrigin);

  return Object.fromEntries(
    Object.entries({
      PATH: baseline.PATH,
      NODE_ENV: baseline.NODE_ENV,
      API_INTERNAL_ORIGIN: apiInternalOrigin,
    }).filter(([, value]) => value !== undefined),
  );
};

export const runBuild = ({ baseline, loadEnvironment, spawn }) => {
  const { combinedEnv } = loadEnvironment(workspaceRoot);
  const childEnvironment = createChildEnvironment(
    baseline,
    combinedEnv.API_INTERNAL_ORIGIN,
  );

  return spawn("next", ["build"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: childEnvironment,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runBuild({
    baseline: { ...process.env },
    loadEnvironment: nextEnv.loadEnvConfig,
    spawn: spawnSync,
  });

  process.exitCode = result.status ?? 1;
}
