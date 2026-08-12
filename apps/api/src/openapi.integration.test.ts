import { describe, expect, it } from "vitest";

import { createIdentityHttpTestContext } from "./identity/http-test-support.js";

describe("OpenAPI identity contract", () => {
  it("documents every identity route without exposing a Swagger UI", async () => {
    // Given: an API with every identity HTTP contract registered
    const context = createIdentityHttpTestContext(true);

    // When: its generated specification and common Swagger UI paths are requested
    const specification = await context.app.inject({
      method: "GET",
      url: "/openapi.json",
    });
    const swaggerUi = await context.app.inject({
      method: "GET",
      url: "/documentation",
    });

    // Then: the JSON contract is available while interactive documentation is absent
    expect(specification.statusCode).toBe(200);
    expect(swaggerUi.statusCode).toBe(404);
    const document = specification.json<
      Readonly<{
        paths: Record<
          string,
          Record<string, Readonly<{ responses: Record<string, unknown> }>>
        >;
      }>
    >();
    const expectedResponses = {
      "/v1/csrf": { get: ["200"] },
      "/v1/auth/register": { post: ["202", "400", "403", "429"] },
      "/v1/auth/login": { post: ["200", "400", "401", "403", "429"] },
      "/v1/auth/logout": { post: ["204", "403"] },
      "/v1/auth/session": { get: ["200", "401"] },
      "/v1/auth/password": { post: ["200", "400", "401", "403"] },
      "/v1/auth/sessions": { get: ["200", "401"] },
      "/v1/auth/sessions/{sessionId}": { delete: ["204", "401", "403"] },
      "/v1/auth/verification/resend": { post: ["202", "400", "403", "429"] },
      "/v1/auth/verification/confirm": { post: ["204", "400", "403"] },
      "/v1/auth/password/forgot": { post: ["202", "400", "403", "429"] },
      "/v1/auth/password/reset": { post: ["204", "400", "403"] },
    } as const;
    for (const [path, methods] of Object.entries(expectedResponses)) {
      const documentedPath = document.paths[path];
      expect(documentedPath).toBeDefined();
      for (const [method, statuses] of Object.entries(methods))
        expect(documentedPath?.[method]?.responses).toEqual(
          expect.objectContaining(
            Object.fromEntries(
              statuses.map((status: string) => [status, expect.anything()]),
            ),
          ),
        );
    }
    expect(JSON.stringify(document)).not.toContain('"example"');

    await context.app.close();
    await context.pool.end();
  });
});
