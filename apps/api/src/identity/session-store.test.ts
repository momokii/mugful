import { describe, expect, it } from "vitest";

import {
  sessionLifetimeMilliseconds,
  sessionLifetimeSeconds,
} from "./session-store.js";

describe("session lifetime constants", () => {
  it("pins both lifetime units to the same 30-day session window", () => {
    // Given: the single source of truth for stored sessions and csrf cookies
    // When: the lifetime is read in seconds and in milliseconds
    // Then: both units equal the agreed 30-day window
    expect(sessionLifetimeSeconds).toBe(2_592_000);
    expect(sessionLifetimeMilliseconds).toBe(2_592_000_000);
  });
});
