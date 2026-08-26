import { afterEach, describe, expect, it } from "vitest";
import { adminAccounts } from "./config";

const original = process.env.ADMIN_TOKEN;
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = original;
});

function withToken(value: string | undefined) {
  if (value === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = value;
  return adminAccounts();
}

describe("adminAccounts", () => {
  it("단일 토큰은 라벨 admin 으로 (기존 .env 호환)", () => {
    expect(withToken("abc123")).toEqual([{ label: "admin", token: "abc123" }]);
  });
  it("미설정·빈 값은 빈 목록 — 로그인 자체가 불가능해야 한다", () => {
    expect(withToken(undefined)).toEqual([]);
    expect(withToken("   ")).toEqual([]);
  });
  it("라벨:토큰 을 쉼표·줄바꿈으로 여러 개", () => {
    expect(withToken("hee:tok1, partner:tok2")).toEqual([
      { label: "hee", token: "tok1" },
      { label: "partner", token: "tok2" },
    ]);
    expect(withToken("a:tok1\nb:tok2")).toEqual([
      { label: "a", token: "tok1" },
      { label: "b", token: "tok2" },
    ]);
  });
  it("첫 콜론 앞이 라벨 형식이면 라벨로 분리한다 (토큰에는 콜론을 쓰지 않는다)", () => {
    expect(withToken("hee:tok:with:colons")).toEqual([{ label: "hee", token: "tok:with:colons" }]);
  });
  it("콜론 앞이 라벨 형식이 아니면 전체가 토큰 — 문장형 비밀번호가 잘리지 않게", () => {
    expect(withToken("my pass:word")).toEqual([{ label: "admin", token: "my pass:word" }]);
    expect(withToken(":tok")).toEqual([{ label: "admin", token: ":tok" }]);
  });
  it("라벨 중복은 첫 번째만 채택 (실수로 같은 이름을 두 번 넣어도 결정적)", () => {
    expect(withToken("hee:tok1,hee:tok2")).toEqual([{ label: "hee", token: "tok1" }]);
  });
  it("토큰이 빈 항목은 버린다", () => {
    expect(withToken("hee:,partner:tok2")).toEqual([{ label: "partner", token: "tok2" }]);
  });
});
