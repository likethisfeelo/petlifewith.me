import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

// 서버(Lambda)는 UTC, 방문자 브라우저는 대개 KST 다. 시간대를 고정하지 않으면 같은 값이
// 서버와 클라이언트에서 다른 문자열이 되어 하이드레이션이 깨진다(React #418).
// 아래 테스트는 이 프로세스의 TZ 와 무관하게 항상 한국 시간으로 찍히는지 본다.
describe("표시용 날짜 포맷", () => {
  it("UTC 저녁은 한국 기준 다음 날로 찍힌다", () => {
    const utcEvening = new Date("2026-09-08T20:00:00Z"); // KST 2026-09-09 05:00
    expect(formatDate(utcEvening)).toBe("2026년 9월 9일");
    expect(formatDateTime(utcEvening)).toContain("2026년 9월 9일");
  });

  it("UTC 자정 직후는 한국 기준 같은 날 오전이다", () => {
    const utcMorning = new Date("2026-09-09T00:30:00Z"); // KST 2026-09-09 09:30
    expect(formatDate(utcMorning)).toBe("2026년 9월 9일");
    expect(formatDateTime(utcMorning)).toContain("09:30");
  });

  it("문자열 입력도 같은 결과를 준다", () => {
    expect(formatDate("2026-09-08T20:00:00Z")).toBe(formatDate(new Date("2026-09-08T20:00:00Z")));
  });

  it("빈 값은 빈 문자열", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDateTime(null)).toBe("");
  });
});
