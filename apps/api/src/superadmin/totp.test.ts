import { describe, expect, it } from "vitest";

import { decodeBase32, hotp, totpCodeAt, verifyTotp } from "./totp.js";

const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP verification", () => {
  it("decodes RFC 4648 base32 to the raw secret bytes", () => {
    // Given: the base32 encoding of the RFC 6238 reference secret
    const decoded = decodeBase32(rfcSecret);

    // Then: the bytes match the ASCII reference key "12345678901234567890"
    expect(decoded.toString("ascii")).toBe("12345678901234567890");
  });

  it("reproduces every RFC 6238 SHA-1 reference vector", () => {
    // Given: the six RFC 6238 timestamps and their 8-digit codes
    const vectors = [
      { code: "94287082", timeMs: 59_000 },
      { code: "07081804", timeMs: 1_111_111_109_000 },
      { code: "14050471", timeMs: 1_111_111_111_000 },
      { code: "89005924", timeMs: 1_234_567_890_000 },
      { code: "69279037", timeMs: 2_000_000_000_000 },
      { code: "65353130", timeMs: 20_000_000_000_000 },
    ];

    // When: each timestamp is converted with the same secret
    // Then: every generated code matches the RFC vector
    for (const vector of vectors) {
      const code = hotp(rfcSecret, Math.floor(vector.timeMs / 30_000), 8);
      expect(code).toBe(vector.code);
    }
  });

  it("derives six-digit codes from the same truncation as eight-digit codes", () => {
    // Given: the first RFC timestamp whose 8-digit code is 94287082
    const nowMs = 59_000;

    // When: the code is generated for six digits
    // Then: it equals the final six digits of the truncated value
    expect(
      totpCodeAt({ digits: 6, nowMs, period: 30, secret: rfcSecret }),
    ).toBe("287082");
  });

  it("accepts the current code once and records its step", () => {
    // Given: a verification at a fixed time with no prior usage
    const nowMs = 1_111_111_109_000;
    const result = verifyTotp({
      code: "07081804",
      digits: 8,
      lastUsedStep: 0,
      nowMs,
      period: 30,
      secret: rfcSecret,
    });

    // Then: the code is valid at its own step
    expect(result).toEqual({ status: "valid", step: 37_037_036 });
  });

  it("allows one step of clock drift in both directions", () => {
    // Given: verifications one period before and after the reference time
    const drifted = verifyTotp({
      code: "07081804",
      digits: 8,
      lastUsedStep: 0,
      nowMs: 1_111_111_109_000 + 30_000,
      period: 30,
      secret: rfcSecret,
    });
    const behind = verifyTotp({
      code: "07081804",
      digits: 8,
      lastUsedStep: 0,
      nowMs: 1_111_111_109_000 - 30_000,
      period: 30,
      secret: rfcSecret,
    });

    // Then: both neighboring-step verifications resolve to the code's own step
    expect(drifted).toEqual({ status: "valid", step: 37_037_036 });
    expect(behind).toEqual({ status: "valid", step: 37_037_036 });
  });

  it("rejects reuse of a consumed step as replayed", () => {
    // Given: a verification whose step was already consumed
    const replayed = verifyTotp({
      code: "07081804",
      digits: 8,
      lastUsedStep: 37_037_037,
      nowMs: 1_111_111_109_000,
      period: 30,
      secret: rfcSecret,
    });

    // Then: the code is classified as replayed rather than invalid
    expect(replayed).toBe("replayed");
  });

  it("rejects wrong codes and malformed input", () => {
    // Given: a wrong code, a wrong-length code, and non-numeric input
    const results = [
      verifyTotp({
        code: "00000000",
        digits: 8,
        lastUsedStep: 0,
        nowMs: 1_111_111_109_000,
        period: 30,
        secret: rfcSecret,
      }),
      verifyTotp({
        code: "070818",
        digits: 8,
        lastUsedStep: 0,
        nowMs: 1_111_111_109_000,
        period: 30,
        secret: rfcSecret,
      }),
      verifyTotp({
        code: "0708  04",
        digits: 8,
        lastUsedStep: 0,
        nowMs: 1_111_111_109_000,
        period: 30,
        secret: rfcSecret,
      }),
    ];

    // Then: every malformed or wrong code is invalid
    for (const result of results) expect(result).toBe("invalid");
  });
});
