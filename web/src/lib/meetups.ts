// ============================================================
// 펫모임 — 입력 검증·문구 (순수, 테스트 대상). DB 는 lib/queries/meetups.ts, 액션은 app/meetup-actions.ts.
//
// 규칙: 회원은 내 지역을 최대 3곳 고른다. 모임은 승인 없이 열리고 관리자는 숨길 수만 있다.
// 비회원에게는 "모임 n개 · m명 참여 중" 집계만 보이고, 모임 게시판은 참여 회원에게만 보인다.
// 장소는 짧은 문구만(공원·카페 이름) — 집 주소를 받지 않는다 (claude.md 5-6).
// ============================================================
import { slugify } from "@app/data";

export const MEETUP_LIMITS = {
  /** 내 지역 최대 수 */
  regions: 3,
  title: 60,
  description: 2000,
  place: 120,
  capacityMin: 2,
  capacityMax: 200,
  /** 모임 게시판 글 */
  post: 1000,
  postsPerHour: 20,
  /** 한 회원이 하루에 만들 수 있는 모임 수 */
  meetupsPerDay: 3,
} as const;

export type MeetupValidation<T> = { ok: true; value: T } | { ok: false; error: string };

export interface MeetupInput {
  title: string;
  descriptionMd: string | null;
  placeText: string | null;
  meetingAt: Date | null;
  capacity: number | null;
}

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

/** datetime-local 값("2026-09-20T14:00") 을 서울 시간으로 읽는다. 비어 있으면 null, 형식이 틀리면 undefined */
export function parseMeetingAt(raw: string): Date | null | undefined {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw);
  if (!m) return undefined;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Date → datetime-local 입력값 (서울 시간) */
export function toMeetingInput(d: Date | null | undefined): string {
  if (!d) return "";
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

export function validateMeetupInput(raw: Record<string, unknown>): MeetupValidation<MeetupInput> {
  const title = field(raw, "title");
  if (title.length < 2 || title.length > MEETUP_LIMITS.title) return { ok: false, error: `모임 이름을 2자 이상 ${MEETUP_LIMITS.title}자 이내로 적어 주세요.` };
  const descriptionMd = field(raw, "descriptionMd");
  if (descriptionMd.length > MEETUP_LIMITS.description) return { ok: false, error: `소개는 ${MEETUP_LIMITS.description}자 이내로 적어 주세요.` };
  const placeText = field(raw, "placeText");
  if (placeText.length > MEETUP_LIMITS.place) return { ok: false, error: `만나는 곳은 ${MEETUP_LIMITS.place}자 이내로 적어 주세요.` };
  const meetingAt = parseMeetingAt(field(raw, "meetingAt"));
  if (meetingAt === undefined) return { ok: false, error: "모임 일시 형식이 올바르지 않습니다." };
  const capacityRaw = field(raw, "capacity");
  let capacity: number | null = null;
  if (capacityRaw) {
    const n = Number(capacityRaw);
    if (!Number.isInteger(n) || n < MEETUP_LIMITS.capacityMin || n > MEETUP_LIMITS.capacityMax) {
      return { ok: false, error: `정원은 ${MEETUP_LIMITS.capacityMin}~${MEETUP_LIMITS.capacityMax}명 사이의 숫자로 적어 주세요 (비우면 제한 없음).` };
    }
    capacity = n;
  }
  return { ok: true, value: { title, descriptionMd: descriptionMd || null, placeText: placeText || null, meetingAt, capacity } };
}

export function validatePostBody(raw: unknown): MeetupValidation<string> {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (body.length < 2) return { ok: false, error: "글을 2자 이상 써 주세요." };
  if (body.length > MEETUP_LIMITS.post) return { ok: false, error: `글은 ${MEETUP_LIMITS.post}자 이하로 써 주세요.` };
  return { ok: true, value: body };
}

/** "1,2,3" → 중복·잘못된 값 제거, 최대 수 초과면 에러 */
export function parseRegionIds(raw: unknown, max = MEETUP_LIMITS.regions): MeetupValidation<number[]> {
  const ids = [...new Set(String(raw ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (ids.length > max) return { ok: false, error: `지역은 ${max}곳까지 고를 수 있어요.` };
  return { ok: true, value: ids };
}

/** 모임 슬러그 — 제목 슬러그 + 짧은 무작위 꼬리 (유일성은 꼬리가 담당) */
export function meetupSlug(title: string, suffix: string): string {
  return `${slugify(title, "meetup").slice(0, 40)}-${suffix}`;
}

/** 지역 집계 문구 — 비회원에게 보이는 유일한 정보 */
export function regionSummaryText(meetupCount: number, participantCount: number): string {
  if (meetupCount === 0) return "아직 모임이 없어요";
  return `모임 ${meetupCount.toLocaleString("ko-KR")}개 · ${participantCount.toLocaleString("ko-KR")}명 참여 중`;
}

/** 정원 대비 참여 상태 */
export function capacityText(memberCount: number, capacity: number | null): string {
  return capacity ? `${memberCount}/${capacity}명` : `${memberCount}명`;
}

export function isFull(memberCount: number, capacity: number | null): boolean {
  return capacity !== null && memberCount >= capacity;
}
