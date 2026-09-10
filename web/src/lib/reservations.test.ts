import { describe, expect, it } from "vitest";
import { chatOpen, hmToMin, isExpertKind, kstWeekday, minToHm, parseWeeklySlots, selfPublishes, slotLabel, slotWindows, validateMessageBody, validateReservationInput } from "./reservations";

describe("validateReservationInput", () => {
  const base = { requesterName: "몽이 보호자", contact: "010-1111-2222", consent: "on" };
  it("이름·연락처·동의·길이", () => {
    expect(validateReservationInput(base)).toMatchObject({ ok: true, value: { petNote: null, message: null } });
    expect(validateReservationInput({ ...base, consent: undefined }).ok).toBe(false);
    expect(validateReservationInput({ ...base, contact: "x" }).ok).toBe(false);
    expect(validateReservationInput({ ...base, website: "spam" }).ok).toBe(false);
    expect(validateReservationInput({ ...base, petNote: "a".repeat(201) }).ok).toBe(false);
    expect(validateReservationInput({ ...base, topic: " 관절 ", message: "부탁드려요" })).toMatchObject({ ok: true, value: { topic: "관절", message: "부탁드려요" } });
  });
  it("메시지", () => {
    expect(validateMessageBody("  ").ok).toBe(false);
    expect(validateMessageBody("안녕하세요")).toMatchObject({ ok: true, value: "안녕하세요" });
    expect(chatOpen("paid")).toBe(true);
    expect(chatOpen("confirmed")).toBe(false);
    expect(isExpertKind("vet")).toBe(false);
    expect(isExpertKind("mentor")).toBe(true);
    expect(selfPublishes("mentor")).toBe(true);
    expect(selfPublishes("trainer")).toBe(false);
  });
});

describe("slots", () => {
  it("시간 변환·슬롯 파싱", () => {
    expect(hmToMin("20:00")).toBe(1200);
    expect(hmToMin("9:30")).toBe(570);
    expect(hmToMin("25:00")).toBeNull();
    expect(minToHm(1200)).toBe("20:00");
    const ok = parseWeeklySlots([{ weekday: "2", start: "20:00", end: "21:00" }, { weekday: "6", start: "10:00", end: "11:00" }]);
    expect(ok).toMatchObject({ ok: true, value: [{ weekday: 2, startMin: 1200, endMin: 1260 }, { weekday: 6, startMin: 600, endMin: 660 }] });
    expect(parseWeeklySlots([{ weekday: "2", start: "20:00", end: "19:00" }]).ok).toBe(false);
    expect(parseWeeklySlots([{ weekday: "2", start: "20:00", end: "21:00" }, { weekday: "2", start: "20:30", end: "22:00" }]).ok).toBe(false);
  });
  it("주간 슬롯 → 2주 창, 지난 것·예약된 것 제외 (서울 시간)", () => {
    // 2026-09-14 월 09:00 KST = 00:00Z
    const now = new Date("2026-09-14T00:00:00Z");
    expect(kstWeekday(now)).toBe(1);
    const windows = slotWindows([{ weekday: 2, startMin: 1200, endMin: 1260 }], [], now, 14);
    expect(windows.length).toBe(2); // 9/15(화), 9/22(화)
    expect(windows[0]!.start.toISOString()).toBe("2026-09-15T11:00:00.000Z"); // 20:00 KST
    expect(slotLabel(windows[0]!)).toBe("9/15(화) 20:00–21:00");
    const booked = slotWindows([{ weekday: 2, startMin: 1200, endMin: 1260 }], [windows[0]!.start], now, 14);
    expect(booked.length).toBe(1);
    // 오늘 슬롯이 1시간 안에 시작하면 제외: 월 09:30 KST 슬롯 (now 09:00)
    const soon = slotWindows([{ weekday: 1, startMin: 570, endMin: 600 }], [], now, 0);
    expect(soon.length).toBe(0);
  });
});
