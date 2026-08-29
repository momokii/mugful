import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from "@simplewebauthn/server";

import type { IdentityRepository } from "../identity/repository.js";
import type { SuperadminService } from "./service.js";
import { z } from "zod";

const clientDataSchema = z.object({
  challenge: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
});

const challengeFromResponse = (
  response: RegistrationResponseJSON | AuthenticationResponseJSON,
): string | undefined => {
  const parsed = clientDataSchema.safeParse(
    JSON.parse(
      Buffer.from(response.response.clientDataJSON, "base64url").toString(
        "utf8",
      ),
    ),
  );
  return parsed.success ? parsed.data.challenge : undefined;
};

type ChallengeRow = Readonly<{ challenge: string }>;
type CredentialStoreRow = Readonly<{
  public_key: string;
  sign_count: number;
}>;
type AccountEmailRow = Readonly<{ email: string }>;

type SuperadminWebauthnDependencies = Readonly<{
  origin: string;
  repository: IdentityRepository;
  rpID: string;
  rpName: string;
  superadminService: SuperadminService;
}>;

export type SuperadminWebauthnService = Readonly<{
  beginPasskeyAuthentication: (
    input: Readonly<{
      accountId: string;
    }>,
  ) => Promise<PublicKeyCredentialRequestOptionsJSON>;
  beginPasskeyRegistration: (
    input: Readonly<{
      accountId: string;
    }>,
  ) => Promise<PublicKeyCredentialCreationOptionsJSON>;
  completePasskeyAuthentication: (
    input: Readonly<{
      accountId: string;
      response: AuthenticationResponseJSON;
    }>,
  ) => Promise<"authenticated" | "invalid">;
  completePasskeyRegistration: (
    input: Readonly<{
      accountId: string;
      response: RegistrationResponseJSON;
    }>,
  ) => Promise<
    "duplicate-credential" | "invalid" | "not-superadmin" | "registered"
  >;
}>;

const challengeTtlMs = 5 * 60 * 1000;

const isChallengeRow = (row: ChallengeRow | undefined): row is ChallengeRow =>
  row !== undefined;

