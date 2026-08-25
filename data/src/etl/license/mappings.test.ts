import { describe, expect, it } from "vitest";
import { mapBizStatus, parseDate } from "./mappings.js";

describe("mapBizStatus", () => {
  it("영업/정상 → operating", () => {
    expect(mapBizStatus("영업/정상").status).toBe("operating");
    expect(mapBizStatus(undefined, "정상").status).toBe("operating");
  });
  it("폐업·취소·말소 → closed (영업 문자열보다 우선)", () => {
    expect(mapBizStatus("폐업").status).toBe("closed");
    expect(mapBizStatus("직권취소").status).toBe("closed");
    expect(mapBizStatus("영업소폐쇄").status).toBe("closed");
  });
  it("휴업 → suspended", () => {
    expect(mapBizStatus("휴업").status).toBe("suspended");
  });
  it("모르는 값은 unknown 으로 두고 원문을 보존한다", () => {
    const r = mapBizStatus("이상한상태");
    expect(r.status).toBe("unknown");
    expect(r.matchedOn).toBe("이상한상태");
  });
});

describe("parseDate", () => {
  it("yyyymmdd / yyyy-mm-dd 를 해석한다", () => {
    expect(parseDate("20230115")).toBe("2023-01-15");
    expect(parseDate("2023-01-15")).toBe("2023-01-15");
    expect(parseDate("2023-01-15 00:00:00")).toBe("2023-01-15");
  });
  it("해석 불가는 null", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("15/01/2023")).toBeNull();
  });
});
