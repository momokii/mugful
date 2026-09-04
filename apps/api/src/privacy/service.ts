import { z } from "zod";

import type { IdentityRepository } from "../identity/repository.js";

const accountIdSchema = z.string().uuid();
const displayNameSchema = z.string().trim().min(1).max(80);
const reasonSchema = z.string().trim().min(1).max(500);

const deletionGraceMs = 30 * 24 * 60 * 60 * 1000;

type PrivacyServiceDependencies = Readonly<{
  repository: IdentityRepository;
}>;

export type PrivacyExport = Readonly<{
  account: Readonly<{
    displayName: string;
    email: string;
    emailVerified: boolean;
  }>;
  consents: readonly Readonly<{
    grantedAt: string;
    kind: string;
    version: string;
    withdrawnAt: string | null;
  }>[];
  coupleSpace: Readonly<{ id: string; status: string }> | null;
  privacyRequests: readonly Readonly<{
    kind: string;
    requestedAt: string;
    status: string;
  }>[];
  rounds: readonly Readonly<{
    answer: string;
    promptText: string;
    roundId: string;
    status: string;
  }>[];
  restriction: Readonly<{
    liftedAt: string | null;
    reason: string | null;
    restrictedAt: string;
  }> | null;
}>;

export type PrivacyService = Readonly<{
  correctProfile: (
    input: Readonly<{ accountId: string; displayName: string }>,
  ) => Promise<"corrected">;
  exportData: (accountId: string) => Promise<PrivacyExport>;
  liftRestriction: (accountId: string) => Promise<"lifted" | "not-restricted">;
  requestDeletion: (
    accountId: string,
  ) => Promise<"already-requested" | "deleted">;
  restrictProcessing: (
    input: Readonly<{ accountId: string; reason?: string | undefined }>,
  ) => Promise<"already-restricted" | "restricted">;
  withdrawConsent: (
    accountId: string,
  ) => Promise<"already-withdrawn" | "withdrawn">;
}>;