export const createSuperadminWebauthnService = (
  dependencies: SuperadminWebauthnDependencies,
): SuperadminWebauthnService => ({
  beginPasskeyRegistration: async ({ accountId }) => {
    const account = await dependencies.repository.query<AccountEmailRow>(
      "SELECT email FROM accounts WHERE id = $1",
      [accountId],
    );
    const storedAccount = account.rows[0];
    if (storedAccount === undefined)
      throw new Error("Unknown superadmin account");
    const options = await generateRegistrationOptions({
      attestationType: "none",
      rpID: dependencies.rpID,
      rpName: dependencies.rpName,
      userName: storedAccount.email,
    });
    await dependencies.repository.query(
      "INSERT INTO superadmin_webauthn_challenges (challenge, purpose, account_id, expires_at) VALUES ($1, 'registration', $2, NOW() + INTERVAL '1 millisecond' * $3)",
      [options.challenge, accountId, challengeTtlMs],
    );
    return options;
  },

  beginPasskeyAuthentication: async ({ accountId }) => {
    const credentials = await dependencies.repository.query<ChallengeRow>(
      "SELECT credential_id AS challenge FROM superadmin_passkey_credentials WHERE account_id = $1 AND revoked_at IS NULL",
      [accountId],
    );
    const options = await generateAuthenticationOptions({
      allowCredentials: credentials.rows.map((row) => ({ id: row.challenge })),
      rpID: dependencies.rpID,
    });
    await dependencies.repository.query(
      "INSERT INTO superadmin_webauthn_challenges (challenge, purpose, account_id, expires_at) VALUES ($1, 'authentication', $2, NOW() + INTERVAL '1 millisecond' * $3)",
      [options.challenge, accountId, challengeTtlMs],
    );
    return options;
  },

  completePasskeyRegistration: async ({ accountId, response }) => {
    const responseChallenge = challengeFromResponse(response);
    if (responseChallenge === undefined) return "invalid";
    const challenge = await dependencies.repository.transaction(
      async (transaction) => {
        const consumed = await transaction.query<ChallengeRow>(
          "UPDATE superadmin_webauthn_challenges SET consumed_at = NOW() WHERE challenge = $1 AND purpose = 'registration' AND account_id = $2 AND consumed_at IS NULL AND expires_at > NOW() RETURNING challenge",
          [responseChallenge, accountId],
        );
        return consumed.rows[0];
      },
    );
    if (!isChallengeRow(challenge)) return "invalid";
    try {
      const verification = await verifyRegistrationResponse({
        expectedChallenge: challenge.challenge,
        expectedOrigin: dependencies.origin,
        expectedRPID: dependencies.rpID,
        requireUserVerification: true,
        response,
      });
      if (!verification.verified) return "invalid";
      const credential = verification.registrationInfo.credential;
      const publicKey = Buffer.from(credential.publicKey).toString("base64url");
      const result = await dependencies.superadminService.registerPasskey({
        accountId,
        credentialId: credential.id,
        publicKey,
        signCount: credential.counter,
      });
      if (result === "not-superadmin" || result === "duplicate-credential")
        return result;
      return "registered";
    } catch {
      return "invalid";
    }
  },

  completePasskeyAuthentication: async ({ accountId, response }) => {
    const responseChallenge = challengeFromResponse(response);
    if (responseChallenge === undefined) return "invalid";
    const challenge = await dependencies.repository.transaction(
      async (transaction) => {
        const consumed = await transaction.query<ChallengeRow>(
          "UPDATE superadmin_webauthn_challenges SET consumed_at = NOW() WHERE challenge = $1 AND purpose = 'authentication' AND account_id = $2 AND consumed_at IS NULL AND expires_at > NOW() RETURNING challenge",
          [responseChallenge, accountId],
        );
        return consumed.rows[0];
      },
    );
    if (!isChallengeRow(challenge)) return "invalid";
    const stored = await dependencies.repository.query<CredentialStoreRow>(
      "SELECT public_key, sign_count FROM superadmin_passkey_credentials WHERE account_id = $1 AND credential_id = $2 AND revoked_at IS NULL",
      [accountId, response.id],
    );
    const credentialRow = stored.rows[0];
    if (credentialRow === undefined) return "invalid";
    const authenticator: WebAuthnCredential = {
      counter: credentialRow.sign_count,
      id: response.id,
      publicKey: Uint8Array.from(
        Buffer.from(credentialRow.public_key, "base64url"),
      ),
    };
    try {
      const verification = await verifyAuthenticationResponse({
        credential: authenticator,
        expectedChallenge: challenge.challenge,
        expectedOrigin: dependencies.origin,
        expectedRPID: dependencies.rpID,
        requireUserVerification: true,
        response,
      });
      if (!verification.verified) {
        await dependencies.repository.query(
          "INSERT INTO superadmin_audit_events (account_id, action, detail, changed_by_account_id) VALUES ($1, 'authentication_failed', 'webauthn-unverified', $1)",
          [accountId],
        );
        return "invalid";
      }
      const newCounter = verification.authenticationInfo.newCounter;
      if (
        credentialRow.sign_count > 0 &&
        newCounter <= credentialRow.sign_count
      ) {
        await dependencies.repository.query(
          "INSERT INTO superadmin_audit_events (account_id, action, detail, changed_by_account_id) VALUES ($1, 'authentication_failed', 'webauthn-counter-regression', $1)",
          [accountId],
        );
        return "invalid";
      }
      await dependencies.repository.query(
        "UPDATE superadmin_passkey_credentials SET sign_count = $2, last_used_at = NOW() WHERE account_id = $1 AND credential_id = $3",
        [accountId, newCounter, response.id],
      );
      await dependencies.repository.query(
        "INSERT INTO superadmin_audit_events (account_id, action, detail, changed_by_account_id) VALUES ($1, 'authentication_succeeded', 'webauthn', $1)",
        [accountId],
      );
      return "authenticated";
    } catch {
      await dependencies.repository.query(
        "INSERT INTO superadmin_audit_events (account_id, action, detail, changed_by_account_id) VALUES ($1, 'authentication_failed', 'webauthn-malformed', $1)",
        [accountId],
      );
      return "invalid";
    }
  },
});
