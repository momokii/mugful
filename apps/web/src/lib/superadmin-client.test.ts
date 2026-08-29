import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPrompt,
  fetchSuperadminStatus,
  listPrompts,
  unavailableMessage,
} from "./superadmin-client";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });

const stubFetch = (route: (url: string) => Response | undefined): void => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const response = route(String(input));
      if (response === undefined)
        throw new Error(`Unexpected fetch target: ${String(input)}`);
      return response;
    }),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("superadmin client", () => {
  it("maps an anonymous status check to the sign-in state", async () => {
    // Given: the API reports no identity session
    stubFetch((url) =>
      url.endsWith("/api/v1/superadmin/status")
        ? jsonResponse(401, { error: "unauthorized" })
        : undefined,
    );

    // When: the console asks for its status
    const status = await fetchSuperadminStatus();

    // Then: it plans to show the sign-in prompt
    expect(status).toEqual({ kind: "sign-in" });
  });

  it("maps a non-superadmin status check to the forbidden state", async () => {
    // Given: the API rejects the role check
    stubFetch((url) =>
      url.endsWith("/api/v1/superadmin/status")
        ? jsonResponse(403, { error: "forbidden" })
        : undefined,
    );

    // When: the console asks for its status
    const status = await fetchSuperadminStatus();

    // Then: it plans to show the forbidden notice
    expect(status).toEqual({ kind: "forbidden" });
  });

  it("reports an unverified session from a valid status body", async () => {
    // Given: the API confirms the role without MFA trust
    stubFetch((url) =>
      url.endsWith("/api/v1/superadmin/status")
        ? jsonResponse(200, { mfaVerified: false, superadmin: true })
        : undefined,
    );

    // When: the console asks for its status
    const status = await fetchSuperadminStatus();

    // Then: it plans to show the passkey step
    expect(status).toEqual({ kind: "ready", mfaVerified: false });
  });

  it("rejects a malformed prompt list instead of rendering it", async () => {
    // Given: the API returns a prompt list without the expected fields
    stubFetch((url) =>
      url.endsWith("/api/v1/superadmin/prompts")
        ? jsonResponse(200, { prompts: [{ text: "half defined" }] })
        : undefined,
    );

    // When: the catalog loads
    const outcome = await listPrompts();

    // Then: it degrades to the generic unavailable message
    expect(outcome).toEqual({ message: unavailableMessage, ok: false });
  });

  it("maps a retired-prompt conflict to a human-readable message", async () => {
    // Given: CSRF issuance succeeds and the create call conflicts
    stubFetch((url) =>
      url.endsWith("/api/v1/csrf")
        ? jsonResponse(200, { csrfToken: "token" })
        : url.endsWith("/api/v1/superadmin/prompts")
          ? jsonResponse(409, { error: "prompt retired" })
          : undefined,
    );

    // When: a prompt is created
    const outcome = await createPrompt({
      category: "memories",
      reason: undefined,
      text: "What is our best shared memory?",
    });

    // Then: the message explains the conflict without echoing JSON
    expect(outcome).toEqual({
      message: "That prompt is retired and can no longer be changed.",
      ok: false,
    });
  });
});
