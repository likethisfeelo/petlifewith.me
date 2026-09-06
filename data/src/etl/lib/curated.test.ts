import { describe, expect, it } from "vitest";
import {
  bindCuratedHeaders,
  cellValue,
  parseBoolCell,
  parseDateCell,
  parseLinkCell,
  parseStatusCell,
  splitPipeList,
} from "./curated.js";

describe("큐레이션 CSV 규약 — '#' 은 미확인", () => {
  it("'#'·공백은 null, 나머지는 trim", () => {
    expect(cellValue("#")).toBeNull();
    expect(cellValue(" # ")).toBeNull();
    expect(cellValue("")).toBeNull();
    expect(cellValue(undefined)).toBeNull();
    expect(cellValue(" 코코목욕 ")).toBe("코코목욕");
  });
  it("영업상태는 영문·한글 모두 받고 모르는 값은 null", () => {
    expect(parseStatusCell("operating")).toBe("operating");
    expect(parseStatusCell("영업 중")).toBe("operating");
    expect(parseStatusCell("폐업")).toBe("closed");
    expect(parseStatusCell("휴업")).toBe("suspended");
    expect(parseStatusCell("확인 필요")).toBe("unknown");
    expect(parseStatusCell("이상한값")).toBeNull();
    expect(parseStatusCell(null)).toBeNull();
  });
  it("기준일은 YYYY-MM-DD 만", () => {
    expect(parseDateCell("2026-09-06")).toBe("2026-09-06");
    expect(parseDateCell("20260906")).toBeNull();
  });
  it("게시 여부", () => {
    expect(parseBoolCell("Y")).toBe(true);
    expect(parseBoolCell("아니오")).toBe(false);
    expect(parseBoolCell("maybe")).toBeNull();
  });
  it("파이프 목록", () => {
    expect(splitPipeList("acupuncture | rehab||")).toEqual(["acupuncture", "rehab"]);
    expect(splitPipeList(null)).toEqual([]);
  });
  it("링크 셀 — URL 또는 라벨|URL, http(s) 만", () => {
    expect(parseLinkCell("https://example.com/a")).toEqual({ url: "https://example.com/a", label: null });
    expect(parseLinkCell("당근 비즈프로필|https://www.daangn.com/x")).toEqual({
      url: "https://www.daangn.com/x",
      label: "당근 비즈프로필",
    });
    expect(parseLinkCell("javascript:alert(1)")).toBeNull();
    expect(parseLinkCell("instagram_handle")).toBeNull();
  });
  it("헤더 바인딩 — 필수 누락이면 발견된 헤더를 담아 실패", () => {
    const spec = {
      name: { candidates: ["이름", "상호"], required: true },
      phone: { candidates: ["전화"], required: false },
    };
    const b = bindCuratedHeaders({ 상호: "a", 전화: "#" }, spec);
    expect(b.get({ 상호: "가게", 전화: "#" }, "name")).toBe("가게");
    expect(b.get({ 상호: "가게", 전화: "#" }, "phone")).toBeNull();
    expect(b.has("phone")).toBe(true);
    expect(() => bindCuratedHeaders({ 전화: "x" }, spec)).toThrow(/누락/);
  });
});
