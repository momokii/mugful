import { randomUUID } from "node:crypto";

import type { IdentityTransaction } from "./repository.js";
import {
  createSessionToken,
  hashSessionToken,
  type SessionPepper,
  type SessionToken,
} from "./session.js";

export const sessionLifetimeSeconds = 60 * 60 * 24 * 30;
export const sessionLifetimeMilliseconds = sessionLifetimeSeconds * 1000;

export type AuthenticatedSession = Readonly<{
  accountId: string;
  email: string;
  expiresAt: Date;
  sessionId: string;
  token: SessionToken;
}>;

export const createStoredSession = async (
  transaction: IdentityTransaction,
  input: Readonly<{
    accountId: string;
    deviceLabel: string | undefined;
    sessionPepper: SessionPepper;
  }>,
): Promise<AuthenticatedSession> => {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionLifetimeMilliseconds);
  const id = randomUUID();
  await transaction.query(
    `INSERT INTO sessions (id, account_id, token_hash, expires_at, device_label, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      id,
      input.accountId,
      hashSessionToken({ pepper: input.sessionPepper, token }),
      expiresAt,
      input.deviceLabel,
    ],
  );
  return {
    accountId: input.accountId,
    email: "",
    expiresAt,
    sessionId: id,
    token,
  };
};
