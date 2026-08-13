const error = (description: string) => ({
  description,
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: { error: { type: "string" } },
});

const unauthorized = error("Authentication is required.");
const forbidden = error(
  "Same-origin CSRF validation failed or access is denied.",
);
const unsafeSessionSecurity = [
  { csrfCookie: [], csrfToken: [], sessionCookie: [] },
];

export const coupleOpenApiSchemas = {
  acceptInvite: {
    operationId: "acceptCoupleInvite",
    summary: "Accept a private couple invite",
    tags: ["Couples"],
    security: unsafeSessionSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["token"],
      properties: { token: { type: "string", minLength: 32, writeOnly: true } },
    },
    response: {
      204: { description: "Invite accepted." },
      400: error("Invite is invalid or expired."),
      401: unauthorized,
      403: forbidden,
    },
  },
  createSpace: {
    operationId: "createCoupleSpace",
    summary: "Create a couple space and private invite",
    tags: ["Couples"],
    security: unsafeSessionSecurity,
    response: {
      201: {
        description: "A new space and fragment-only invite link.",
        type: "object",
        additionalProperties: false,
        required: ["inviteUrl"],
        properties: {
          inviteUrl: { type: "string", format: "uri" },
        },
      },
      401: unauthorized,
      403: forbidden,
    },
  },
  endSpace: {
    operationId: "endCoupleSpace",
    summary: "End the current couple space",
    tags: ["Couples"],
    security: unsafeSessionSecurity,
    response: {
      204: { description: "Space ended." },
      401: unauthorized,
      403: forbidden,
    },
  },
} as const;
