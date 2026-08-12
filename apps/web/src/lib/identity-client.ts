"use client";

export type ApiResult = Readonly<{
  status: number;
  error: string | undefined;
  body: unknown;
}>;

const api = "/api/v1";

const messageFor = (status: number): string => {
  if (status === 401)
    return "Check your email address and password, then try again.";
  if (status === 403) return "This action is not available right now.";
  if (status === 429) return "Please wait a minute before trying again.";
  return "We could not complete that request. Please try again.";
};

const request = async (path: string, init: RequestInit): Promise<ApiResult> => {
  const response = await fetch(`${api}${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...init.headers,
    },
  });
  const body: unknown =
    response.status === 204 ? undefined : await response.json();
  const error =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
      ? body.error
      : undefined;
  return { body, error, status: response.status };
};

const csrf = async (): Promise<string> => {
  const response = await fetch(`${api}/csrf`, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to prepare a secure request.");
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("csrfToken" in body) ||
    typeof body.csrfToken !== "string"
  )
    throw new Error("Unable to prepare a secure request.");
  return body.csrfToken;
};

export const mutateIdentity = async (
  path: string,
  method: "POST" | "DELETE",
  body?: unknown,
): Promise<ApiResult> => {
  const token = await csrf();
  return request(path, {
    headers: { "x-csrf-token": token },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
};

export const identityMessage = (result: ApiResult): string =>
  result.error === undefined
    ? messageFor(result.status)
    : messageFor(result.status);

export const readFragmentToken = (): string | undefined => {
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const token = parameters.get("token");
  window.history.replaceState(null, "", window.location.pathname);
  return token === null ? undefined : token;
};
