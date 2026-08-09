import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type CsrfProtection = Readonly<{
  cookieName: string;
  create: () => Readonly<{ cookieValue: string; token: string }>;
  verify: (input: Readonly<{ cookieValue: string; token: string }>) => boolean;
}>;

const sign = (input: Readonly<{ secret: string; value: string }>): string =>
  createHmac("sha256", input.secret).update(input.value).digest("base64url");

export const createCsrfProtection = (
  configuration: Readonly<{ cookieName: string; secret: string }>,
): CsrfProtection => ({
  cookieName: configuration.cookieName,
  create: () => {
    const cookieValue = randomBytes(32).toString("base64url");

    return {
      cookieValue,
      token: `${cookieValue}.${sign({ secret: configuration.secret, value: cookieValue })}`,
    };
  },
  verify: (input) => {
    const [cookieValue, signature, extra] = input.token.split(".");

    if (
      cookieValue === undefined ||
      signature === undefined ||
      extra !== undefined ||
      cookieValue !== input.cookieValue
    ) {
      return false;
    }

    const expected = sign({ secret: configuration.secret, value: cookieValue });
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    return (
      expectedBuffer.length === signatureBuffer.length &&
      timingSafeEqual(expectedBuffer, signatureBuffer)
    );
  },
});
