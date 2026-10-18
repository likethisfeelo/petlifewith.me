import { describe, expect, it } from "vitest";
import { nameKey, namesLookSame, ownerStateOf, phoneDigits, searchTerm } from "./spot-register";

describe("spot register", () => {
  it("전화번호", () => {
    expect(phoneDigits("02-123-4567")).toBe("021234567");
    expect(phoneDigits("010 1234 5678")).toBe("01012345678");
    expect(phoneDigits("1234")).toBeNull();
  });
  it("이름 비교", () => {
    expect(nameKey("멍멍 스파 (강남점)")).toBe("멍멍스파");
    expect(namesLookSame("멍멍스파", "멍멍 스파 강남점")).toBe(true);
    expect(namesLookSame("해피펫", "해피펫")).toBe(true);
    expect(namesLookSame("해피펫", "럭키펫")).toBe(false);
    expect(namesLookSame("펫", "펫")).toBe(false);
  });
  it("소유 상태", () => {
    expect(ownerStateOf(null, "u1")).toBe("none");
    expect(ownerStateOf("u1", "u1")).toBe("mine");
    expect(ownerStateOf("u2", "u1")).toBe("other");
    expect(ownerStateOf("u2", null)).toBe("other");
  });
  it("검색어", () => {
    expect(searchTerm(" 멍 ")).toBeNull();
    expect(searchTerm("멍멍")).toEqual({ text: "멍멍", phone: null });
    expect(searchTerm("02-123-4567")?.phone).toBe("021234567");
  });
});
