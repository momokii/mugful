import { randomUUID } from "node:crypto";

import type {
  IdentityRepository,
  IdentityTransaction,
} from "../identity/repository.js";
import {
  createInviteToken,
  hashInviteToken,
  type InviteToken,
  type InviteTokenPepper,
} from "./invite-token.js";

const inviteLifetimeMilliseconds = 1000 * 60 * 60 * 24 * 7;
const deletionGraceMilliseconds = 1000 * 60 * 60 * 24 * 30;

type InviteRow = Readonly<{
  couple_space_id: string;
  created_by_account_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  consumed_at: Date | null;
  ended_at: Date | null;
}>;

type MembershipCountRow = Readonly<{ count: string }>;
type SpaceRow = Readonly<{ id: string }>;

export type CoupleService = Readonly<{
  acceptInvite: (
    input: Readonly<{ accountId: string; token: InviteToken }>,
  ) => Promise<"accepted" | "invalid-invite" | "not-eligible">;
  createSpace: (
    accountId: string,
  ) => Promise<
    Readonly<{ inviteToken: InviteToken; spaceId: string }> | "already-coupled"
  >;
  endSpace: (accountId: string) => Promise<"ended" | "forbidden">;
}>;

type CoupleServiceDependencies = Readonly<{
  inviteTokenPepper: InviteTokenPepper;
  repository: IdentityRepository;
}>;

const activeMembershipExists = async (
  transaction: IdentityTransaction,
  accountId: string,
): Promise<boolean> => {
  const result = await transaction.query<SpaceRow>(
    "SELECT couple_space_id AS id FROM couple_memberships WHERE account_id = $1 AND revoked_at IS NULL FOR UPDATE",
    [accountId],
  );
  return result.rows.length > 0;
};

const lockAccount = async (
  transaction: IdentityTransaction,
  accountId: string,
): Promise<void> => {
  await transaction.query("SELECT id FROM accounts WHERE id = $1 FOR UPDATE", [
    accountId,
  ]);
};

const createInvite = async (
  transaction: IdentityTransaction,
  input: Readonly<{
    accountId: string;
    inviteTokenPepper: InviteTokenPepper;
    spaceId: string;
  }>,
): Promise<InviteToken> => {
  const token = createInviteToken();
  await transaction.query(
    `INSERT INTO couple_invites (id, couple_space_id, created_by_account_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      input.spaceId,
      input.accountId,
      hashInviteToken({ pepper: input.inviteTokenPepper, token }),
      new Date(Date.now() + inviteLifetimeMilliseconds),
    ],
  );
  return token;
};

export const createCoupleService = (
  dependencies: CoupleServiceDependencies,
): CoupleService => ({
  acceptInvite: async (input) =>
    dependencies.repository.transaction(async (transaction) => {
      await lockAccount(transaction, input.accountId);
      if (await activeMembershipExists(transaction, input.accountId))
        return "not-eligible";
      const inviteResult = await transaction.query<InviteRow>(
        `SELECT couple_invites.couple_space_id, couple_invites.created_by_account_id,
                couple_invites.expires_at, couple_invites.revoked_at, couple_invites.consumed_at,
                couple_spaces.ended_at
         FROM couple_invites JOIN couple_spaces ON couple_spaces.id = couple_invites.couple_space_id
         WHERE couple_invites.token_hash = $1 FOR UPDATE OF couple_invites, couple_spaces`,
        [
          hashInviteToken({
            pepper: dependencies.inviteTokenPepper,
            token: input.token,
          }),
        ],
      );
      const [invite] = inviteResult.rows;
      if (
        invite === undefined ||
        invite.created_by_account_id === input.accountId ||
        invite.consumed_at !== null ||
        invite.revoked_at !== null ||
        invite.ended_at !== null ||
        invite.expires_at <= new Date()
      )
        return "invalid-invite";
      const members = await transaction.query<MembershipCountRow>(
        "SELECT count(*)::text AS count FROM couple_memberships WHERE couple_space_id = $1 AND revoked_at IS NULL",
        [invite.couple_space_id],
      );
      const [memberCount] = members.rows;
      if (memberCount === undefined || Number(memberCount.count) >= 2)
        return "not-eligible";
      await transaction.query(
        "INSERT INTO couple_memberships (couple_space_id, account_id) VALUES ($1, $2)",
        [invite.couple_space_id, input.accountId],
      );
      await transaction.query(
        "UPDATE couple_invites SET consumed_at = NOW(), consumed_by_account_id = $1 WHERE token_hash = $2",
        [
          input.accountId,
          hashInviteToken({
            pepper: dependencies.inviteTokenPepper,
            token: input.token,
          }),
        ],
      );
      await transaction.query(
        "UPDATE couple_invites SET revoked_at = NOW() WHERE couple_space_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL",
        [invite.couple_space_id],
      );
      return "accepted";
    }),
  createSpace: async (accountId) =>
    dependencies.repository.transaction(async (transaction) => {
      await lockAccount(transaction, accountId);
      if (await activeMembershipExists(transaction, accountId))
        return "already-coupled";
      const spaceId = randomUUID();
      await transaction.query(
        "INSERT INTO couple_spaces (id, created_by_account_id) VALUES ($1, $2)",
        [spaceId, accountId],
      );
      await transaction.query(
        "INSERT INTO couple_memberships (couple_space_id, account_id) VALUES ($1, $2)",
        [spaceId, accountId],
      );
      const inviteToken = await createInvite(transaction, {
        accountId,
        inviteTokenPepper: dependencies.inviteTokenPepper,
        spaceId,
      });
      return { inviteToken, spaceId };
    }),
  endSpace: async (accountId) =>
    dependencies.repository.transaction(async (transaction) => {
      const space = await transaction.query<SpaceRow>(
        `SELECT couple_spaces.id FROM couple_spaces
         JOIN couple_memberships ON couple_memberships.couple_space_id = couple_spaces.id
         WHERE couple_memberships.account_id = $1 AND couple_memberships.revoked_at IS NULL
           AND couple_spaces.ended_at IS NULL FOR UPDATE OF couple_spaces`,
        [accountId],
      );
      const [activeSpace] = space.rows;
      if (activeSpace === undefined) return "forbidden";
      await transaction.query(
        "UPDATE couple_spaces SET ended_at = NOW(), ended_by_account_id = $1, deletion_grace_ends_at = $2 WHERE id = $3",
        [
          accountId,
          new Date(Date.now() + deletionGraceMilliseconds),
          activeSpace.id,
        ],
      );
      await transaction.query(
        "UPDATE couple_memberships SET revoked_at = NOW() WHERE couple_space_id = $1 AND revoked_at IS NULL",
        [activeSpace.id],
      );
      await transaction.query(
        "UPDATE couple_invites SET revoked_at = NOW() WHERE couple_space_id = $1 AND consumed_at IS NULL AND revoked_at IS NULL",
        [activeSpace.id],
      );
      return "ended";
    }),
});
