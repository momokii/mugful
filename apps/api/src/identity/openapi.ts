// allow: SIZE_OK - one declarative route-schema table keeps the public contract reviewable in one place.
const error = (description: string) => ({
  description,
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: { error: { type: "string" } },
});

const accepted = {
  description: "Request accepted without disclosing account state.",
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: { status: { type: "string", enum: ["accepted"] } },
};

const noContent = { description: "Request completed." };
const forbidden = error(
  "Same-origin signed CSRF validation failed or access is denied.",
);
const unauthorized = error(
  "Authentication is required or the session is no longer valid.",
);
const rateLimited = error(
  "Too many requests. Retry after the Retry-After interval.",
);

const email = { type: "string", format: "email", maxLength: 320 };
const password = {
  type: "string",
  minLength: 12,
  maxLength: 256,
  writeOnly: true,
};
const opaqueToken = { type: "string", minLength: 32, writeOnly: true };

const session = {
  type: "object",
  additionalProperties: false,
  required: ["email", "expiresAt"],
  properties: {
    email,
    expiresAt: { type: "string", format: "date-time" },
  },
};

const csrfSecurity = [{ csrfCookie: [], csrfToken: [] }];
const sessionSecurity = [{ sessionCookie: [] }];
const unsafeSessionSecurity = [
  { csrfCookie: [], csrfToken: [], sessionCookie: [] },
];

export const identityOpenApiSchemas = {
  csrf: {
    operationId: "issueCsrfToken",
    summary: "Issue a CSRF token",
    tags: ["Identity"],
    response: {
      200: {
        description: "A CSRF token and its bound browser cookie.",
        type: "object",
        additionalProperties: false,
        required: ["csrfToken"],
        properties: { csrfToken: { type: "string", writeOnly: true } },
      },
    },
  },
  register: {
    operationId: "registerIdentity",
    summary: "Register an identity",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: [
        "adultAttestation",
        "displayName",
        "email",
        "password",
        "privacyVersion",
        "termsVersion",
      ],
      properties: {
        adultAttestation: { type: "boolean", const: true },
        displayName: { type: "string", minLength: 1, maxLength: 80 },
        email,
        password,
        privacyVersion: { type: "string", minLength: 1, maxLength: 64 },
        termsVersion: { type: "string", minLength: 1, maxLength: 64 },
      },
    },
    response: {
      202: accepted,
      400: error("Registration input is invalid."),
      403: forbidden,
      429: rateLimited,
    },
  },
  login: {
    operationId: "loginIdentity",
    summary: "Start an authenticated session",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email", "password"],
      properties: { email, password },
    },
    response: {
      200: {
        description:
          "Authenticated session. The opaque session credential is set only in a cookie.",
        type: "object",
        additionalProperties: false,
        required: ["session"],
        properties: { session },
      },
      400: error("Credentials input is invalid."),
      401: error("Credentials are invalid."),
      403: forbidden,
      429: rateLimited,
    },
  },
  logout: {
    operationId: "logoutIdentity",
    summary: "End the current session",
    tags: ["Identity"],
    security: unsafeSessionSecurity,
    response: { 204: noContent, 403: forbidden },
  },
  currentSession: {
    operationId: "getCurrentIdentitySession",
    summary: "Read the current session",
    tags: ["Identity"],
    security: sessionSecurity,
    response: {
      200: {
        description: "Current authenticated session.",
        type: "object",
        additionalProperties: false,
        required: ["session"],
        properties: { session },
      },
      401: unauthorized,
    },
  },
  changePassword: {
    operationId: "changeIdentityPassword",
    summary: "Change password and rotate sessions",
    tags: ["Identity"],
    security: unsafeSessionSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["currentPassword", "newPassword"],
      properties: { currentPassword: password, newPassword: password },
    },
    response: {
      200: {
        description: "Replacement authenticated session.",
        type: "object",
        additionalProperties: false,
        required: ["session"],
        properties: { session },
      },
      400: error("Password input is invalid."),
      401: error("Current password is invalid or the session is invalid."),
      403: forbidden,
    },
  },
  sessions: {
    operationId: "listIdentitySessions",
    summary: "List active sessions",
    tags: ["Identity"],
    security: sessionSecurity,
    response: {
      200: {
        description: "Active sessions for the authenticated account.",
        type: "object",
        additionalProperties: false,
        required: ["sessions"],
        properties: {
          sessions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "createdAt",
                "current",
                "deviceLabel",
                "id",
                "lastSeenAt",
              ],
              properties: {
                createdAt: { type: "string", format: "date-time" },
                current: { type: "boolean" },
                deviceLabel: { type: ["string", "null"] },
                id: { type: "string", format: "uuid" },
                lastSeenAt: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
        },
      },
      401: unauthorized,
    },
  },
  revokeSession: {
    operationId: "revokeIdentitySession",
    summary: "Revoke an owned non-current session",
    tags: ["Identity"],
    security: unsafeSessionSecurity,
    params: {
      type: "object",
      additionalProperties: false,
      required: ["sessionId"],
      properties: { sessionId: { type: "string", format: "uuid" } },
    },
    response: { 204: noContent, 401: unauthorized, 403: forbidden },
  },
  resendVerification: {
    operationId: "resendIdentityVerification",
    summary: "Request a verification email",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email"],
      properties: { email },
    },
    response: {
      202: accepted,
      400: error("Email input is invalid."),
      403: forbidden,
      429: rateLimited,
    },
  },
  confirmVerification: {
    operationId: "confirmIdentityVerification",
    summary: "Confirm a verification token",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["token"],
      properties: { token: opaqueToken },
    },
    response: {
      204: noContent,
      400: error("Verification token is invalid or expired."),
      403: forbidden,
    },
  },
  forgotPassword: {
    operationId: "requestIdentityPasswordReset",
    summary: "Request a password reset email",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["email"],
      properties: { email },
    },
    response: {
      202: accepted,
      400: error("Email input is invalid."),
      403: forbidden,
      429: rateLimited,
    },
  },
  resetPassword: {
    operationId: "resetIdentityPassword",
    summary: "Reset a password with a token",
    tags: ["Identity"],
    security: csrfSecurity,
    body: {
      type: "object",
      additionalProperties: false,
      required: ["newPassword", "token"],
      properties: { newPassword: password, token: opaqueToken },
    },
    response: {
      204: noContent,
      400: error("Reset token is invalid or expired."),
      403: forbidden,
    },
  },
} as const;
