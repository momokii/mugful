import { describe, expect, it } from "vitest";

import {
  promptAuditEventSchema,
  promptCategorySchema,
  promptTextSchema,
  promptVersionNumberSchema,
} from "./prompt-catalog.js";

describe("prompt catalog schemas", () => {
  it("accepts canonical category slugs and trims surrounding whitespace", () => {
    // Given: a curated category slug with accidental whitespace
    // When: the category is parsed
    const result = promptCategorySchema.parse("  daily-life  ");

    // Then: the stored value is the trimmed canonical slug
    expect(result).toBe("daily-life");
  });

  it("rejects categories that are not lowercase slugs", () => {
    // Given: categories with uppercase, spaces, or empty content
    // When: each category is parsed
    // Then: every invalid category fails
    expect(() => promptCategorySchema.parse("Daily Life")).toThrow();
    expect(() => promptCategorySchema.parse("daily life")).toThrow();
    expect(() => promptCategorySchema.parse("   ")).toThrow();
    expect(() => promptCategorySchema.parse("a".repeat(65))).toThrow();
  });

  it("trims prompt text and enforces readable bounds", () => {
    // Given: prompt text with surrounding whitespace
    expect(promptTextSchema.parse("  What made you smile today?  ")).toBe(
      "What made you smile today?",
    );

    // When: prompt text is blank or exceeds the storage limit
    // Then: the text is rejected
    expect(() => promptTextSchema.parse("   ")).toThrow();
    expect(() => promptTextSchema.parse("a".repeat(501))).toThrow();
  });

  it("rejects non-positive version numbers", () => {
    // Given: version numbers below one or fractional
    // When: each version is parsed
    // Then: the version is rejected
    expect(promptVersionNumberSchema.parse(3)).toBe(3);
    expect(() => promptVersionNumberSchema.parse(0)).toThrow();
    expect(() => promptVersionNumberSchema.parse(1.5)).toThrow();
  });

  it("accepts a creation audit event without a previous version", () => {
    // Given: the first version of a new prompt
    const event = promptAuditEventSchema.parse({
      action: "created",
      previousVersion: null,
      nextVersion: 1,
    });

    // Then: the event is accepted
    expect(event.action).toBe("created");
  });

  it("audits updates to a different version and retirements of their own version", () => {
    // Given: audit events for updates and retirement
    expect(
      promptAuditEventSchema.parse({
        action: "updated",
        previousVersion: 1,
        nextVersion: 2,
      }).action,
    ).toBe("updated");
    expect(
      promptAuditEventSchema.parse({
        action: "retired",
        previousVersion: 2,
        nextVersion: 2,
      }).action,
    ).toBe("retired");

    // When: an update reuses the same version or invents a previous version
    // Then: the event is rejected
    expect(() =>
      promptAuditEventSchema.parse({
        action: "updated",
        previousVersion: null,
        nextVersion: 2,
      }),
    ).toThrow();
    expect(() =>
      promptAuditEventSchema.parse({
        action: "updated",
        previousVersion: 2,
        nextVersion: 2,
      }),
    ).toThrow();
    expect(() =>
      promptAuditEventSchema.parse({
        action: "created",
        previousVersion: 1,
        nextVersion: 1,
      }),
    ).toThrow();

    // When: a retirement points at a different version than it retires
    // Then: the event is rejected
    expect(() =>
      promptAuditEventSchema.parse({
        action: "retired",
        previousVersion: 1,
        nextVersion: 2,
      }),
    ).toThrow();
  });
});
