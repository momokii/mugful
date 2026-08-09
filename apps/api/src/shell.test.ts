import { describe, expect, it } from "vitest";

import { apiShellLabel } from "./shell.js";

describe("apiShellLabel", () => {
  it("returns the API tooling shell label", () => {
    // Given: the public API shell export
    // When: the label is requested
    const label = apiShellLabel();

    // Then: it identifies the API package without runtime behavior
    expect(label).toBe("Mugful API tooling shell");
  });
});
