"use client";

import { z } from "zod";

import { fetchJson, mutateIdentity } from "./identity-client";

export type RoundStatus =
  | "active"
  | "waiting-for-partner"
  | "ready-to-reveal"
  | "revealed"
  | "completed"
  | "cancelled";

export type RoundAnswerView = Readonly<{
  accountId: string;
  answer: string;
}>;

export type RoundReactionView = Readonly<{
  accountId: string;
  reaction: string;
}>;

export type RoundView = Readonly<{
  answers: RoundAnswerView[] | undefined;
  category: string;
  createdAt: string;
  match: boolean | undefined;
  ownAnswer: string | undefined;
  partnerSubmitted: boolean | undefined;
  promptText: string;
  promptVersionId: string;
  promptVersionNumber: number;
  reactions: RoundReactionView[] | undefined;
  roundId: string;
  status: RoundStatus;
}>;

export type PromptSuggestion = Readonly<{
  category: string;
  promptVersionId: string;
  text: string;
}>;

export type CommandResult<data> =
  Readonly<{ data: data; ok: true }> | Readonly<{ message: string; ok: false }>;

export type RoundsState =
  | Readonly<{ kind: "checking" }>
  | Readonly<{ kind: "no-space" }>
  | Readonly<{ kind: "ready"; rounds: readonly RoundView[] }>
  | Readonly<{ kind: "sign-in" }>
  | Readonly<{ kind: "unavailable" }>;

export const unavailableMessage =
  "Mugful could not reach this space. Try again in a moment.";

const statusSchema = z.enum([
  "active",
  "waiting-for-partner",
  "ready-to-reveal",
  "revealed",
  "completed",
  "cancelled",
]);

const roundViewSchema = z
  .object({
    answers: z
      .array(z.object({ accountId: z.string(), answer: z.string() }).loose())
      .optional(),
    category: z.string(),
    createdAt: z.string(),
    match: z.boolean().nullable().optional(),
    ownAnswer: z.string().nullable().optional(),
    partnerSubmitted: z.boolean().nullable().optional(),
    promptText: z.string(),
    promptVersionId: z.string(),
    promptVersionNumber: z.number(),
    reactions: z
      .array(z.object({ accountId: z.string(), reaction: z.string() }).loose())
      .optional(),
    roundId: z.string(),
    status: statusSchema,
  })
  .loose();

const roundsSchema = z.object({ rounds: z.array(roundViewSchema) });

const sessionSchema = z
  .object({ session: z.object({ accountId: z.string() }).loose() })
  .loose();

type ParsedRoundView = z.infer<typeof roundViewSchema>;

const toRoundView = (round: ParsedRoundView): RoundView => ({
  answers: round.answers,
  category: round.category,
  createdAt: round.createdAt,
  match: round.match ?? undefined,
  ownAnswer: round.ownAnswer ?? undefined,
  partnerSubmitted: round.partnerSubmitted ?? undefined,
  promptText: round.promptText,
  promptVersionId: round.promptVersionId,
  promptVersionNumber: round.promptVersionNumber,
  reactions: round.reactions,
  roundId: round.roundId,
  status: round.status,
});

export const fetchOwnAccountId = async (): Promise<string | undefined> => {
  const response = await fetchJson("/auth/session");
  if (response.status !== 200) return undefined;
  const parsed = sessionSchema.safeParse(response.body);
  return parsed.success ? parsed.data.session.accountId : undefined;
};

const suggestionSchema = z
  .object({
    category: z.string(),
    promptVersionId: z.string(),
    text: z.string(),
  })
  .loose();

export const messageForStatus = (status: number): string => {
  if (status === 400)
    return "Mugful could not accept that. Check the fields, then try again.";
  if (status === 401)
    return "Your session has expired. Sign in again to continue.";
  if (status === 403) return "This action is not available for your account.";
  if (status === 404) return "That round no longer exists.";
  if (status === 409)
    return "The round changed while you were away. Refresh to see the latest.";
  return unavailableMessage;
};

export const isPendingRound = (round: RoundView): boolean =>
  round.status === "active" ||
  round.status === "waiting-for-partner" ||
  round.status === "ready-to-reveal";

export const findPendingRound = (
  rounds: readonly RoundView[],
): RoundView | undefined => rounds.find(isPendingRound);

export const fetchRoundsState = async (): Promise<RoundsState> => {
  const response = await fetchJson("/activities/guess-my-answer/rounds");
  if (response.status === 401) return { kind: "sign-in" };
  if (response.status === 404) return { kind: "no-space" };
  if (response.status !== 200) return { kind: "unavailable" };
  const parsed = roundsSchema.safeParse(response.body);
  if (!parsed.success) return { kind: "unavailable" };
  return { kind: "ready", rounds: parsed.data.rounds.map(toRoundView) };
};

export const suggestPrompt = async (
  category: string | undefined,
  excludePromptVersionIds: readonly string[],
): Promise<CommandResult<PromptSuggestion>> => {
  const parameters = new URLSearchParams();
  if (category !== undefined && category !== "")
    parameters.set("category", category);
  if (excludePromptVersionIds.length > 0)
    parameters.set("exclude", excludePromptVersionIds.join(","));
  const suffix =
    parameters.toString() === "" ? "" : `?${parameters.toString()}`;
  const response = await fetchJson(
    `/activities/guess-my-answer/prompt${suffix}`,
  );
  if (response.status !== 200)
    return { message: messageForStatus(response.status), ok: false };
  const parsed = suggestionSchema.safeParse(response.body);
  return parsed.success
    ? { data: parsed.data, ok: true }
    : { message: unavailableMessage, ok: false };
};

export const startRound = async (
  promptVersionId: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    "/activities/guess-my-answer/rounds",
    "POST",
    { promptVersionId },
  );
  if (response.status === 201) return { data: null, ok: true };
  return { message: messageForStatus(response.status), ok: false };
};

export const submitAnswer = async (
  roundId: string,
  answer: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/activities/guess-my-answer/rounds/${roundId}/answer`,
    "POST",
    { answer },
  );
  if (response.status === 200) return { data: null, ok: true };
  return { message: messageForStatus(response.status), ok: false };
};

export const revealRound = async (
  roundId: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/activities/guess-my-answer/rounds/${roundId}/reveal`,
    "POST",
  );
  if (response.status === 200) return { data: null, ok: true };
  return { message: messageForStatus(response.status), ok: false };
};

export const cancelRound = async (
  roundId: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/activities/guess-my-answer/rounds/${roundId}/cancel`,
    "POST",
  );
  if (response.status === 200) return { data: null, ok: true };
  return { message: messageForStatus(response.status), ok: false };
};

export const reactToRound = async (
  roundId: string,
  reaction: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/activities/guess-my-answer/rounds/${roundId}/react`,
    "POST",
    { reaction },
  );
  if (response.status === 200) return { data: null, ok: true };
  return { message: messageForStatus(response.status), ok: false };
};
