"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { z } from "zod";

import { fetchJson, mutateIdentity } from "./identity-client";

export type SuperadminStatus =
  | Readonly<{ kind: "checking" }>
  | Readonly<{ kind: "forbidden" }>
  | Readonly<{ kind: "ready"; mfaVerified: boolean }>
  | Readonly<{ kind: "sign-in" }>
  | Readonly<{ kind: "unavailable" }>;

export type SuperadminPrompt = Readonly<{
  category: string;
  promptId: string;
  text: string;
  version: number;
}>;

export type PromptInput = Readonly<{
  category: string;
  reason: string | undefined;
  text: string;
}>;

export type CommandResult<data> =
  Readonly<{ data: data; ok: true }> | Readonly<{ message: string; ok: false }>;

export const unavailableMessage =
  "Mugful could not reach this console. Try again in a moment.";

const messageForStatus = (status: number): string => {
  if (status === 400)
    return "Mugful could not accept that prompt. Check the text and category, then try again.";
  if (status === 401)
    return "Your session or verification has expired. Verify again to continue.";
  if (status === 403)
    return "This action needs an active superadmin role and a fresh passkey verification.";
  if (status === 404)
    return "That prompt no longer exists. Refresh the list to continue.";
  if (status === 409)
    return "That prompt is retired and can no longer be changed.";
  return unavailableMessage;
};

function result<data>(
  status: number,
  parse: (body: unknown) => data | undefined,
  body: unknown,
): CommandResult<data> {
  if (status !== 200 && status !== 201)
    return { message: messageForStatus(status), ok: false };
  const data = parse(body);
  return data === undefined
    ? { message: unavailableMessage, ok: false }
    : { data, ok: true };
}

const statusSchema = z
  .object({ mfaVerified: z.boolean(), superadmin: z.boolean() })
  .loose();

const requestOptionsSchema = z
  .object({
    allowCredentials: z
      .array(
        z.object({ id: z.string(), type: z.literal("public-key") }).loose(),
      )
      .optional(),
    challenge: z.string(),
    rpId: z.string().optional(),
    timeout: z.number().optional(),
    userVerification: z
      .enum(["required", "preferred", "discouraged"])
      .optional(),
  })
  .loose();

const optionsSchema = z.object({ options: requestOptionsSchema }).loose();

type VerifiedRequestOptions = z.infer<typeof requestOptionsSchema>;

const authenticationOptions = (
  value: VerifiedRequestOptions,
): PublicKeyCredentialRequestOptionsJSON => ({
  challenge: value.challenge,
  ...(value.allowCredentials === undefined
    ? {}
    : { allowCredentials: value.allowCredentials }),
  ...(value.rpId === undefined ? {} : { rpId: value.rpId }),
  ...(value.timeout === undefined ? {} : { timeout: value.timeout }),
  ...(value.userVerification === undefined
    ? {}
    : { userVerification: value.userVerification }),
});

const promptsSchema = z.object({
  prompts: z.array(
    z
      .object({
        category: z.string(),
        promptId: z.string(),
        text: z.string(),
        version: z.number(),
      })
      .loose(),
  ),
});

export const fetchSuperadminStatus = async (): Promise<SuperadminStatus> => {
  const response = await fetchJson("/superadmin/status");
  if (response.status === 401) return { kind: "sign-in" };
  if (response.status === 403) return { kind: "forbidden" };
  if (response.status !== 200) return { kind: "unavailable" };
  const parsed = statusSchema.safeParse(response.body);
  if (!parsed.success) return { kind: "unavailable" };
  return { kind: "ready", mfaVerified: parsed.data.mfaVerified };
};

export const listPrompts = async (): Promise<
  CommandResult<readonly SuperadminPrompt[]>
> => {
  const response = await fetchJson("/superadmin/prompts");
  return result(
    response.status,
    (body) => {
      const parsed = promptsSchema.safeParse(body);
      return parsed.success ? parsed.data.prompts : undefined;
    },
    response.body,
  );
};

export const createPrompt = async (
  input: PromptInput,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    "/superadmin/prompts",
    "POST",
    input.reason === undefined
      ? { category: input.category, text: input.text }
      : { category: input.category, reason: input.reason, text: input.text },
  );
  return result(response.status, () => null, response.body);
};

export const updatePrompt = async (
  promptId: string,
  input: PromptInput,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/superadmin/prompts/${promptId}`,
    "PUT",
    input.reason === undefined
      ? { category: input.category, text: input.text }
      : { category: input.category, reason: input.reason, text: input.text },
  );
  return result(response.status, () => null, response.body);
};

export const retirePrompt = async (
  promptId: string,
): Promise<CommandResult<null>> => {
  const response = await mutateIdentity(
    `/superadmin/prompts/${promptId}`,
    "DELETE",
  );
  return result(response.status, () => null, response.body);
};

export const verifyPasskey = async (): Promise<CommandResult<null>> => {
  const options = await mutateIdentity(
    "/superadmin/webauthn/authentication/options",
    "POST",
  );
  const parsed =
    options.status === 200 ? optionsSchema.safeParse(options.body) : undefined;
  if (parsed === undefined || !parsed.success)
    return {
      message:
        options.status === 200
          ? unavailableMessage
          : messageForStatus(options.status),
      ok: false,
    };
  let assertion: Awaited<ReturnType<typeof startAuthentication>>;
  try {
    assertion = await startAuthentication({
      optionsJSON: authenticationOptions(parsed.data.options),
    });
  } catch {
    return {
      message:
        "The passkey prompt was cancelled, or this browser could not complete it.",
      ok: false,
    };
  }
  const verification = await mutateIdentity(
    "/superadmin/webauthn/authentication/verify",
    "POST",
    assertion,
  );
  return verification.status === 200
    ? { data: null, ok: true }
    : { message: messageForStatus(verification.status), ok: false };
};
