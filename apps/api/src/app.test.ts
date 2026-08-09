import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

describe("health routes", () => {
  it("returns liveness without calling the database", async () => {
    // Given: an API with a database checker that records calls
    let databaseChecks = 0;
    const app = createApp({
      databaseChecker: {
        check: async () => {
          databaseChecks += 1;
        },
      },
    });

    // When: liveness is requested
    const response = await app.inject({ method: "GET", url: "/health/live" });

    // Then: the service is live and the database remains untouched
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "live" });
    expect(databaseChecks).toBe(0);
    await app.close();
  });

  it("returns readiness when the database check succeeds", async () => {
    // Given: an API whose database checker succeeds
    const app = createApp({
      databaseChecker: { check: async () => undefined },
    });

    // When: readiness is requested
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    // Then: the service reports that its dependency is ready
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
    await app.close();
  });

  it("returns a generic unavailable response when the database check fails", async () => {
    // Given: an API whose database checker rejects with connection detail
    const app = createApp({
      databaseChecker: {
        check: async () =>
          Promise.reject(new Error("postgresql://secret@localhost/mugful")),
      },
    });

    // When: readiness is requested
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    // Then: callers receive no connection detail
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "unavailable" });
    expect(response.body).not.toContain("postgresql://");
    await app.close();
  });
});
