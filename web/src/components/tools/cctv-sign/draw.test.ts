import { describe, expect, it } from "vitest";
import { EMPTY_FIELDS, isValidPhone, signRows, signText } from "./draw";

describe("CCTV 안내판", () => {
  it("전화번호 형식", () => {
    for (const ok of ["02-123-4567", "031-1234-5678", "010-1234-5678", "01012345678", "1588-1234"]) expect(isValidPhone(ok)).toBe(true);
    for (const bad of ["000-0000", "123", "02-12-34", "전화"]) expect(isValidPhone(bad)).toBe(false);
  });

  it("수탁자는 적었을 때만 행이 생긴다", () => {
    expect(signRows(EMPTY_FIELDS).map(([k]) => k)).not.toContain("trustee");
    expect(signRows({ ...EMPTY_FIELDS, trustee: "○○보안" }).map(([k]) => k)).toContain("trustee");
  });

  it("문구에 녹음하지 않음이 늘 들어간다", () => {
    expect(signText(EMPTY_FIELDS)).toContain("녹음 기능을 사용하지 않습니다");
  });
});
