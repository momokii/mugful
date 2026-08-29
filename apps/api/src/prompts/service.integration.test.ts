import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { createIdentityRepository } from "../identity/repository.js";
import { createPromptCatalogService } from "./service.js";

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "prompt catalog service",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository = createIdentityRepository(pool);
    const service = createPromptCatalogService({ repository });
    const createdPromptIds: string[] = [];

    afterAll(async () => {
      if (createdPromptIds.length > 0) {
        await pool.query(
          "DELETE FROM prompt_audit_events WHERE prompt_id = ANY($1)",
          [createdPromptIds],
        );
        await pool.query(
          "DELETE FROM prompt_versions WHERE prompt_id = ANY($1)",
          [createdPromptIds],
        );
        await pool.query("DELETE FROM prompts WHERE id = ANY($1)", [
          createdPromptIds,
        ]);
      }
      await pool.end();
    });

    it("creates a versioned prompt with an audit trail", async () => {
      // Given: a curated prompt text and category
      const created = await service.createPrompt({
        category: "daily-life",
        reason: "Initial catalog seed",
        text: "  What made you smile today?  ",
      });
      createdPromptIds.push(created.promptId);

      // When: the persisted prompt state is inspected
      const [version, audit] = await Promise.all([
        pool.query<{
          readonly category: string;
          readonly status: string;
          readonly text: string;
          readonly version: number;
        }>(
          "SELECT version, text, category, status FROM prompt_versions WHERE prompt_id = $1",
          [created.promptId],
        ),
        pool.query<{
          readonly action: string;
          readonly next_version: number;
          readonly previous_version: number | null;
          readonly reason: string | null;
        }>(
          "SELECT action, previous_version, next_version, reason FROM prompt_audit_events WHERE prompt_id = $1",
          [created.promptId],
        ),
      ]);

      // Then: version one is active, text is canonical, and the creation is audited
      expect(created).toEqual({ promptId: created.promptId, version: 1 });
      expect(version.rows).toEqual([
        {
          category: "daily-life",
          status: "active",
          text: "What made you smile today?",
          version: 1,
        },
      ]);
      expect(audit.rows).toEqual([
        {
          action: "created",
          next_version: 1,
          previous_version: null,
          reason: "Initial catalog seed",
        },
      ]);
    });

    it("updates the active prompt to a new version and audits the change", async () => {
      // Given: an existing active prompt
      const created = await service.createPrompt({
        category: "memories",
        text: "What made you smile today?",
      });
      createdPromptIds.push(created.promptId);

      // When: the prompt is updated with replacement text
      const result = await service.updatePrompt({
        category: "memories",
        promptId: created.promptId,
        reason: "Sharper wording",
        text: "What made you smile this week?",
      });

      // Then: the new version is the only active one and both versions remain
      expect(result).toBe("updated");
      const versions = await pool.query<{
        readonly status: string;
        readonly text: string;
        readonly version: number;
      }>(
        "SELECT version, text, status FROM prompt_versions WHERE prompt_id = $1 ORDER BY version",
        [created.promptId],
      );
      expect(versions.rows).toEqual([
        {
          status: "retired",
          text: "What made you smile today?",
          version: 1,
        },
        {
          status: "active",
          text: "What made you smile this week?",
          version: 2,
        },
      ]);
      const audit = await pool.query<{
        readonly action: string;
        readonly next_version: number;
        readonly previous_version: number | null;
      }>(
        "SELECT action, previous_version, next_version FROM prompt_audit_events WHERE prompt_id = $1 ORDER BY changed_at",
        [created.promptId],
      );
      expect(
        audit.rows.map((row) => [
          row.action,
          row.previous_version,
          row.next_version,
        ]),
      ).toEqual([
        ["created", null, 1],
        ["updated", 1, 2],
      ]);
    });

    it("retires a prompt, rejects further changes, and records its own version", async () => {
      // Given: an existing active prompt
      const created = await service.createPrompt({
        category: "future",
        text: "Where would you like to travel together?",
      });
      createdPromptIds.push(created.promptId);

      // When: the prompt is retired and then updated again
      const retired = await service.retirePrompt({
        promptId: created.promptId,
        reason: "Beyond comfort boundary",
      });
      const afterRetirement = await service.updatePrompt({
        category: "future",
        promptId: created.promptId,
        text: "Replacement attempt",
      });

      // Then: retirement succeeds once and later changes are refused
      expect(retired).toBe("retired");
      expect(afterRetirement).toBe("retired-prompt");
      const audit = await pool.query<{ readonly action: string }>(
        "SELECT action FROM prompt_audit_events WHERE prompt_id = $1 ORDER BY changed_at",
        [created.promptId],
      );
      expect(audit.rows.map((row) => row.action)).toEqual([
        "created",
        "retired",
      ]);
      const retiredEvent = await pool.query<{
        readonly next_version: number;
        readonly previous_version: number;
      }>(
        "SELECT previous_version, next_version FROM prompt_audit_events WHERE prompt_id = $1 AND action = 'retired'",
        [created.promptId],
      );
      expect(retiredEvent.rows[0]?.previous_version).toBe(
        retiredEvent.rows[0]?.next_version,
      );
    });

    it("distinguishes unknown prompts from retired prompts", async () => {
      // Given: a prompt id that was never created
      const unknownId = randomUUID();

      // When: update and retire target the unknown prompt
      const [updated, retired] = await Promise.all([
        service.updatePrompt({
          category: "daily-life",
          promptId: unknownId,
          text: "Orphan attempt",
        }),
        service.retirePrompt({ promptId: unknownId }),
      ]);

      // Then: both operations report an unknown prompt
      expect(updated).toBe("unknown-prompt");
      expect(retired).toBe("unknown-prompt");
    });

    it("lists only active versions ordered by category and text", async () => {
      // Given: one updated prompt and one retired prompt alongside an active one
      const updated = await service.createPrompt({
        category: "daily-life",
        text: "Older active text",
      });
      createdPromptIds.push(updated.promptId);
      await service.updatePrompt({
        category: "daily-life",
        promptId: updated.promptId,
        text: "Newer active text",
      });
      const retired = await service.createPrompt({
        category: "daily-life",
        text: "Retired prompt text",
      });
      createdPromptIds.push(retired.promptId);
      await service.retirePrompt({ promptId: retired.promptId });
      const surviving = await service.createPrompt({
        category: "dreams",
        text: "A dream you both share",
      });
      createdPromptIds.push(surviving.promptId);
      const scopedIds = [
        updated.promptId,
        retired.promptId,
        surviving.promptId,
      ];

      // When: the active catalog is listed
      const entries = await service.listActivePrompts();
      const relevant = entries.filter((entry) =>
        scopedIds.includes(entry.promptId),
      );

      // Then: retired and superseded versions are excluded and ordering is by category, text
      expect(relevant).toEqual([
        {
          category: "daily-life",
          promptId: updated.promptId,
          text: "Newer active text",
          version: 2,
        },
        {
          category: "dreams",
          promptId: surviving.promptId,
          text: "A dream you both share",
          version: 1,
        },
      ]);
    });
  },
);
