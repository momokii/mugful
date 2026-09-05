import { expect, type Page } from "@playwright/test";

export const baseUrl =
  process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3100";
export const mailpitUrl = process.env["MUGFUL_TEST_MAILPIT_URL"];

export const required = (value: string | undefined, name: string): string => {
  if (value === undefined) {
    throw new Error(`${name} is required for the auth lifecycle`);
  }
  return value;
};

const postIdentityCommand = async (
  page: Page,
  input: Readonly<{ path: string; body: unknown }>,
): Promise<number> => {
  const csrfResponse = await page.request.get("/api/v1/csrf");
  const csrfBody: unknown = await csrfResponse.json();
  if (
    typeof csrfBody !== "object" ||
    csrfBody === null ||
    !("csrfToken" in csrfBody) ||
    typeof csrfBody.csrfToken !== "string"
  ) {
    throw new Error("CSRF response is invalid");
  }
  const response = await page.request.post(`/api/v1${input.path}`, {
    data: input.body,
    headers: { origin: baseUrl, "x-csrf-token": csrfBody.csrfToken },
  });
  return response.status();
};

export const registerAccountViaApi = async (
  page: Page,
  input: Readonly<{ displayName: string; email: string; password: string }>,
): Promise<void> => {
  const status = await postIdentityCommand(page, {
    body: {
      adultAttestation: true,
      displayName: input.displayName,
      email: input.email,
      password: input.password,
      privacyAccepted: true,
      termsAccepted: true,
    },
    path: "/auth/register",
  });
  if (status !== 202) {
    throw new Error(`API registration failed with status ${status}`);
  }
};

export const verifyEmailViaApi = async (
  page: Page,
  token: string,
): Promise<void> => {
  const status = await postIdentityCommand(page, {
    body: { token },
    path: "/auth/verification/confirm",
  });
  if (status !== 204) {
    throw new Error(`API email verification failed with status ${status}`);
  }
};

export const loginViaApi = async (
  page: Page,
  input: Readonly<{ email: string; password: string }>,
): Promise<void> => {
  const status = await postIdentityCommand(page, {
    body: { email: input.email, password: input.password },
    path: "/auth/login",
  });
  if (status !== 200) {
    throw new Error(`API login failed with status ${status}`);
  }
};

const tokenFromMessage = (message: string): string => {
  const match = message.match(/#token=([^\s"<]+)/);
  if (match?.[1] === undefined) {
    throw new Error("Mailpit message did not include a fragment token");
  }
  return match[1];
};

export const waitForMailpitMessages = async (
  mailpit: string,
  minimum: number,
): Promise<void> => {
  await expect
    .poll(async () => {
      const response = await fetch(`${mailpit}/api/v1/messages`);
      const body: unknown = await response.json();
      return typeof body === "object" &&
        body !== null &&
        "messages" in body &&
        Array.isArray(body.messages)
        ? body.messages.length
        : 0;
    })
    .toBeGreaterThan(minimum - 1);
};

export const mailpitToken = async (
  mailpit: string,
  path: string,
): Promise<string | undefined> => {
  const response = await fetch(`${mailpit}/api/v1/messages`);
  const list: unknown = await response.json();
  if (
    typeof list !== "object" ||
    list === null ||
    !("messages" in list) ||
    !Array.isArray(list.messages)
  ) {
    throw new Error("Mailpit messages response is invalid");
  }
  for (const item of list.messages) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("ID" in item) ||
      typeof item.ID !== "string"
    ) {
      continue;
    }
    const messageResponse = await fetch(`${mailpit}/api/v1/message/${item.ID}`);
    const message: unknown = await messageResponse.json();
    const text =
      typeof message === "object" &&
      message !== null &&
      "Text" in message &&
      typeof message.Text === "string"
        ? message.Text
        : "";
    if (text.includes(path)) return tokenFromMessage(text);
  }
  return undefined;
};

export const waitForMailpitToken = async (
  mailpit: string,
  path: string,
): Promise<string> => {
  await expect.poll(() => mailpitToken(mailpit, path)).not.toBeUndefined();
  const token = await mailpitToken(mailpit, path);
  if (token === undefined) {
    throw new Error(`Mailpit did not include a ${path} message`);
  }
  return token;
};

const messageAddressesInclude = (value: unknown, email: string): boolean =>
  Array.isArray(value) &&
  value.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      "Address" in entry &&
      typeof entry.Address === "string" &&
      entry.Address.toLowerCase() === email.toLowerCase(),
  );

const mailpitTokenForRecipient = async (
  mailpit: string,
  path: string,
  email: string,
): Promise<string | undefined> => {
  const response = await fetch(`${mailpit}/api/v1/messages`);
  const list: unknown = await response.json();
  if (
    typeof list !== "object" ||
    list === null ||
    !("messages" in list) ||
    !Array.isArray(list.messages)
  ) {
    throw new Error("Mailpit messages response is invalid");
  }
  for (const item of list.messages) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("ID" in item) ||
      typeof item.ID !== "string" ||
      !("To" in item) ||
      !messageAddressesInclude(item.To, email)
    ) {
      continue;
    }
    const messageResponse = await fetch(`${mailpit}/api/v1/message/${item.ID}`);
    const message: unknown = await messageResponse.json();
    const text =
      typeof message === "object" &&
      message !== null &&
      "Text" in message &&
      typeof message.Text === "string"
        ? message.Text
        : "";
    if (text.includes(path)) return tokenFromMessage(text);
  }
  return undefined;
};

export const waitForMailpitTokenForRecipient = async (
  mailpit: string,
  path: string,
  email: string,
): Promise<string> => {
  await expect
    .poll(() => mailpitTokenForRecipient(mailpit, path, email), { timeout: 15000 })
    .not.toBeUndefined();
  const token = await mailpitTokenForRecipient(mailpit, path, email);
  if (token === undefined) {
    throw new Error(`Mailpit did not include a ${path} message for ${email}`);
  }
  return token;
};
