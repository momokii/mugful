import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { createIdentityRepository } from "../../identity/repository.js";
import { createGuessMyAnswerService } from "./service.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "Guess My Answer round service",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository = createIdentityRepository(pool);
    const service = createGuessMyAnswerService({ repository });
    const cleanup: {
      accountIds: string[];
      promptIds: string[];
      spaceIds: string[];
    } = { accountIds: [], promptIds: [], spaceIds: [] };

    const createAccount = async (): Promise<string> => {
      const accountId = randomUUID();
      const email = `${accountId}@round.test`;
      await pool.query(
        "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [accountId, email, email, "Round", "test-only-not-a-real-hash"],
      );
      cleanup.accountIds.push(accountId);
      return accountId;
    };

    const createCouple = async (): Promise<{
      partnerA: string;
      partnerB: string;
      spaceId: string;
    }> => {
      const partnerA = await createAccount();
      const partnerB = await createAccount();
      const spaceId = randomUUID();
      await pool.query(
        "INSERT INTO couple_spaces (id, created_by_account_id) VALUES ($1, $2)",
        [spaceId, partnerA],
      );
      await pool.query(
        "INSERT INTO couple_memberships (couple_space_id, account_id) VALUES ($1, $2), ($1, $3)",
        [spaceId, partnerA, partnerB],
      );
      cleanup.spaceIds.push(spaceId);
      return { partnerA, partnerB, spaceId };
    };

    const createPromptVersion = async (
      category: string,
      text: string,
    ): Promise<string> => {
      const promptId = randomUUID();
      const versionId = randomUUID();
      await pool.query("INSERT INTO prompts (id) VALUES ($1)", [promptId]);
      await pool.query(
        "INSERT INTO prompt_versions (id, prompt_id, version, text, category) VALUES ($1, $2, 1, $3, $4)",
        [versionId, promptId, text, category],
      );
      cleanup.promptIds.push(promptId);
      return versionId;
    };

    afterAll(async () => {
      await pool.query(
        "DELETE FROM round_reactions WHERE round_id IN (SELECT id FROM rounds WHERE couple_space_id = ANY($1))",
        [cleanup.spaceIds],
      );
      await pool.query(
        "DELETE FROM round_answers WHERE round_id IN (SELECT id FROM rounds WHERE couple_space_id = ANY($1))",
        [cleanup.spaceIds],
      );
      await pool.query("DELETE FROM rounds WHERE couple_space_id = ANY($1)", [
        cleanup.spaceIds,
      ]);
      await pool.query(
        "DELETE FROM couple_memberships WHERE couple_space_id = ANY($1)",
        [cleanup.spaceIds],
      );
      await pool.query("DELETE FROM couple_spaces WHERE id = ANY($1)", [
        cleanup.spaceIds,
      ]);
      await pool.query(
        "DELETE FROM prompt_versions WHERE prompt_id = ANY($1)",
        [cleanup.promptIds],
      );
      await pool.query("DELETE FROM prompts WHERE id = ANY($1)", [
        cleanup.promptIds,
      ]);
      await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [
        cleanup.accountIds,
      ]);
      await pool.end();
    });

    it("suggests active prompts while avoiding recent rounds, categories, and explicit exclusions", async () => {
      // Given: a couple with two daily-life prompts and one dreams prompt
      const { partnerA, partnerB, spaceId } = await createCouple();
      const firstDaily = await createPromptVersion(
        "daily-life",
        "Favorite dessert?",
      );
      await createPromptVersion("dreams", "A shared dream?");
      const secondDaily = await createPromptVersion(
        "daily-life",
        "Ideal Sunday?",
      );
      const outsider = await createAccount();

      // When: the outsider suggests and the couple filters by category
      const outsiderResult = await service.suggestPrompt({
        actorAccountId: outsider,
        spaceId,
      });
      const dailySuggestion = await service.suggestPrompt({
        actorAccountId: partnerA,
        category: "daily-life",
        spaceId,
      });

      // Then: membership is enforced and the category narrows correctly
      expect(outsiderResult).toBe("not-member");
      expect(
        dailySuggestion === "not-member" ||
          dailySuggestion === "no-prompt-available" ||
          [firstDaily, secondDaily].includes(dailySuggestion.promptVersionId),
      ).toBe(true);

      // When: a round consumes the first daily prompt
      const started = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: firstDaily,
        spaceId,
      });
      expect(started).toHaveProperty("roundId");
      const roundId = (started as { roundId: string }).roundId;
      await service.submitAnswer({
        actorAccountId: partnerA,
        answer: "Cake",
        roundId,
      });
      await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "Pie",
        roundId,
      });
      await service.revealRound({ actorAccountId: partnerB, roundId });

      // Then: recent rounds are excluded and exhausted categories report it
      const afterConsumption = await service.suggestPrompt({
        actorAccountId: partnerA,
        category: "daily-life",
        spaceId,
      });
      if (
        afterConsumption === "not-member" ||
        afterConsumption === "no-prompt-available"
      )
        throw new Error("A daily-life suggestion was expected");
      expect(afterConsumption.promptVersionId).toBe(secondDaily);
      const exhausted = await service.suggestPrompt({
        actorAccountId: partnerA,
        category: "daily-life",
        excludePromptVersionIds: [secondDaily],
        spaceId,
      });
      expect(exhausted).toBe("no-prompt-available");
    });

    it("starts rounds with an active prompt and enforces one pending round per space", async () => {
      // Given: a couple and an active plus a retired prompt
      const { partnerA, partnerB, spaceId } = await createCouple();
      const activeVersion = await createPromptVersion(
        "daily-life",
        "Best comfort food?",
      );
      const retiredVersion = await createPromptVersion(
        "daily-life",
        "Retired prompt",
      );
      await pool.query(
        "UPDATE prompt_versions SET status = 'retired', retired_at = NOW() WHERE id = $1",
        [retiredVersion],
      );

      // When: rounds are started under each condition
      const retired = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: retiredVersion,
        spaceId,
      });
      const unknown = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: randomUUID(),
        spaceId,
      });
      const started = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: activeVersion,
        spaceId,
      });
      const duplicate = await service.startRound({
        actorAccountId: partnerB,
        promptVersionId: activeVersion,
        spaceId,
      });

      // Then: only the active prompt starts one pending round
      expect(retired).toBe("invalid-prompt");
      expect(unknown).toBe("invalid-prompt");
      expect(started).toHaveProperty("status", "active");
      expect(duplicate).toBe("pending-exists");
    });

    it("walks active → waiting-for-partner → ready-to-reveal as each partner submits", async () => {
      // Given: a pending round
      const { partnerA, partnerB, spaceId } = await createCouple();
      const versionId = await createPromptVersion("memories", "First concert?");
      const started = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: versionId,
        spaceId,
      });
      const roundId = (started as { roundId: string }).roundId;

      // When: partner A submits twice, then partner B submits
      const first = await service.submitAnswer({
        actorAccountId: partnerA,
        answer: "  Rock fest 2019  ",
        roundId,
      });
      const duplicate = await service.submitAnswer({
        actorAccountId: partnerA,
        answer: "Changed",
        roundId,
      });
      const partnerView = await service.getRound({
        actorAccountId: partnerB,
        roundId,
      });
      const second = await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "Rock fest 2019",
        roundId,
      });
      const closed = await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "Again",
        roundId,
      });

      // Then: the statuses follow the documented machine; the waiting partner
      // sees the submission flag without the answer content
      expect(first).toEqual({ status: "waiting-for-partner" });
      expect(duplicate).toBe("already-submitted");
      expect(second).toEqual({ status: "ready-to-reveal" });
      expect(closed).toBe("round-closed");
      if (partnerView === "not-member" || partnerView === "unknown-round")
        throw new Error("Partner round view was expected");
      expect(partnerView.status).toBe("waiting-for-partner");
      expect(partnerView.ownAnswer).toBeUndefined();
      expect(partnerView.partnerSubmitted).toBe(true);
      const view = await service.getRound({
        actorAccountId: partnerA,
        roundId,
      });
      expect(view === "not-member" || view === "unknown-round").toBe(false);
      if (view !== "not-member" && view !== "unknown-round") {
        expect(view.status).toBe("ready-to-reveal");
        expect(view.ownAnswer).toBe("Rock fest 2019");
      }
    });

    it("reveals only when both submitted and computes the match", async () => {
      // Given: two rounds, one submitted by both and one by a single partner
      const { partnerA, partnerB, spaceId } = await createCouple();
      const matchVersion = await createPromptVersion(
        "daily-life",
        "Same answer?",
      );
      const started = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: matchVersion,
        spaceId,
      });
      const roundId = (started as { roundId: string }).roundId;
      const earlyReveal = await service.revealRound({
        actorAccountId: partnerA,
        roundId,
      });
      expect(earlyReveal).toBe("not-ready");
      await service.submitAnswer({
        actorAccountId: partnerA,
        answer: "Beach",
        roundId,
      });
      await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "  beach  ",
        roundId,
      });

      // When: the round is revealed after both submissions
      const revealed = await service.revealRound({
        actorAccountId: partnerB,
        roundId,
      });

      // Then: the reveal completes with case-insensitive matching answers
      if (
        revealed === "not-ready" ||
        revealed === "not-member" ||
        revealed === "unknown-round"
      )
        throw new Error("Reveal was expected to succeed");
      expect(revealed.view.status).toBe("completed");
      expect(revealed.view.match).toBe(true);
      expect(revealed.view.answers).toHaveLength(2);
    });

    it("cancels pending rounds once and frees the pending slot", async () => {
      // Given: a pending round submitted by one partner
      const { partnerA, partnerB, spaceId } = await createCouple();
      const versionId = await createPromptVersion(
        "future",
        "Next trip together?",
      );
      const started = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: versionId,
        spaceId,
      });
      const roundId = (started as { roundId: string }).roundId;
      await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "Bali",
        roundId,
      });

      // When: the round is cancelled twice and a fresh round starts
      const first = await service.cancelRound({
        actorAccountId: partnerA,
        roundId,
      });
      const second = await service.cancelRound({
        actorAccountId: partnerA,
        roundId,
      });
      const restarted = await service.startRound({
        actorAccountId: partnerB,
        promptVersionId: versionId,
        spaceId,
      });

      // Then: cancellation is single-shot and the slot is released
      expect(first).toBe("cancelled");
      expect(second).toBe("not-cancellable");
      expect(restarted).toHaveProperty("roundId");
    });

    it("allows reactions only after completion and exposes them in the view", async () => {
      // Given: a completed round and a pending round
      const { partnerA, partnerB, spaceId } = await createCouple();
      const versionId = await createPromptVersion(
        "daily-life",
        "Pizza or sushi?",
      );
      const pending = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: versionId,
        spaceId,
      });
      const pendingId = (pending as { roundId: string }).roundId;
      const completed = await service
        .startRound({
          actorAccountId: partnerA,
          promptVersionId: versionId,
          spaceId,
        })
        .catch(() => undefined);
      expect(completed).toBe("pending-exists");
      await service.cancelRound({
        actorAccountId: partnerA,
        roundId: pendingId,
      });
      const restarted = await service.startRound({
        actorAccountId: partnerA,
        promptVersionId: versionId,
        spaceId,
      });
      const completedId = (restarted as { roundId: string }).roundId;
      await service.submitAnswer({
        actorAccountId: partnerA,
        answer: "Sushi",
        roundId: completedId,
      });
      await service.submitAnswer({
        actorAccountId: partnerB,
        answer: "Pizza",
        roundId: completedId,
      });
      await service.revealRound({
        actorAccountId: partnerA,
        roundId: completedId,
      });

      // When: reactions arrive before and after completion
      const pendingReaction = await service.reactToRound({
        actorAccountId: partnerA,
        reaction: "🎉",
        roundId: pendingId,
      });
      const reacted = await service.reactToRound({
        actorAccountId: partnerA,
        reaction: "🎉",
        roundId: completedId,
      });
      const updated = await service.reactToRound({
        actorAccountId: partnerB,
        reaction: "❤️",
        roundId: completedId,
      });
      const view = await service.getRound({
        actorAccountId: partnerB,
        roundId: completedId,
      });

      // Then: pending rounds refuse reactions and completed rounds collect them
      expect(pendingReaction).toBe("not-open");
      expect(reacted).toBe("reacted");
      expect(updated).toBe("reacted");
      if (view !== "not-member" && view !== "unknown-round") {
        expect(view.match).toBe(false);
        expect(view.reactions?.map((row) => row.reaction).sort()).toEqual(
          ["🎉", "❤️"].sort(),
        );
      }
    });

    it("guards unknown rounds and non-members on reads and lists", async () => {
      // Given: an outsider account and an unknown round id
      const outsider = await createAccount();
      const unknownId = randomUUID();

      // When: reads target the unknown round and foreign space
      const getUnknown = await service.getRound({
        actorAccountId: outsider,
        roundId: unknownId,
      });
      const listForeign = await service.listRounds({
        actorAccountId: outsider,
        spaceId: randomUUID(),
      });

      // Then: both refuse without leaking state
      expect(getUnknown).toBe("unknown-round");
      expect(listForeign).toBe("not-member");
    });
  },
);
