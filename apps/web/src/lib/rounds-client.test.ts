import { describe, expect, it } from "vitest";

import {
  findPendingRound,
  isPendingRound,
  messageForStatus,
  type RoundView,
} from "./rounds-client.js";

const round = (status: string, roundId: string): RoundView =>
  ({
    answers: undefined,
    category: "daily-life",
    createdAt: "2026-08-29T00:00:00.000Z",
    match: undefined,
    ownAnswer: undefined,
    partnerSubmitted: undefined,
    promptText: "Favorite dessert?",
    promptVersionId: "11111111-1111-4111-8111-111111111111",
    promptVersionNumber: 1,
    reactions: undefined,
    roundId,
    status: status as RoundView["status"],
  }) as RoundView;

describe("rounds client helpers", () => {
  it("maps HTTP failures to human guidance", () => {
    // Given: the documented failure statuses
    // When: each status is mapped
    // Then: known statuses get specific guidance and unknown ones stay generic
    expect(messageForStatus(400)).toContain("Check the fields");
    expect(messageForStatus(401)).toContain("session has expired");
    expect(messageForStatus(403)).toContain("not available");
    expect(messageForStatus(404)).toContain("no longer exists");
    expect(messageForStatus(409)).toContain("changed while you were away");
    expect(messageForStatus(500)).toBe(
      "Mugful could not reach this space. Try again in a moment.",
    );
  });

  it("classifies pending rounds by their pre-reveal status", () => {
    // Given: one round per documented status
    const [
      active,
      waitingForPartner,
      readyToReveal,
      revealed,
      completed,
      cancelled,
    ] = [
      "active",
      "waiting-for-partner",
      "ready-to-reveal",
      "revealed",
      "completed",
      "cancelled",
    ];

    // When: each round is classified
    // Then: only the three pre-reveal statuses are pending
    expect(isPendingRound(round(active, "r1"))).toBe(true);
    expect(isPendingRound(round(waitingForPartner, "r2"))).toBe(true);
    expect(isPendingRound(round(readyToReveal, "r3"))).toBe(true);
    expect(isPendingRound(round(revealed, "r4"))).toBe(false);
    expect(isPendingRound(round(completed, "r5"))).toBe(false);
    expect(isPendingRound(round(cancelled, "r6"))).toBe(false);
  });

  it("finds the first pending round in the history", () => {
    // Given: a completed round followed by a pending round
    const rounds = [
      round("completed", "done"),
      round("waiting-for-partner", "pending"),
    ];

    // When: the pending round is located
    const pending = findPendingRound(rounds);

    // Then: the pending round is returned, or undefined when none exists
    expect(pending?.roundId).toBe("pending");
    expect(findPendingRound([round("completed", "done")])).toBeUndefined();
  });
});
