import { describe, expect, it } from "vitest";
import { capacityText, isFull, meetupSlug, parseMeetingAt, parseRegionIds, regionSummaryText, toMeetingInput, validateMeetupInput, validatePostBody } from "./meetups";

describe("validateMeetupInput", () => {
  it("제목·정원·일시를 검증한다", () => {
    expect(validateMeetupInput({ title: "a" }).ok).toBe(false);
    const ok = validateMeetupInput({ title: "마포 아침 산책", descriptionMd: " 매주 토요일 ", placeText: "월드컵공원", meetingAt: "2026-09-20T09:30", capacity: "8" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.capacity).toBe(8);
      expect(ok.value.descriptionMd).toBe("매주 토요일");
      expect(ok.value.meetingAt?.toISOString()).toBe("2026-09-20T00:30:00.000Z");
    }
    expect(validateMeetupInput({ title: "모임", capacity: "1" }).ok).toBe(false);
    expect(validateMeetupInput({ title: "모임", capacity: "abc" }).ok).toBe(false);
    expect(validateMeetupInput({ title: "모임", meetingAt: "언제" }).ok).toBe(false);
    const empty = validateMeetupInput({ title: "모임", capacity: "", meetingAt: "" });
    expect(empty).toMatchObject({ ok: true, value: { capacity: null, meetingAt: null, placeText: null } });
  });
});

describe("meeting time round trip", () => {
  it("서울 시간으로 읽고 쓴다", () => {
    const d = parseMeetingAt("2026-01-05T18:00");
    expect(d).toBeInstanceOf(Date);
    expect(toMeetingInput(d as Date)).toBe("2026-01-05T18:00");
    expect(parseMeetingAt("")).toBeNull();
    expect(parseMeetingAt("nope")).toBeUndefined();
    expect(toMeetingInput(null)).toBe("");
  });
});

describe("helpers", () => {
  it("게시판 글·지역 목록·슬러그·문구", () => {
    expect(validatePostBody(" a ").ok).toBe(false);
    expect(validatePostBody("내일 봐요")).toMatchObject({ ok: true, value: "내일 봐요" });
    expect(parseRegionIds("3, 1, 3, x, 0")).toMatchObject({ ok: true, value: [3, 1] });
    expect(parseRegionIds("1,2,3,4").ok).toBe(false);
    expect(parseRegionIds("")).toMatchObject({ ok: true, value: [] });
    expect(meetupSlug("마포 아침 산책!", "ab12cd")).toBe("마포-아침-산책-ab12cd");
    expect(regionSummaryText(0, 0)).toBe("아직 모임이 없어요");
    expect(regionSummaryText(3, 12)).toBe("모임 3개 · 12명 참여 중");
    expect(capacityText(4, 8)).toBe("4/8명");
    expect(capacityText(4, null)).toBe("4명");
    expect(isFull(8, 8)).toBe(true);
    expect(isFull(8, null)).toBe(false);
  });
});
