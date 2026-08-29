import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { IdentityRepository } from "../../identity/repository.js";
import {
  canTransitionRound,
  roundAnswerSchema,
  roundReactionSchema,
  roundStatusSchema,
  type RoundStatus,
} from "./round-state.js";

const idSchema = z.string().uuid();
const categorySchema = z.string().trim().min(1).max(64);

type MembershipRow = Readonly<{ account_id: string }>;
type RoundRow = Readonly<{
  couple_space_id: string;
  created_at: Date;
  created_by_account_id: string;
  id: string;
  prompt_version_id: string;
  status: string;
}>;
type PromptVersionRow = Readonly<{
  category: string;
  id: string;
  status: string;
  text: string;
  version: number;
}>;
type AnswerRow = Readonly<{
  account_id: string;
  answer: string;
  submitted_at: Date;
}>;
type ReactionRow = Readonly<{
  account_id: string;
  reaction: string;
}>;

type GuessMyAnswerDependencies = Readonly<{
  repository: IdentityRepository;
}>;

export type RoundPromptSuggestion = Readonly<{
  category: string;
  promptVersionId: string;
  text: string;
}>;

export type RoundAnswerView = Readonly<{
  accountId: string;
  answer: string;
}>;

export type RoundView = Readonly<{
  answers: readonly RoundAnswerView[] | undefined;
  category: string;
  createdAt: Date;
  match: boolean | undefined;
  ownAnswer: string | undefined;
  partnerSubmitted: boolean | undefined;
  promptText: string;
  promptVersionId: string;
  promptVersionNumber: number;
  reactions:
    readonly Readonly<{ accountId: string; reaction: string }>[] | undefined;
  roundId: string;
  status: RoundStatus;
}>;

export type GuessMyAnswerService = Readonly<{
  cancelRound: (
    input: Readonly<{
      actorAccountId: string;
      roundId: string;
    }>,
  ) => Promise<
    "cancelled" | "not-cancellable" | "not-member" | "unknown-round"
  >;
  getRound: (
    input: Readonly<{
      actorAccountId: string;
      roundId: string;
    }>,
  ) => Promise<RoundView | "not-member" | "unknown-round">;
  listRounds: (
    input: Readonly<{
      actorAccountId: string;
      spaceId: string;
    }>,
  ) => Promise<readonly RoundView[] | "not-member">;
  reactToRound: (
    input: Readonly<{
      actorAccountId: string;
      reaction: string;
      roundId: string;
    }>,
  ) => Promise<"not-member" | "not-open" | "reacted" | "unknown-round">;
  revealRound: (
    input: Readonly<{
      actorAccountId: string;
      roundId: string;
    }>,
  ) => Promise<
    "not-member" | "not-ready" | "unknown-round" | Readonly<{ view: RoundView }>
  >;
  startRound: (
    input: Readonly<{
      actorAccountId: string;
      promptVersionId: string;
      spaceId: string;
    }>,
  ) => Promise<
    | "invalid-prompt"
    | "not-member"
    | "pending-exists"
    | Readonly<{ roundId: string; status: "active" }>
  >;
  submitAnswer: (
    input: Readonly<{
      actorAccountId: string;
      answer: string;
      roundId: string;
    }>,
  ) => Promise<
    | "already-submitted"
    | "not-member"
    | "round-closed"
    | "unknown-round"
    | Readonly<{ status: RoundStatus }>
  >;
  suggestPrompt: (
    input: Readonly<{
      actorAccountId: string;
      category?: string | undefined;
      excludePromptVersionIds?: readonly string[] | undefined;
      spaceId: string;
    }>,
  ) => Promise<"no-prompt-available" | "not-member" | RoundPromptSuggestion>;
}>;

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  typeof error.code === "string" &&
  error.code === "23505";

