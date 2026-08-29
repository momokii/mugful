import { randomUUID } from "node:crypto";

import * as webauthnServer from "@simplewebauthn/server";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityRepository } from "../identity/repository.js";
import { createIdentityRepository } from "../identity/repository.js";
import { createSuperadminService } from "./service.js";
import { createSuperadminWebauthnService } from "./webauthn.js";

const uniqueChallenge = (): string =>
  Buffer.from(randomUUID()).toString("base64url");

let lastCredentialId = "";

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: uniqueChallenge(),
    rp: { id: "mugful.test", name: "Mugful" },
    user: { id: "dXNlci1pZA", name: "admin@mugful.test", displayName: "" },
    pubKeyCredParams: [],
    timeout: 300_000,
    attestation: "none",
  })),
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: uniqueChallenge(),
    rpId: "mugful.test",
    timeout: 300_000,
    userVerification: "required",
  })),
  verifyRegistrationResponse: vi.fn(async () => {
    lastCredentialId = Buffer.from(`cred-${randomUUID()}`).toString(
      "base64url",
    );
    return {
      verified: true,
      registrationInfo: {
        credential: {
          id: lastCredentialId,
          publicKey: new Uint8Array(64).fill(7),
          counter: 0,
        },
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        origin: "https://mugful.test",
        rpID: "mugful.test",
        fmt: "none",
        aaguid: "00000000-0000-0000-0000-000000000000",
      },
    };
  }),
  verifyAuthenticationResponse: vi.fn(async (options) => ({
    verified: true,
    authenticationInfo: {
      newCounter:
        options.credential.counter === 0 ? 1 : options.credential.counter + 1,
    },
  })),
}));

const databaseUrl = process.env["DATABASE_URL"] ?? "";
const databaseTestsEnabled =
  process.env["MUGFUL_RUN_DATABASE_TESTS"] === "true";

