import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cognitoErrorMessage, secretHash, totpUri } from "./cognito";

describe("secretHash", () => {
  it("base64(HMAC-SHA256(secret, username + clientId)) — Cognito 기밀 클라이언트 규격", () => {
    const expected = createHmac("sha256", "s3cret").update("a@b.co" + "client123").digest("base64");
    expect(secretHash("a@b.co", "client123", "s3cret")).toBe(expected);
  });
});

describe("totpUri", () => {
  it("인증 앱 QR 값 — 발급자·계정·비밀 키", () => {
    const uri = totpUri("ABCDEF", "me@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=ABCDEF");
    expect(uri).toContain(`issuer=${encodeURIComponent("펫라이프위드미")}`);
  });
});

describe("cognitoErrorMessage", () => {
  it("로그인 실패는 계정 존재 여부와 무관하게 같은 문구", () => {
    expect(cognitoErrorMessage({ name: "NotAuthorizedException" })).toBe(cognitoErrorMessage({ name: "UserNotFoundException" }));
  });
  it("비밀번호 정책 위반은 규칙을 알려 준다", () => {
    expect(cognitoErrorMessage({ name: "InvalidPasswordException" })).toMatch(/8자/);
  });
});
