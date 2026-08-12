import { expect } from "@playwright/test";

export const baseUrl =
  process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3100";
export const mailpitUrl = process.env["MUGFUL_TEST_MAILPIT_URL"];

export const required = (value: string | undefined, name: string): string => {
  if (value === undefined) {
    throw new Error(`${name} is required for the auth lifecycle`);
  }
  return value;
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
