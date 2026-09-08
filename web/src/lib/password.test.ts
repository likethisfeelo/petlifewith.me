import { describe, expect, it } from "vitest";
import { hashPassword, passwordPolicyError, verifyPassword } from "./password";

describe("비밀번호 해시 (scrypt)", () => {
  it("같은 비밀번호도 솔트가 달라 해시가 다르고, 검증은 통과한다", () => {
    const a = hashPassword("correct horse battery");
    const b = hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(verifyPassword("correct horse battery", a)).toBe(true);
    expect(verifyPassword("correct horse battery", b)).toBe(true);
  });
  it("틀린 비밀번호·손상된 저장값·빈 값은 false", () => {
    const h = hashPassword("secret-password");
    expect(verifyPassword("secret-passwore", h)).toBe(false);
    expect(verifyPassword("secret-password", h.slice(0, -4))).toBe(false);
    expect(verifyPassword("secret-password", "plain$text")).toBe(false);
    expect(verifyPassword("secret-password", null)).toBe(false);
  });
  it("정책은 길이만 본다", () => {
    expect(passwordPolicyError("short")).toMatch(/8자/);
    expect(passwordPolicyError("long enough")).toBeNull();
    expect(passwordPolicyError("x".repeat(129))).toMatch(/128자/);
  });
});
