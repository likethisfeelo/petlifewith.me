import { describe, expect, it } from "vitest";
import { slackBookingText, validateBookingInput } from "./booking";

const good = { requesterName: "홍길동", contact: "010-1234-5678", consent: "on", petNote: "", preferredDate: "9/15 오후", message: "노견이라 천천히 부탁드려요", website: "" };

describe("예약 신청 검증", () => {
  it("정상 입력은 값으로 정리된다 (빈 선택 항목은 null)", () => {
    const r = validateBookingInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.petNote).toBeNull();
      expect(r.value.preferredDate).toBe("9/15 오후");
      expect(r.value.requesterName).toBe("홍길동");
    }
  });

  it("동의 없음·연락처 이상·봇 함정은 거절한다", () => {
    expect(validateBookingInput({ ...good, consent: "" }).ok).toBe(false);
    expect(validateBookingInput({ ...good, contact: "12" }).ok).toBe(false);
    expect(validateBookingInput({ ...good, contact: "<script>" }).ok).toBe(false);
    expect(validateBookingInput({ ...good, website: "http://spam" }).ok).toBe(false);
  });

  it("길이 제한을 넘기면 거절한다", () => {
    expect(validateBookingInput({ ...good, requesterName: "가".repeat(41) }).ok).toBe(false);
    expect(validateBookingInput({ ...good, message: "가".repeat(501) }).ok).toBe(false);
  });

  it("카카오톡 ID 형태의 연락처도 받는다", () => {
    expect(validateBookingInput({ ...good, contact: "kakao_id.99" }).ok).toBe(true);
  });
});

describe("슬랙 본문", () => {
  it("비어 있는 항목은 줄을 만들지 않는다", () => {
    const text = slackBookingText({
      id: 7,
      personLabel: "펫시터",
      spotName: "예시) 마포 조용한 돌봄",
      areaLabel: "서울특별시 마포구",
      adminUrl: "https://petlifewith.me/admin/bookings",
      requesterName: "홍길동",
      contact: "010-1234-5678",
      petNote: null,
      preferredDate: "9/15 오후",
      message: null,
    });
    expect(text).toContain("[예약 신청 #7] 펫시터 · 예시) 마포 조용한 돌봄 (서울특별시 마포구)");
    expect(text).toContain("희망 일정: 9/15 오후");
    expect(text).not.toContain("반려견:");
    expect(text).not.toContain("요청:");
    expect(text.split("\n")).toHaveLength(4);
  });
});
