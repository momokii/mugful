import { describe, expect, it } from "vitest";

import { createChildEnvironment, runBuild } from "./build.mjs";

describe("web build environment", () => {
  it("allowlists only server build configuration", () => {
    // Given: a baseline shell environment and loaded API origin
    const baseline = {
      DATABASE_URL: "postgresql://secret",
      NODE_ENV: "production",
      NEXT_DIST_DIR: "/tmp/mugful-lifecycle/.next",
      PATH: "/bin",
    };

    // When: the Next child environment is created
    const childEnvironment = createChildEnvironment(
      baseline,
      "http://127.0.0.1:3001",
    );

    // Then: secrets are omitted while required values remain
    expect(childEnvironment).toEqual({
      API_INTERNAL_ORIGIN: "http://127.0.0.1:3001",
      NODE_ENV: "production",
      NEXT_DIST_DIR: "/tmp/mugful-lifecycle/.next",
      PATH: "/bin",
    });
  });

  it("spawns Next with the positive allowlist", () => {
    // Given: a loader that includes a database secret and fake Next spawn
    let capturedOptions;
    const spawn = (_command, _arguments, options) => {
      capturedOptions = options;
      return { status: 0 };
    };

    // When: the production build runner executes
    runBuild({
      baseline: {
        DATABASE_URL: "postgresql://secret",
        NEXT_DIST_DIR: "/tmp/mugful-lifecycle/.next",
        PATH: "/bin",
      },
      loadEnvironment: () => ({
        combinedEnv: {
          API_INTERNAL_ORIGIN: "http://127.0.0.1:3001",
          DATABASE_URL: "postgresql://secret",
        },
      }),
      spawn,
    });

    // Then: the fake Next process cannot receive the secret
    expect(capturedOptions.env).toEqual({
      API_INTERNAL_ORIGIN: "http://127.0.0.1:3001",
      NEXT_DIST_DIR: "/tmp/mugful-lifecycle/.next",
      PATH: "/bin",
    });
  });
});