export const createGuessMyAnswerService = (
  dependencies: GuessMyAnswerDependencies,
): GuessMyAnswerService => {
  const assertMember = async (
    spaceId: string,
    actorAccountId: string,
  ): Promise<boolean> => {
    const member = await dependencies.repository.query<MembershipRow>(
      "SELECT account_id FROM couple_memberships WHERE couple_space_id = $1 AND account_id = $2 AND revoked_at IS NULL",
      [spaceId, actorAccountId],
    );
    return member.rows.length > 0;
  };

  const loadRoundForUpdate = async (
    transaction: Parameters<
      Parameters<IdentityRepository["transaction"]>[0]
    >[0],
    roundId: string,
  ): Promise<RoundRow | undefined> => {
    const result = await transaction.query<RoundRow>(
      "SELECT id, couple_space_id, prompt_version_id, status, created_by_account_id, created_at FROM rounds WHERE id = $1 FOR UPDATE",
      [roundId],
    );
    return result.rows[0];
  };

  const answersFor = async (roundId: string): Promise<readonly AnswerRow[]> => {
    const result = await dependencies.repository.query<AnswerRow>(
      "SELECT account_id, answer, submitted_at FROM round_answers WHERE round_id = $1 ORDER BY submitted_at",
      [roundId],
    );
    return result.rows;
  };

  const buildView = async (
    round: RoundRow,
    actorAccountId: string,
  ): Promise<RoundView> => {
    const status = roundStatusSchema.parse(round.status);
    const prompt = await dependencies.repository.query<PromptVersionRow>(
      "SELECT id, text, category, version, status FROM prompt_versions WHERE id = $1",
      [round.prompt_version_id],
    );
    const promptRow = prompt.rows[0];
    if (promptRow === undefined)
      throw new Error("Round prompt version is missing");
    const answers = await answersFor(round.id);
    const own = answers.find((row) => row.account_id === actorAccountId);
    const partnerSubmitted =
      status === "active" || status === "waiting-for-partner"
        ? answers.some((row) => row.account_id !== actorAccountId)
        : undefined;
    const completed = status === "completed";
    const reactions = completed
      ? await dependencies.repository.query<ReactionRow>(
          "SELECT account_id, reaction FROM round_reactions WHERE round_id = $1 ORDER BY reacted_at",
          [round.id],
        )
      : undefined;
    const [firstAnswer, secondAnswer] = answers;
    return {
      answers: completed
        ? answers.map((row) => ({
            accountId: row.account_id,
            answer: row.answer,
          }))
        : undefined,
      category: promptRow.category,
      createdAt: round.created_at,
      match: completed
        ? firstAnswer !== undefined &&
          secondAnswer !== undefined &&
          firstAnswer.answer.toLowerCase() === secondAnswer.answer.toLowerCase()
        : undefined,
      ownAnswer: own?.answer,
      partnerSubmitted,
      promptText: promptRow.text,
      promptVersionId: promptRow.id,
      promptVersionNumber: promptRow.version,
      reactions: completed
        ? (reactions?.rows ?? []).map((row) => ({
            accountId: row.account_id,
            reaction: row.reaction,
          }))
        : undefined,
      roundId: round.id,
      status,
    };
  };

  return {
    suggestPrompt: async (input) => {
      const spaceId = idSchema.parse(input.spaceId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      if (!(await assertMember(spaceId, actorAccountId))) return "not-member";
      const category =
        input.category === undefined
          ? undefined
          : categorySchema.parse(input.category);
      const excluded = [
        ...(input.excludePromptVersionIds ?? []).map((value) =>
          idSchema.parse(value),
        ),
      ];
      const result = await dependencies.repository.query<PromptVersionRow>(
        `SELECT id, text, category, version, status FROM prompt_versions
         WHERE status = 'active'
           AND ($2::text IS NULL OR category = $2)
           AND id NOT IN (SELECT prompt_version_id FROM rounds WHERE couple_space_id = $1 ORDER BY created_at DESC LIMIT 10)
         ORDER BY random() LIMIT 1`,
        [spaceId, category ?? null],
      );
      const candidates = result.rows.filter(
        (row) => !excluded.includes(row.id),
      );
      const chosen = candidates[0];
      if (chosen === undefined) return "no-prompt-available";
      return {
        category: chosen.category,
        promptVersionId: chosen.id,
        text: chosen.text,
      };
    },

    startRound: async (input) => {
      const spaceId = idSchema.parse(input.spaceId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      const promptVersionId = idSchema.parse(input.promptVersionId);
      if (!(await assertMember(spaceId, actorAccountId))) return "not-member";
      const prompt = await dependencies.repository.query<PromptVersionRow>(
        "SELECT id, text, category, version, status FROM prompt_versions WHERE id = $1",
        [promptVersionId],
      );
      const promptRow = prompt.rows[0];
      if (promptRow === undefined || promptRow.status !== "active")
        return "invalid-prompt";
      try {
        await dependencies.repository.query(
          "INSERT INTO rounds (id, couple_space_id, prompt_version_id, created_by_account_id) VALUES ($1, $2, $3, $4)",
          [randomUUID(), spaceId, promptVersionId, actorAccountId],
        );
      } catch (error) {
        if (isUniqueViolation(error)) return "pending-exists";
        throw error;
      }
      const created = await dependencies.repository.query<RoundRow>(
        "SELECT id, couple_space_id, prompt_version_id, status, created_by_account_id, created_at FROM rounds WHERE couple_space_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
        [spaceId],
      );
      const createdRound = created.rows[0];
      if (createdRound === undefined)
        throw new Error("Created round is missing");
      return {
        roundId: createdRound.id,
        status: "active" as const,
      };
    },

    submitAnswer: async (input) => {
      const roundId = idSchema.parse(input.roundId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      const answer = roundAnswerSchema.parse(input.answer);
      return dependencies.repository.transaction(async (transaction) => {
        const round = await loadRoundForUpdate(transaction, roundId);
        if (round === undefined) return "unknown-round";
        if (!(await assertMember(round.couple_space_id, actorAccountId)))
          return "not-member";
        const status = roundStatusSchema.parse(round.status);
        if (!isPendingRoundStatusSafe(status)) return "round-closed";
        const inserted = await transaction
          .query(
            "INSERT INTO round_answers (round_id, account_id, answer) VALUES ($1, $2, $3)",
            [roundId, actorAccountId, answer],
          )
          .catch((error: unknown) => {
            if (isUniqueViolation(error)) return undefined;
            throw error;
          });
        if (inserted === undefined) return "already-submitted";
        const answers = await transaction.query<{ readonly total: string }>(
          "SELECT count(*) AS total FROM round_answers WHERE round_id = $1",
          [roundId],
        );
        const submitted = Number(answers.rows[0]?.total ?? "0");
        const target: RoundStatus =
          submitted >= 2 ? "ready-to-reveal" : "waiting-for-partner";
        if (target !== status) {
          if (!canTransitionRound(status, target)) return "round-closed";
          await transaction.query(
            "UPDATE rounds SET status = $2 WHERE id = $1",
            [roundId, target],
          );
        }
        return { status: target };
      });
    },

    revealRound: async (input) => {
      const roundId = idSchema.parse(input.roundId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      return dependencies.repository.transaction(async (transaction) => {
        const round = await loadRoundForUpdate(transaction, roundId);
        if (round === undefined) return "unknown-round";
        if (!(await assertMember(round.couple_space_id, actorAccountId)))
          return "not-member";
        const status = roundStatusSchema.parse(round.status);
        if (status !== "ready-to-reveal") return "not-ready";
        await transaction.query(
          "UPDATE rounds SET status = 'completed', revealed_at = NOW(), completed_at = NOW() WHERE id = $1",
          [roundId],
        );
        const fresh = await loadRoundForUpdate(transaction, roundId);
        const view = await buildView(fresh ?? round, actorAccountId);
        return { view };
      });
    },

    cancelRound: async (input) => {
      const roundId = idSchema.parse(input.roundId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      return dependencies.repository.transaction(async (transaction) => {
        const round = await loadRoundForUpdate(transaction, roundId);
        if (round === undefined) return "unknown-round";
        if (!(await assertMember(round.couple_space_id, actorAccountId)))
          return "not-member";
        const status = roundStatusSchema.parse(round.status);
        if (!canTransitionRound(status, "cancelled")) return "not-cancellable";
        await transaction.query(
          "UPDATE rounds SET status = 'cancelled', cancelled_at = NOW(), cancelled_by_account_id = $2 WHERE id = $1",
          [roundId, actorAccountId],
        );
        return "cancelled";
      });
    },

    getRound: async (input) => {
      const roundId = idSchema.parse(input.roundId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      const round = await dependencies.repository.query<RoundRow>(
        "SELECT id, couple_space_id, prompt_version_id, status, created_by_account_id, created_at FROM rounds WHERE id = $1",
        [roundId],
      );
      const row = round.rows[0];
      if (row === undefined) return "unknown-round";
      if (!(await assertMember(row.couple_space_id, actorAccountId)))
        return "not-member";
      return buildView(row, actorAccountId);
    },

    listRounds: async (input) => {
      const spaceId = idSchema.parse(input.spaceId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      if (!(await assertMember(spaceId, actorAccountId))) return "not-member";
      const rounds = await dependencies.repository.query<RoundRow>(
        "SELECT id, couple_space_id, prompt_version_id, status, created_by_account_id, created_at FROM rounds WHERE couple_space_id = $1 ORDER BY created_at DESC LIMIT 20",
        [spaceId],
      );
      const views: RoundView[] = [];
      for (const row of rounds.rows)
        views.push(await buildView(row, actorAccountId));
      return views;
    },

    reactToRound: async (input) => {
      const roundId = idSchema.parse(input.roundId);
      const actorAccountId = idSchema.parse(input.actorAccountId);
      const reaction = roundReactionSchema.parse(input.reaction);
      return dependencies.repository.transaction(async (transaction) => {
        const round = await loadRoundForUpdate(transaction, roundId);
        if (round === undefined) return "unknown-round";
        if (!(await assertMember(round.couple_space_id, actorAccountId)))
          return "not-member";
        if (roundStatusSchema.parse(round.status) !== "completed")
          return "not-open";
        await transaction.query(
          "INSERT INTO round_reactions (round_id, account_id, reaction) VALUES ($1, $2, $3) ON CONFLICT (round_id, account_id) DO UPDATE SET reaction = $3, reacted_at = NOW()",
          [roundId, actorAccountId, reaction],
        );
        return "reacted";
      });
    },
  };
};

const isPendingRoundStatusSafe = (status: RoundStatus): boolean =>
  status === "active" || status === "waiting-for-partner";
