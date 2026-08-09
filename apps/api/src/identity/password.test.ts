import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  hashPassword,
  passwordHashPolicy,
  verifyPassword,
} from "./password.js";

describe("password policy", () => {
  it("hashes and verifies a password with Argon2id", async () => {
    // Given: a password accepted by the identity boundary
    const password = randomBytes(32).toString("base64url");

    // When: the password is hashed and verified
    const passwordHash = await hashPassword(password);
    const verification = await verifyPassword({ password, passwordHash });

    // Then: the hash uses the selected policy and verification succeeds
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(verification).toBe(true);
    expect(passwordHashPolicy.algorithm).toBe("argon2id");
  });

  it("rejects a different password", async () => {
    // Given: a hash for one password
    const passwordHash = await hashPassword(
      randomBytes(32).toString("base64url"),
    );

    // When: a different password is verified
    const verification = await verifyPassword({
      password: randomBytes(32).toString("base64url"),
      passwordHash,
    });

    // Then: authentication cannot succeed
    expect(verification).toBe(false);
  });
});