export const createPrivacyService = (
  dependencies: PrivacyServiceDependencies,
): PrivacyService => ({
  exportData: async (rawAccountId) => {
    const accountId = accountIdSchema.parse(rawAccountId);
    const account = await dependencies.repository.query<{
      display_name: string;
      email: string;
      email_verified_at: Date | null;
    }>(
      "SELECT display_name, email, email_verified_at FROM accounts WHERE id = $1",
      [accountId],
    );
    const row = account.rows[0];
    if (row === undefined) throw new Error("Unknown account");
    const [consents, requests, restriction, membership, answers] =
      await Promise.all([
        dependencies.repository.query<{
          granted_at: Date;
          kind: string;
          version: string;
          withdrawn_at: Date | null;
        }>(
          "SELECT kind, version, granted_at, withdrawn_at FROM account_consents WHERE account_id = $1 ORDER BY kind",
          [accountId],
        ),
        dependencies.repository.query<{
          kind: string;
          requested_at: Date;
          status: string;
        }>(
          "SELECT kind, status, requested_at FROM privacy_requests WHERE account_id = $1 ORDER BY requested_at DESC LIMIT 20",
          [accountId],
        ),
        dependencies.repository.query<{
          lifted_at: Date | null;
          reason: string | null;
          restricted_at: Date;
        }>(
          "SELECT restricted_at, reason, lifted_at FROM account_processing_restrictions WHERE account_id = $1",
          [accountId],
        ),
        dependencies.repository.query<{ id: string }>(
          "SELECT couple_space_id AS id FROM couple_memberships WHERE account_id = $1 AND revoked_at IS NULL LIMIT 1",
          [accountId],
        ),
        dependencies.repository.query<{
          answer: string;
          prompt_text: string;
          round_id: string;
          status: string;
        }>(
          `SELECT r.id AS round_id, r.status, pv.text AS prompt_text, a.answer
         FROM round_answers a
         JOIN rounds r ON r.id = a.round_id
         JOIN prompt_versions pv ON pv.id = r.prompt_version_id
         WHERE a.account_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
          [accountId],
        ),
      ]);
    const spaceId = membership.rows[0]?.id ?? null;
    const space = spaceId
      ? await dependencies.repository.query<{ status: string }>(
          "SELECT CASE WHEN ended_at IS NULL THEN 'active' ELSE 'ended' END AS status FROM couple_spaces WHERE id = $1",
          [spaceId],
        )
      : undefined;
    await dependencies.repository.query(
      "INSERT INTO privacy_requests (account_id, kind, payload) VALUES ($1, 'export', $2)",
      [accountId, JSON.stringify({ at: new Date().toISOString() })],
    );
    return {
      account: {
        displayName: row.display_name,
        email: row.email,
        emailVerified: row.email_verified_at !== null,
      },
      consents: consents.rows.map((c) => ({
        grantedAt: c.granted_at.toISOString(),
        kind: c.kind,
        version: c.version,
        withdrawnAt: c.withdrawn_at?.toISOString() ?? null,
      })),
      coupleSpace: spaceId
        ? { id: spaceId, status: space?.rows[0]?.status ?? "unknown" }
        : null,
      privacyRequests: requests.rows.map((r) => ({
        kind: r.kind,
        requestedAt: r.requested_at.toISOString(),
        status: r.status,
      })),
      restriction: restriction.rows[0]
        ? {
            liftedAt: restriction.rows[0].lifted_at?.toISOString() ?? null,
            reason: restriction.rows[0].reason,
            restrictedAt: restriction.rows[0].restricted_at.toISOString(),
          }
        : null,
      rounds: answers.rows.map((a) => ({
        answer: a.answer,
        promptText: a.prompt_text,
        roundId: a.round_id,
        status: a.status,
      })),
    };
  },

  correctProfile: async (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const displayName = displayNameSchema.parse(input.displayName);
    await dependencies.repository.query(
      "UPDATE accounts SET display_name = $2, updated_at = NOW() WHERE id = $1",
      [accountId, displayName],
    );
    await dependencies.repository.query(
      "INSERT INTO privacy_requests (account_id, kind, payload) VALUES ($1, 'correction', $2)",
      [accountId, JSON.stringify({ displayName })],
    );
    return "corrected";
  },

  requestDeletion: async (rawAccountId) => {
    const accountId = accountIdSchema.parse(rawAccountId);
    return dependencies.repository.transaction(async (tx) => {
      const existing = await tx.query<{ deletion_requested_at: Date | null }>(
        "SELECT deletion_requested_at FROM accounts WHERE id = $1 FOR UPDATE",
        [accountId],
      );
      if (existing.rows[0]?.deletion_requested_at !== null)
        return "already-requested";
      const graceEndsAt = new Date(Date.now() + deletionGraceMs);
      await tx.query(
        "UPDATE accounts SET deletion_requested_at = NOW(), deletion_grace_ends_at = $2, updated_at = NOW() WHERE id = $1",
        [accountId, graceEndsAt],
      );
      await tx.query(
        "INSERT INTO privacy_requests (account_id, kind, payload) VALUES ($1, 'deletion', $2)",
        [accountId, JSON.stringify({ graceEndsAt: graceEndsAt.toISOString() })],
      );
      await tx.query(
        "UPDATE couple_memberships SET revoked_at = NOW() WHERE account_id = $1 AND revoked_at IS NULL",
        [accountId],
      );
      return "deleted";
    });
  },

  withdrawConsent: async (rawAccountId) => {
    const accountId = accountIdSchema.parse(rawAccountId);
    return dependencies.repository.transaction(async (tx) => {
      const result = await tx.query<{ withdrawn_at: Date | null }>(
        "SELECT withdrawn_at FROM account_consents WHERE account_id = $1 AND kind IN ('privacy','terms') AND withdrawn_at IS NULL LIMIT 1",
        [accountId],
      );
      if (result.rows.length === 0) return "already-withdrawn";
      await tx.query(
        "UPDATE account_consents SET withdrawn_at = NOW() WHERE account_id = $1 AND kind IN ('privacy','terms') AND withdrawn_at IS NULL",
        [accountId],
      );
      await tx.query(
        "UPDATE accounts SET withdrawal_requested_at = NOW(), updated_at = NOW() WHERE id = $1",
        [accountId],
      );
      await tx.query(
        "INSERT INTO privacy_requests (account_id, kind) VALUES ($1, 'withdrawal')",
        [accountId],
      );
      return "withdrawn";
    });
  },

  restrictProcessing: async (input) => {
    const accountId = accountIdSchema.parse(input.accountId);
    const reason =
      input.reason === undefined ? undefined : reasonSchema.parse(input.reason);
    return dependencies.repository.transaction(async (tx) => {
      const existing = await tx.query<{ lifted_at: Date | null }>(
        "SELECT lifted_at FROM account_processing_restrictions WHERE account_id = $1 FOR UPDATE",
        [accountId],
      );
      if (existing.rows[0] !== undefined && existing.rows[0].lifted_at === null)
        return "already-restricted";
      await tx.query(
        "INSERT INTO account_processing_restrictions (account_id, reason) VALUES ($1, $2) ON CONFLICT (account_id) DO UPDATE SET restricted_at = NOW(), reason = $2, lifted_at = NULL",
        [accountId, reason ?? null],
      );
      await tx.query(
        "INSERT INTO privacy_requests (account_id, kind, payload) VALUES ($1, 'restriction', $2)",
        [accountId, JSON.stringify({ reason: reason ?? null })],
      );
      return "restricted";
    });
  },

  liftRestriction: async (rawAccountId) => {
    const accountId = accountIdSchema.parse(rawAccountId);
    const result = await dependencies.repository.query<{
      lifted_at: Date | null;
    }>(
      "SELECT lifted_at FROM account_processing_restrictions WHERE account_id = $1",
      [accountId],
    );
    if (result.rows.length === 0 || result.rows[0]?.lifted_at !== null)
      return "not-restricted";
    await dependencies.repository.query(
      "UPDATE account_processing_restrictions SET lifted_at = NOW() WHERE account_id = $1",
      [accountId],
    );
    await dependencies.repository.query(
      "INSERT INTO privacy_requests (account_id, kind) VALUES ($1, 'restriction')",
      [accountId],
    );
    return "lifted";
  },
});
