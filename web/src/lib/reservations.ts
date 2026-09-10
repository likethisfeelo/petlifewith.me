// ============================================================
// 예약·상담 — 종류·상태·검증·슬롯 계산 (순수, 테스트 대상). DB 는 lib/queries/reservations.ts, 액션은 app/reservation-actions.ts.
//
// 흐름은 하나: 회원이 요청(new) → 제공자(업체 소유자·전문가) 또는 관리자가 확인(confirmed) → 결제 확인(paid, 수동 — PG 는 뒤에)
// → 채팅 → 완료(done). 언제든 취소(cancelled). 신청자 이름·연락처는 관리자·슬랙에만 간다.
// 수의사·수의 테크니션 상담은 "생활 상담"으로 한정한다 — 진단·처방이 아니다 (claude.md 6-2).
// ============================================================

export const RESERVATION_KINDS = ["care", "spot", "consult"] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];
export const RESERVATION_KIND_LABEL: Record<ReservationKind, string> = { care: "돌봄 예약", spot: "업체 예약", consult: "온라인 상담" };

export const RESERVATION_STATUSES = ["new", "confirmed", "paid", "done", "cancelled"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  new: "요청됨",
  confirmed: "확인됨 · 결제 안내",
  paid: "결제 확인 · 채팅 열림",
  done: "완료",
  cancelled: "취소",
};

/** 채팅이 열리는 상태 — 결제 확인 뒤 */
export function chatOpen(status: ReservationStatus): boolean {
  return status === "paid" || status === "done";
}

export const EXPERT_KINDS = ["trainer", "mentor"] as const;
export type ExpertKind = (typeof EXPERT_KINDS)[number];
export const EXPERT_KIND_LABEL: Record<ExpertKind, string> = { trainer: "훈련사", mentor: "멘토 (선배 보호자)" };
export const EXPERT_KIND_BLURB: Record<ExpertKind, string> = {
  trainer: "행동·훈련·산책·분리불안 — 지역 방문 또는 온라인 상담",
  mentor: "먼저 노견을 돌본 보호자의 경험 나누기 — 회원 누구나 프로필을 만들 수 있어요",
};
export function isExpertKind(v: unknown): v is ExpertKind {
  return typeof v === "string" && (EXPERT_KINDS as readonly string[]).includes(v);
}
/** 훈련사는 자격 확인 뒤 운영자가 공개, 멘토는 저장 즉시 공개(운영자는 내릴 수 있다) */
export function selfPublishes(kind: ExpertKind): boolean {
  return kind === "mentor";
}
export const EXPERT_LIMITS = {
  /** 활동 지역 최대 수 (돌봄 파트너와 같은 단위) */
  regions: 5,
  topics: 10,
  slots: 21,
  intro: 3000,
  name: 40,
  short: 120,
} as const;

export const CONSULT_MODES = ["video", "phone", "chat"] as const;
export type ConsultMode = (typeof CONSULT_MODES)[number];
export const CONSULT_MODE_LABEL: Record<ConsultMode, string> = { video: "화상", phone: "전화", chat: "채팅" };

export const RESERVATION_LIMITS = {
  name: 40,
  contact: 60,
  petNote: 200,
  preferred: 120,
  topic: 120,
  message: 1000,
  /** 회원 한 사람이 하루에 보낼 수 있는 요청 수 */
  perDay: 5,
  /** 상담 슬롯을 고를 수 있는 기간(일) */
  slotDays: 14,
  /** 채팅 메시지 */
  messageMax: 2000,
  messagesPerHour: 60,
  /** 상담 프로필에서 바로 여는 대화 — 회원 한 사람이 하루에 새로 열 수 있는 수 */
  chatsPerDay: 10,
} as const;

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ReservationInput {
  requesterName: string;
  contact: string;
  petNote: string | null;
  preferredText: string | null;
  topic: string | null;
  message: string | null;
}

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}
const CONTACT_RE = /^[0-9A-Za-z가-힣@._+\-() ]+$/;

/** 예약·상담 공통 입력 */
export function validateReservationInput(raw: Record<string, unknown>): Validation<ReservationInput> {
  if (field(raw, "website")) return { ok: false, error: "요청을 처리할 수 없습니다." };
  const requesterName = field(raw, "requesterName");
  if (requesterName.length < 1 || requesterName.length > RESERVATION_LIMITS.name) return { ok: false, error: `이름을 ${RESERVATION_LIMITS.name}자 이내로 적어 주세요.` };
  const contact = field(raw, "contact");
  if (contact.length < 5 || contact.length > RESERVATION_LIMITS.contact || !CONTACT_RE.test(contact)) return { ok: false, error: "연락처(전화·카카오톡 ID)를 확인해 주세요." };
  if (raw.consent !== "on" && raw.consent !== true) return { ok: false, error: "연락처 전달에 동의해 주셔야 요청할 수 있습니다." };
  const opt = (key: string, max: number, label: string): string | null | { error: string } => {
    const v = field(raw, key);
    if (!v) return null;
    return v.length > max ? { error: `${label}은(는) ${max}자 이내로 적어 주세요.` } : v;
  };
  const petNote = opt("petNote", RESERVATION_LIMITS.petNote, "반려동물 정보");
  if (petNote && typeof petNote === "object") return { ok: false, error: petNote.error };
  const preferredText = opt("preferredText", RESERVATION_LIMITS.preferred, "희망 일정");
  if (preferredText && typeof preferredText === "object") return { ok: false, error: preferredText.error };
  const topic = opt("topic", RESERVATION_LIMITS.topic, "상담 주제");
  if (topic && typeof topic === "object") return { ok: false, error: topic.error };
  const message = opt("message", RESERVATION_LIMITS.message, "요청 내용");
  if (message && typeof message === "object") return { ok: false, error: message.error };
  return { ok: true, value: { requesterName, contact, petNote, preferredText, topic, message } };
}

