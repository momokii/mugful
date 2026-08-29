import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { IdentityRepository } from "../identity/repository.js";
import {
  promptAuditEventSchema,
  promptCategorySchema,
  promptTextSchema,
} from "./prompt-catalog.js";

const promptIdSchema = z.string().uuid();
const actorAccountIdSchema = z.string().uuid();
const changeReasonSchema = z.string().trim().min(1).max(500);

type ActiveVersionRow = Readonly<{ id: string; version: number }>;
type PromptExistenceRow = Readonly<{ id: string }>;
type ActivePromptRow = Readonly<{
  category: string;
  prompt_id: string;
  text: string;
  version: number;
}>;

type PromptCatalogDependencies = Readonly<{
  repository: IdentityRepository;
}>;

export type PromptCatalogEntry = Readonly<{
  category: string;
  promptId: string;
  text: string;
  version: number;
}>;

export type PromptCatalogService = Readonly<{
  createPrompt: (
    input: Readonly<{
      actorAccountId?: string | undefined;
      category: string;
      reason?: string | undefined;
      text: string;
    }>,
  ) => Promise<Readonly<{ promptId: string; version: number }>>;
  listActivePrompts: () => Promise<readonly PromptCatalogEntry[]>;
  retirePrompt: (
    input: Readonly<{
      actorAccountId?: string | undefined;
      promptId: string;
      reason?: string | undefined;
    }>,
  ) => Promise<"retired" | "retired-prompt" | "unknown-prompt">;
  updatePrompt: (
    input: Readonly<{
      actorAccountId?: string | undefined;
      category: string;
      promptId: string;
      reason?: string | undefined;
      text: string;
    }>,
  ) => Promise<"retired-prompt" | "unknown-prompt" | "updated">;
}>;

const nullable = (value: string | undefined): string | null => value ?? null;

export const createPromptCatalogService = (
  dependencies: PromptCatalogDependencies,
): PromptCatalogService => ({
  createPrompt: (input) => {
    const text = promptTextSchema.parse(input.text);
    const category = promptCategorySchema.parse(input.category);
    const actorAccountId =
      input.actorAccountId === undefined
        ? undefined
        : actorAccountIdSchema.parse(input.actorAccountId);
    const reason =
      input.reason === undefined
        ? undefined
        : changeReasonSchema.parse(input.reason);
    promptAuditEventSchema.parse({
      action: "created",
      previousVersion: null,
      nextVersion: 1,
    });
    const promptId = randomUUID();
    const versionId = randomUUID();

    return dependencies.repository.transaction(async (transaction) => {
      await transaction.query(
        "INSERT INTO prompts (id, created_by_account_id) VALUES ($1, $2)",
        [promptId, nullable(actorAccountId)],
      );
      await transaction.query(
        "INSERT INTO prompt_versions (id, prompt_id, version, text, category, created_by_account_id) VALUES ($1, $2, 1, $3, $4, $5)",
        [versionId, promptId, text, category, nullable(actorAccountId)],
      );
      await transaction.query(
        "INSERT INTO prompt_audit_events (prompt_id, action, previous_version, next_version, changed_by_account_id, reason) VALUES ($1, 'created', NULL, 1, $2, $3)",
        [promptId, nullable(actorAccountId), nullable(reason)],
      );
      return { promptId, version: 1 };
    });
  },

  listActivePrompts: async () => {
    const result = await dependencies.repository.query<ActivePromptRow>(
      "SELECT prompt_id, version, text, category FROM prompt_versions WHERE status = 'active' ORDER BY category, text",
    );
    return result.rows.map((row) => ({
      category: row.category,
      promptId: row.prompt_id,
      text: row.text,
      version: row.version,
    }));
  },

  retirePrompt: (input) => {
    const promptId = promptIdSchema.parse(input.promptId);
    const actorAccountId =
      input.actorAccountId === undefined
        ? undefined
        : actorAccountIdSchema.parse(input.actorAccountId);
    const reason =
      input.reason === undefined
        ? undefined
        : changeReasonSchema.parse(input.reason);

    return dependencies.repository.transaction(async (transaction) => {
      const active = await transaction.query<ActiveVersionRow>(
        "SELECT id, version FROM prompt_versions WHERE prompt_id = $1 AND status = 'active' FOR UPDATE",
        [promptId],
      );
      const current = active.rows[0];
      if (current === undefined) {
        const existing = await transaction.query<PromptExistenceRow>(
          "SELECT id FROM prompts WHERE id = $1",
          [promptId],
        );
        return existing.rows[0] === undefined
          ? "unknown-prompt"
          : "retired-prompt";
      }
      promptAuditEventSchema.parse({
        action: "retired",
        previousVersion: current.version,
        nextVersion: current.version,
      });
      await transaction.query(
        "UPDATE prompt_versions SET status = 'retired', retired_at = NOW() WHERE id = $1",
        [current.id],
      );
      await transaction.query(
        "INSERT INTO prompt_audit_events (prompt_id, action, previous_version, next_version, changed_by_account_id, reason) VALUES ($1, 'retired', $2, $2, $3, $4)",
        [promptId, current.version, nullable(actorAccountId), nullable(reason)],
      );
      return "retired";
    });
  },

  updatePrompt: (input) => {
    const promptId = promptIdSchema.parse(input.promptId);
    const text = promptTextSchema.parse(input.text);
    const category = promptCategorySchema.parse(input.category);
    const actorAccountId =
      input.actorAccountId === undefined
        ? undefined
        : actorAccountIdSchema.parse(input.actorAccountId);
    const reason =
      input.reason === undefined
        ? undefined
        : changeReasonSchema.parse(input.reason);

    return dependencies.repository.transaction(async (transaction) => {
      const active = await transaction.query<ActiveVersionRow>(
        "SELECT id, version FROM prompt_versions WHERE prompt_id = $1 AND status = 'active' FOR UPDATE",
        [promptId],
      );
      const current = active.rows[0];
      if (current === undefined) {
        const existing = await transaction.query<PromptExistenceRow>(
          "SELECT id FROM prompts WHERE id = $1",
          [promptId],
        );
        return existing.rows[0] === undefined
          ? "unknown-prompt"
          : "retired-prompt";
      }
      const nextVersion = current.version + 1;
      promptAuditEventSchema.parse({
        action: "updated",
        previousVersion: current.version,
        nextVersion,
      });
      await transaction.query(
        "UPDATE prompt_versions SET status = 'retired', retired_at = NOW() WHERE id = $1",
        [current.id],
      );
      await transaction.query(
        "INSERT INTO prompt_versions (id, prompt_id, version, text, category, created_by_account_id) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          randomUUID(),
          promptId,
          nextVersion,
          text,
          category,
          nullable(actorAccountId),
        ],
      );
      await transaction.query(
        "INSERT INTO prompt_audit_events (prompt_id, action, previous_version, next_version, changed_by_account_id, reason) VALUES ($1, 'updated', $2, $3, $4, $5)",
        [
          promptId,
          current.version,
          nextVersion,
          nullable(actorAccountId),
          nullable(reason),
        ],
      );
      return "updated";
    });
  },
});
