import { z } from "zod";

export const roundStatusSchema = z.enum([
  "active",
  "waiting-for-partner",
  "ready-to-reveal",
  "revealed",
  "completed",
  "cancelled",
]);

export const roundAnswerSchema = z.string().trim().min(1).max(1000);

export const roundReactionSchema = z.string().trim().min(1).max(32);

export type RoundStatus = z.infer<typeof roundStatusSchema>;

export type RoundAnswer = z.infer<typeof roundAnswerSchema>;

export type RoundReaction = z.infer<typeof roundReactionSchema>;

export const pendingRoundStatuses = [
  "active",
  "waiting-for-partner",
  "ready-to-reveal",
] as const;

export const isPendingRoundStatus = (
  status: RoundStatus,
): status is (typeof pendingRoundStatuses)[number] =>
  (pendingRoundStatuses as readonly string[]).includes(status);

const legalTransitions: Readonly<Record<RoundStatus, readonly RoundStatus[]>> =
  {
    active: ["waiting-for-partner", "cancelled"],
    "waiting-for-partner": ["ready-to-reveal", "cancelled"],
    "ready-to-reveal": ["completed"],
    revealed: ["completed"],
    completed: [],
    cancelled: [],
  };

export const canTransitionRound = (
  from: RoundStatus,
  to: RoundStatus,
): boolean => legalTransitions[from].includes(to);

export const legalRoundTransitions = (
  from: RoundStatus,
): readonly RoundStatus[] => legalTransitions[from];
