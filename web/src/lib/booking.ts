// ============================================================
// 예약 신청 — 입력 검증과 슬랙 메시지 본문 (순수 함수, 테스트 대상)
//
// 프로세스는 최소: 폼 → DB 저장 → 슬랙 알림 → 운영자가 파트너에게 연결.
// 신청자 이름·연락처는 개인정보라 관리자 화면과 슬랙에만 간다 (claude.md 5-6).
// ============================================================

export const BOOKING_LIMITS = {
  name: 40,
  contact: 60,
  petNote: 300,
  preferredDate: 80,
  message: 500,
  /** 같은 IP(해시)에서 한 시간에 받는 신청 수 */
  perHour: 5,
} as const;

export interface BookingValues {
  requesterName: string;
  contact: string;
  petNote: string | null;
  preferredDate: string | null;
  message: string | null;
}

export type BookingValidation = { ok: true; value: BookingValues } | { ok: false; error: string };

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

function optional(raw: Record<string, unknown>, key: string, max: number): string | null | { error: string } {
  const v = field(raw, key);
  if (!v) return null;
  if (v.length > max) return { error: `${max}자 이내로 적어 주세요.` };
  return v;
}

/** 전화번호 또는 카카오톡 ID·이메일 — 숫자·영문·한글·@._+-() 공백만 */
const CONTACT_RE = /^[0-9A-Za-z가-힣@._+\-() ]+$/;

export function validateBookingInput(raw: Record<string, unknown>): BookingValidation {
  // 봇 함정 — 사람 눈에 안 보이는 칸이 채워지면 조용히 거절한다
  if (field(raw, "website")) return { ok: false, error: "요청을 처리할 수 없습니다." };

  const requesterName = field(raw, "requesterName");
  if (requesterName.length < 1 || requesterName.length > BOOKING_LIMITS.name) {
    return { ok: false, error: `이름을 ${BOOKING_LIMITS.name}자 이내로 적어 주세요.` };
  }
  const contact = field(raw, "contact");
  if (contact.length < 5 || contact.length > BOOKING_LIMITS.contact || !CONTACT_RE.test(contact)) {
    return { ok: false, error: "연락처(전화번호 또는 카카오톡 ID)를 확인해 주세요." };
  }
  if (raw.consent !== "on" && raw.consent !== true) {
    return { ok: false, error: "연락처 전달에 동의해 주셔야 신청할 수 있습니다." };
  }
  const petNote = optional(raw, "petNote", BOOKING_LIMITS.petNote);
  if (petNote && typeof petNote === "object") return { ok: false, error: `반려견 정보는 ${petNote.error}` };
  const preferredDate = optional(raw, "preferredDate", BOOKING_LIMITS.preferredDate);
  if (preferredDate && typeof preferredDate === "object") return { ok: false, error: `희망 일정은 ${preferredDate.error}` };
  const message = optional(raw, "message", BOOKING_LIMITS.message);
  if (message && typeof message === "object") return { ok: false, error: `요청 내용은 ${message.error}` };

  return { ok: true, value: { requesterName, contact, petNote, preferredDate, message } };
}

export interface SlackBookingInput extends BookingValues {
  id: number;
  personLabel: string; // 펫시터 / 도그워커
  spotName: string;
  areaLabel: string | null;
  adminUrl: string;
}

/** 슬랙 본문 — mrkdwn. 한 줄씩 읽히게, 비어 있는 항목은 빼고 만든다. */
export function slackBookingText(b: SlackBookingInput): string {
  const lines = [
    `*[예약 신청 #${b.id}] ${b.personLabel} · ${b.spotName}${b.areaLabel ? ` (${b.areaLabel})` : ""}*`,
    `신청자: ${b.requesterName} · 연락처: ${b.contact}`,
  ];
  if (b.petNote) lines.push(`반려견: ${b.petNote}`);
  if (b.preferredDate) lines.push(`희망 일정: ${b.preferredDate}`);
  if (b.message) lines.push(`요청: ${b.message}`);
  lines.push(`관리자: ${b.adminUrl}`);
  return lines.join("\n");
}