export function validateMessageBody(raw: unknown): Validation<string> {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length < 1) return { ok: false, error: "내용을 적어 주세요." };
  if (body.length > RESERVATION_LIMITS.messageMax) return { ok: false, error: `메시지는 ${RESERVATION_LIMITS.messageMax}자 이하로 써 주세요.` };
  return { ok: true, value: body };
}

// ---------- 상담 슬롯 ----------

export interface WeeklySlot {
  weekday: number; // 0=일 … 6=토 (서울 기준)
  startMin: number;
  endMin: number;
}

export interface SlotWindow {
  start: Date;
  end: Date;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 서울 시간의 자정(UTC Date)으로 내린다 */
function kstMidnight(d: Date): Date {
  const shifted = new Date(d.getTime() + KST_OFFSET_MS);
  const utcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(utcMidnight - KST_OFFSET_MS);
}

export function kstWeekday(d: Date): number {
  return new Date(d.getTime() + KST_OFFSET_MS).getUTCDay();
}

/**
 * 주간 반복 슬롯 → 앞으로 days 일 안의 실제 시간 창. 이미 잡힌(booked) 시작 시각과 지난 시각은 뺀다.
 * 창은 슬롯 하나가 그대로 한 창이다 (예: 화 20:00–21:00 → 매주 화요일 그 시간).
 */
export function slotWindows(slots: WeeklySlot[], booked: Date[], now: Date, days: number = RESERVATION_LIMITS.slotDays): SlotWindow[] {
  const out: SlotWindow[] = [];
  const bookedSet = new Set(booked.map((b) => b.getTime()));
  const day0 = kstMidnight(now);
  for (let i = 0; i <= days; i++) {
    const dayStart = new Date(day0.getTime() + i * 24 * 60 * 60 * 1000);
    const weekday = kstWeekday(dayStart);
    for (const s of slots) {
      if (s.weekday !== weekday || s.endMin <= s.startMin) continue;
      const start = new Date(dayStart.getTime() + s.startMin * 60 * 1000);
      const end = new Date(dayStart.getTime() + s.endMin * 60 * 1000);
      if (start.getTime() <= now.getTime() + 60 * 60 * 1000) continue; // 최소 1시간 뒤부터
      if (bookedSet.has(start.getTime())) continue;
      out.push({ start, end });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** 슬롯 창의 표시 문구 — "9/16(화) 20:00–21:00" (서울 시간) */
export function slotLabel(w: SlotWindow): string {
  const s = new Date(w.start.getTime() + KST_OFFSET_MS);
  const e = new Date(w.end.getTime() + KST_OFFSET_MS);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const hm = (d: Date) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${s.getUTCMonth() + 1}/${s.getUTCDate()}(${days[s.getUTCDay()]}) ${hm(s)}–${hm(e)}`;
}

/** 분 → "20:00" */
export function minToHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "20:00" → 분. 형식이 틀리면 null */
export function hmToMin(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 24 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/** 관리자 슬롯 입력 행 → 주간 슬롯. 요일 0~6, 끝 > 시작, 하루 안 */
export function parseWeeklySlots(rows: Array<{ weekday: unknown; start: unknown; end: unknown }>): Validation<WeeklySlot[]> {
  const out: WeeklySlot[] = [];
  for (const r of rows) {
    const weekday = Number(r.weekday);
    const startMin = hmToMin(String(r.start ?? ""));
    const endMin = hmToMin(String(r.end ?? ""));
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "요일을 골라 주세요." };
    if (startMin === null || endMin === null) return { ok: false, error: "시간은 20:00 처럼 적어 주세요." };
    if (endMin <= startMin || endMin > 24 * 60) return { ok: false, error: "끝나는 시간이 시작보다 뒤여야 합니다." };
    if (out.some((o) => o.weekday === weekday && o.startMin < endMin && startMin < o.endMin)) return { ok: false, error: "겹치는 슬롯이 있습니다." };
    out.push({ weekday, startMin, endMin });
  }
  return { ok: true, value: out.sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin) };
}

export const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;
