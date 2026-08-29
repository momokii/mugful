import { describe, expect, it } from "vitest";

import {
  canTransitionRound,
  isPendingRoundStatus,
  legalRoundTransitions,
  roundAnswerSchema,
  roundReactionSchema,
  roundStatusSchema,
} from "./round-state.js";

describe("Guess My Answer round state machine", () => {
  it("accepts exactly the documented round statuses", () => {
    // Given: every status from the architecture state diagram
    const statuses = [
      "active",
      "waiting-for-partner",
      "ready-to-reveal",
      "revealed",
      "completed",
      "cancelled",
    ];

    // When: each status is parsed
    // Then: all are valid and invented ones are rejected
    for (const status of statuses)
      expect(roundStatusSchema.parse(status)).toBe(status);
    expect(() => roundStatusSchema.parse("archived")).toThrow();
  });

  it("permits the forward path, cancels only before reveal readiness", () => {
    // Given: the documented forward progression
    expect(canTransitionRound("active", "waiting-for-partner")).toBe(true);
    expect(canTransitionRound("waiting-for-partner", "ready-to-reveal")).toBe(
      true,
    );
    expect(canTransitionRound("revealed", "completed")).toBe(true);
    expect(canTransitionRound("ready-to-reveal", "completed")).toBe(true);

    // When: cancellation is attempted from each pending state
    // Then: cancellation works before reveal readiness only
    expect(canTransitionRound("active", "cancelled")).toBe(true);
    expect(canTransitionRound("waiting-for-partner", "cancelled")).toBe(true);
    expect(canTransitionRound("ready-to-reveal", "cancelled")).toBe(false);

    // When: any backward or skipped transition is attempted
    // Then: it is rejected
    expect(canTransitionRound("waiting-for-partner", "active")).toBe(false);
    expect(canTransitionRound("active", "ready-to-reveal")).toBe(false);
    expect(canTransitionRound("active", "completed")).toBe(false);
    expect(canTransitionRound("completed", "active")).toBe(false);
    expect(canTransitionRound("cancelled", "active")).toBe(false);
  });

  it("classifies pending statuses and lists legal moves", () => {
    // Given: pending and terminal statuses
    // When: each is classified
    // Then: pending set matches the pre-reveal window
    expect(isPendingRoundStatus("active")).toBe(true);
    expect(isPendingRoundStatus("waiting-for-partner")).toBe(true);
    expect(isPendingRoundStatus("ready-to-reveal")).toBe(true);
    expect(isPendingRoundStatus("completed")).toBe(false);
    expect(isPendingRoundStatus("cancelled")).toBe(false);

    expect(legalRoundTransitions("active")).toEqual([
      "waiting-for-partner",
      "cancelled",
    ]);
    expect(legalRoundTransitions("completed")).toEqual([]);
  });

  it("trims answer text and enforces readable bounds", () => {
    // Given: an answer with surrounding whitespace
    expect(roundAnswerSchema.parse("  Chocolate cake  ")).toBe(
      "Chocolate cake",
    );

    // When: the answer is blank or exceeds storage
    // Then: it is rejected
    expect(() => roundAnswerSchema.parse("   ")).toThrow();
    expect(() => roundAnswerSchema.parse("a".repeat(1001))).toThrow();
  });

  it("keeps reactions short and non-empty", () => {
    // Given: a reaction emoji or short token
    expect(roundReactionSchema.parse("🎉")).toBe("🎉");

    // When: the reaction is blank or oversized
    // Then: it is rejected
    expect(() => roundReactionSchema.parse("   ")).toThrow();
    expect(() => roundReactionSchema.parse("r".repeat(33))).toThrow();
  });
});
