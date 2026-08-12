import type { IdentityEmailService } from "./email-service.js";
import type { RateLimitPrincipalPepper } from "./rate-limit.js";
import { consumeRateLimitAttempt } from "./rate-limit-store.js";
import { hashPassword } from "./password.js";
import type { IdentityRepository } from "./repository.js";

type RegistrationInput = Readonly<{
  adultAttestation: true;
  displayName: string;
  email: string;
  password: string;
  privacyAccepted: true;
  privacyVersion: string;
  termsAccepted: true;
  termsVersion: string;
}>;

type RegistrationDependencies = Readonly<{
  emailService: IdentityEmailService;
  rateLimitPrincipalPepper: RateLimitPrincipalPepper;
  repository: IdentityRepository;
}>;

const canonicalEmail = (email: string): string => email.trim().toLowerCase();

export const registerAccount = async (
  dependencies: RegistrationDependencies,
  input: RegistrationInput,
): Promise<"accepted" | "rate-limited"> => {
  const email = canonicalEmail(input.email);
  const allowed = await consumeRateLimitAttempt(dependencies.repository, {
    pepper: dependencies.rateLimitPrincipalPepper,
    principal: `register:${email}`,
  });
  if (!allowed) return "rate-limited";
  const passwordHash = await hashPassword(input.password);
  let account: Readonly<{ email: string; id: string }> | undefined;
  try {
    account = await dependencies.repository.transaction(async (transaction) => {
      const created = await transaction.query<Readonly<{ id: string }>>(
        "INSERT INTO accounts (email, normalized_email, display_name, password_hash) VALUES ($1, $1, $2, $3) RETURNING id",
        [email, input.displayName, passwordHash],
      );
      const row = created.rows[0];
      if (row === undefined) throw new Error("Account creation failed");
      await transaction.query(
        "INSERT INTO account_consents (account_id, kind, version) VALUES ($1, 'adult_attestation', $2), ($1, 'terms', $3), ($1, 'privacy', $4)",
        [row.id, "adult-v1", input.termsVersion, input.privacyVersion],
      );
      return { email, id: row.id };
    });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      typeof error.code !== "string" ||
      error.code !== "23505"
    )
      throw error;
  }
  if (account !== undefined)
    await dependencies.emailService.issueVerificationForAccount(account);
  return "accepted";
};