describe.skipIf(!databaseTestsEnabled || databaseUrl === "")(
  "superadmin WebAuthn ceremony orchestration",
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository: IdentityRepository = createIdentityRepository(pool);
    const superadminService = createSuperadminService({ repository });
    const webauthnService = createSuperadminWebauthnService({
      origin: "https://mugful.test",
      repository,
      rpID: "mugful.test",
      rpName: "Mugful",
      superadminService,
    });
    const createdAccountIds: string[] = [];

    const createSuperadminAccount = async (): Promise<string> => {
      const accountId = randomUUID();
      const email = `${accountId}@superadmin.test`;
      await pool.query(
        "INSERT INTO accounts (id, email, normalized_email, display_name, password_hash, email_verified_at) VALUES ($1, $2, $3, $4, $5, NOW())",
        [accountId, email, email, "Ceremony", "test-only-not-a-real-hash"],
      );
      await superadminService.grantSuperadmin({ accountId });
      createdAccountIds.push(accountId);
      return accountId;
    };

    const registrationResponse = (challenge: string) =>
      ({
        id: "pending-registration",
        rawId: "pending-registration",
        response: {
          attestationObject: "o2NmbXRub25l",
          clientDataJSON: Buffer.from(
            JSON.stringify({
              challenge,
              origin: "https://mugful.test",
              type: "webauthn.create",
            }),
          ).toString("base64url"),
          transports: ["internal"],
        },
        type: "public-key",
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      }) as never;

    const authenticationResponse = (challenge: string, credentialId: string) =>
      ({
        id: credentialId,
        rawId: credentialId,
        response: {
          authenticatorData: "c2FtcGxlLWF1dGhlbnRpY2F0b3JEYXRh",
          clientDataJSON: Buffer.from(
            JSON.stringify({
              challenge,
              origin: "https://mugful.test",
              type: "webauthn.get",
            }),
          ).toString("base64url"),
          signature: "c2FtcGxlLXNpZ25hdHVyZQ",
          userHandle: "dXNlci1pZA",
        },
        type: "public-key",
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      }) as never;

    beforeEach(async () => {
      vi.clearAllMocks();
    });

    afterAll(async () => {
      if (createdAccountIds.length > 0) {
        await pool.query(
          "DELETE FROM superadmin_webauthn_challenges WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_audit_events WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_passkey_credentials WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query(
          "DELETE FROM superadmin_accounts WHERE account_id = ANY($1)",
          [createdAccountIds],
        );
        await pool.query("DELETE FROM accounts WHERE id = ANY($1)", [
          createdAccountIds,
        ]);
      }
      await pool.end();
    });

    it("stores a registration challenge and registers the verified credential once", async () => {
      // Given: a granted superadmin account
      const accountId = await createSuperadminAccount();
      const options = await webauthnService.beginPasskeyRegistration({
        accountId,
      });

      // When: the registration response is completed twice with the same challenge
      const first = await webauthnService.completePasskeyRegistration({
        accountId,
        response: registrationResponse(options.challenge),
      });
      const replay = await webauthnService.completePasskeyRegistration({
        accountId,
        response: registrationResponse(options.challenge),
      });

      // Then: only the first completion registers and the challenge is consumed
      expect(first).toBe("registered");
      expect(replay).toBe("invalid");
      const credential = await pool.query<{ readonly sign_count: number }>(
        "SELECT sign_count FROM superadmin_passkey_credentials WHERE account_id = $1",
        [accountId],
      );
      expect(credential.rows).toHaveLength(1);
      expect(credential.rows[0]?.sign_count).toBe(0);
    });

    it("authenticates with the stored credential, advances the counter, and rejects regression", async () => {
      // Given: an account with a registered credential at counter zero
      const accountId = await createSuperadminAccount();
      const registration = await webauthnService.beginPasskeyRegistration({
        accountId,
      });
      await webauthnService.completePasskeyRegistration({
        accountId,
        response: registrationResponse(registration.challenge),
      });
      const registeredCredentialId = lastCredentialId;

      // When: authentication completes successfully twice, then the counter regresses
      const firstOptions = await webauthnService.beginPasskeyAuthentication({
        accountId,
      });
      const firstAuth = await webauthnService.completePasskeyAuthentication({
        accountId,
        response: authenticationResponse(
          firstOptions.challenge,
          registeredCredentialId,
        ),
      });
      const secondOptions = await webauthnService.beginPasskeyAuthentication({
        accountId,
      });
      const secondAuth = await webauthnService.completePasskeyAuthentication({
        accountId,
        response: authenticationResponse(
          secondOptions.challenge,
          registeredCredentialId,
        ),
      });
      const regressionOptions =
        await webauthnService.beginPasskeyAuthentication({ accountId });
      vi.mocked(
        webauthnServer.verifyAuthenticationResponse,
      ).mockImplementationOnce(
        async () =>
          ({
            verified: true,
            authenticationInfo: { newCounter: 1 },
          }) as never,
      );
      const regression = await webauthnService.completePasskeyAuthentication({
        accountId,
        response: authenticationResponse(
          regressionOptions.challenge,
          registeredCredentialId,
        ),
      });

      // Then: both real authentications succeed and the regression is rejected
      expect(firstAuth).toBe("authenticated");
      expect(secondAuth).toBe("authenticated");
      expect(regression).toBe("invalid");
      const credential = await pool.query<{ readonly sign_count: number }>(
        "SELECT sign_count FROM superadmin_passkey_credentials WHERE account_id = $1",
        [accountId],
      );
      expect(credential.rows[0]?.sign_count).toBe(2);
      const failures = await pool.query<{ readonly detail: string }>(
        "SELECT detail FROM superadmin_audit_events WHERE account_id = $1 AND action = 'authentication_failed'",
        [accountId],
      );
      expect(failures.rows).toEqual([
        { detail: "webauthn-counter-regression" },
      ]);
    });

    it("consumes authentication challenges exactly once and audits successes", async () => {
      // Given: an account with a registered credential and one issued challenge
      const accountId = await createSuperadminAccount();
      const registration = await webauthnService.beginPasskeyRegistration({
        accountId,
      });
      await webauthnService.completePasskeyRegistration({
        accountId,
        response: registrationResponse(registration.challenge),
      });
      const authentication = await webauthnService.beginPasskeyAuthentication({
        accountId,
      });

      // When: the same challenge is completed twice
      const first = await webauthnService.completePasskeyAuthentication({
        accountId,
        response: authenticationResponse(
          authentication.challenge,
          lastCredentialId,
        ),
      });
      const replay = await webauthnService.completePasskeyAuthentication({
        accountId,
        response: authenticationResponse(
          authentication.challenge,
          lastCredentialId,
        ),
      });

      // Then: the replay is rejected before any credential work
      expect(first).toBe("authenticated");
      expect(replay).toBe("invalid");
      const successes = await pool.query<{ readonly detail: string }>(
        "SELECT detail FROM superadmin_audit_events WHERE account_id = $1 AND action = 'authentication_succeeded'",
        [accountId],
      );
      expect(successes.rows).toEqual([{ detail: "webauthn" }]);
    });
  },
);
