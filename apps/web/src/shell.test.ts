import { describe, expect, it } from "vitest";

import { webShellLabel } from "./shell.js";

describe("webShellLabel", () => {
  it("returns the web tooling shell label", () => {
    // Given: the public web shell export
    // When: the label is requested
    const label = webShellLabel();

    // Then: it identifies the web package without product behavior
    expect(label).toBe("Mugful web tooling shell");
  });
});
