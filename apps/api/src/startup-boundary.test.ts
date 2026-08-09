import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("API startup boundary", () => {
  it("constructs the HTTP app without importing or invoking migrations", async () => {
    // Given: the API main module source
    const mainSource = await readFile(
      new URL("./main.ts", import.meta.url),
      "utf8",
    );

    // When: its startup dependencies are inspected
    const startsApplication = mainSource.includes("createApp");
    const importsMigrationRunner = mainSource.includes(
      "node-postgres/migrator",
    );
    const invokesMigration = mainSource.includes("migrate(");

    // Then: startup has no migration responsibility
    expect(startsApplication).toBe(true);
    expect(importsMigrationRunner).toBe(false);
    expect(invokesMigration).toBe(false);
  });
});
