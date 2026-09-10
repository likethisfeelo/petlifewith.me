// ============================================================
// 요청함 — 업체 등록·정보 관리·유료 노출·돌봄 파트너 등록의 입력 검증과 슬랙 문구 (순수, 테스트 대상).
//
// 흐름은 하나: 공개 폼(로그인 없음) → service_requests 저장 → 슬랙 알림 → 관리자가 요청함(/admin/requests)에서 처리.
// 신청자 이름·연락처·사업자번호는 관리자 화면과 슬랙에만 간다 (claude.md 5-6). 결제는 수동 — 운영자가 안내·확인한다.
// ============================================================

export const REQUEST_KINDS = ["spot_register", "spot_claim", "maker_claim", "promo_slot", "care_partner"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export const REQUEST_STATUSES = ["new", "in_progress", "done", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_KIND_LABEL: Record<RequestKind, string> = {
  spot_register: "업체 등록",
  spot_claim: "정보 관리 (업체)",
  maker_claim: "정보 관리 (메이커)",
  promo_slot: "지역 상단 노출",
  care_partner: "돌봄 파트너 등록",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  new: "접수",
  in_progress: "처리 중",
  done: "완료",
  rejected: "거절",
};

/** 유료 노출 형 — 일단 A·B·C 로만 구분한다 (내용·가격은 뒤에 구체화, 설정 화면의 설명으로 안내) */
export const PROMO_PLANS = ["a", "b", "c"] as const;
export type PromoPlan = (typeof PROMO_PLANS)[number];
export const PROMO_PLAN_LABEL: Record<PromoPlan, string> = { a: "A형", b: "B형", c: "C형" };

export const REQUEST_LIMITS = {
  name: 40,
  contact: 60,
  bizNo: 20,
  message: 1000,
  businessName: 80,
  intro: 1000,
  short: 120,
  url: 300,
  /** 활동 지역 최대 수 (돌봄 파트너) */
  areas: 5,
  /** 같은 IP(해시)에서 한 시간에 받는 요청 수 */
  perHour: 5,
} as const;

export interface RequesterValues {
  requesterName: string;
  contact: string;
  bizRegistrationNo: string | null;
  message: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function field(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

function optional(raw: Record<string, unknown>, key: string, max: number, label: string): string | null | { error: string } {
  const v = field(raw, key);
  if (!v) return null;
  if (v.length > max) return { error: `${label}은(는) ${max}자 이내로 적어 주세요.` };
  return v;
}

/** 전화번호·카카오톡 ID·이메일 — 숫자·영문·한글·@._+-() 공백만 */
const CONTACT_RE = /^[0-9A-Za-z가-힣@._+\-() ]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

/** 모든 요청 공통: 봇 함정·이름·연락처·동의·사업자번호·메시지 */
export function validateRequester(raw: Record<string, unknown>): Validation<RequesterValues> {
  if (field(raw, "website")) return { ok: false, error: "요청을 처리할 수 없습니다." };
  const requesterName = field(raw, "requesterName");
  if (requesterName.length < 1 || requesterName.length > REQUEST_LIMITS.name) return { ok: false, error: `이름(담당자)을 ${REQUEST_LIMITS.name}자 이내로 적어 주세요.` };
  const contact = field(raw, "contact");
  if (contact.length < 5 || contact.length > REQUEST_LIMITS.contact || !CONTACT_RE.test(contact)) return { ok: false, error: "연락처(전화번호·카카오톡 ID·이메일)를 확인해 주세요." };
  if (raw.consent !== "on" && raw.consent !== true) return { ok: false, error: "연락처 확인 용도 사용에 동의해 주셔야 요청할 수 있습니다." };
  const biz = optional(raw, "bizRegistrationNo", REQUEST_LIMITS.bizNo, "사업자등록번호");
  if (biz && typeof biz === "object") return { ok: false, error: biz.error };
  const message = optional(raw, "message", REQUEST_LIMITS.message, "요청 내용");
  if (message && typeof message === "object") return { ok: false, error: message.error };
  return { ok: true, value: { requesterName, contact, bizRegistrationNo: biz, message } };
}

// ---------- 종류별 내용 ----------

export interface SpotRegisterPayload {
  businessName: string;
  typeSlug: string;
  regionId: number;
  addressRoad: string | null;
  phone: string | null;
  website: string | null;
  kakaoUrl: string | null;
  instagramUrl: string | null;
  intro: string | null;
}

export interface CarePartnerPayload {
  typeSlug: string; // pet-sitter / hourly-sitter / dog-walk
  displayName: string;
  regionIds: number[];
  intro: string;
  priceText: string | null;
  hoursText: string | null;
  kakaoUrl: string | null;
}

export interface PromoSlotPayload {
  plan: PromoPlan;
  regionId: number | null;
  /** 기존 업체가 아닐 때 적는 업체명 (spot_id 가 있으면 비어도 된다) */
  businessName: string | null;
}

export type RequestPayload = SpotRegisterPayload | CarePartnerPayload | PromoSlotPayload | Record<string, never>;

function url(raw: Record<string, unknown>, key: string, label: string): string | null | { error: string } {
  const v = field(raw, key);
  if (!v) return null;
  if (v.length > REQUEST_LIMITS.url || !URL_RE.test(v)) return { error: `${label} 주소는 https:// 로 시작하는 링크로 적어 주세요.` };
  return v;
}

function intField(raw: Record<string, unknown>, key: string): number | null {
  const n = Number(field(raw, key));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function validateSpotRegister(raw: Record<string, unknown>, allowedTypes: string[]): Validation<SpotRegisterPayload> {
  const businessName = field(raw, "businessName");
  if (businessName.length < 2 || businessName.length > REQUEST_LIMITS.businessName) return { ok: false, error: "업체명을 2자 이상 적어 주세요." };
  const typeSlug = field(raw, "typeSlug");
  if (!allowedTypes.includes(typeSlug)) return { ok: false, error: "업종을 골라 주세요." };
  const regionId = intField(raw, "regionId");
  if (!regionId) return { ok: false, error: "지역(시군구)을 골라 주세요." };
  const addressRoad = optional(raw, "addressRoad", REQUEST_LIMITS.short, "주소");
  if (addressRoad && typeof addressRoad === "object") return { ok: false, error: addressRoad.error };
  const phone = optional(raw, "phone", REQUEST_LIMITS.contact, "전화번호");
  if (phone && typeof phone === "object") return { ok: false, error: phone.error };
  // 봇 함정이 "website" 라서 홈페이지 칸은 homepage 로 받는다
  const website = url(raw, "homepage", "홈페이지");
  if (website && typeof website === "object") return { ok: false, error: website.error };
  const kakaoUrl = url(raw, "kakaoUrl", "카카오톡 채널");
  if (kakaoUrl && typeof kakaoUrl === "object") return { ok: false, error: kakaoUrl.error };
  const instagramUrl = url(raw, "instagramUrl", "인스타그램");
  if (instagramUrl && typeof instagramUrl === "object") return { ok: false, error: instagramUrl.error };
  const intro = optional(raw, "intro", REQUEST_LIMITS.intro, "소개");
  if (intro && typeof intro === "object") return { ok: false, error: intro.error };
  return { ok: true, value: { businessName, typeSlug, regionId, addressRoad, phone, website, kakaoUrl, instagramUrl, intro } };
}

export function validateCarePartner(raw: Record<string, unknown>, careTypes: string[]): Validation<CarePartnerPayload> {
  const typeSlug = field(raw, "typeSlug");
  if (!careTypes.includes(typeSlug)) return { ok: false, error: "어떤 일을 하시는지(펫시터·시간제 시터·도그워커) 골라 주세요." };
  const displayName = field(raw, "displayName");
  if (displayName.length < 2 || displayName.length > REQUEST_LIMITS.businessName) return { ok: false, error: "활동명(표시 이름)을 2자 이상 적어 주세요." };
  const regionIds = [...new Set(field(raw, "regionIds").split(",").map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0))];
  if (regionIds.length === 0) return { ok: false, error: "활동 지역을 하나 이상 골라 주세요." };
  if (regionIds.length > REQUEST_LIMITS.areas) return { ok: false, error: `활동 지역은 ${REQUEST_LIMITS.areas}곳까지입니다.` };
  const intro = field(raw, "intro");
  if (intro.length < 10 || intro.length > REQUEST_LIMITS.intro) return { ok: false, error: `소개를 10자 이상 ${REQUEST_LIMITS.intro}자 이내로 적어 주세요.` };
  const priceText = optional(raw, "priceText", REQUEST_LIMITS.short, "요금");
  if (priceText && typeof priceText === "object") return { ok: false, error: priceText.error };
  const hoursText = optional(raw, "hoursText", REQUEST_LIMITS.short, "활동 시간");
  if (hoursText && typeof hoursText === "object") return { ok: false, error: hoursText.error };
  const kakaoUrl = url(raw, "kakaoUrl", "카카오톡 채널");
  if (kakaoUrl && typeof kakaoUrl === "object") return { ok: false, error: kakaoUrl.error };
  return { ok: true, value: { typeSlug, displayName, regionIds, intro, priceText, hoursText, kakaoUrl } };
}

export function validatePromoSlot(raw: Record<string, unknown>, hasSpot: boolean): Validation<PromoSlotPayload> {
  const plan = field(raw, "plan");
  if (!(PROMO_PLANS as readonly string[]).includes(plan)) return { ok: false, error: "노출 형(A·B·C)을 골라 주세요." };
  const regionId = intField(raw, "regionId");
  const businessName = optional(raw, "businessName", REQUEST_LIMITS.businessName, "업체명");
  if (businessName && typeof businessName === "object") return { ok: false, error: businessName.error };
  if (!hasSpot && !businessName) return { ok: false, error: "업체명을 적어 주세요." };
  return { ok: true, value: { plan: plan as PromoPlan, regionId, businessName } };
}

// ---------- 슬랙 ----------

export function slackRequestText(input: {
  id: number;
  kind: RequestKind;
  requesterName: string;
  contact: string;
  summary: string[];
  message: string | null;
  adminUrl: string;
}): string {
  const lines = [
    `📮 요청함 #${input.id} · ${REQUEST_KIND_LABEL[input.kind]}`,
    ...input.summary.map((s) => `• ${s}`),
    `• 담당자: ${input.requesterName} / ${input.contact}`,
  ];
  if (input.message) lines.push(`• 내용: ${input.message.replace(/\s+/g, " ").slice(0, 300)}`);
  lines.push(`→ ${input.adminUrl}`);
  return lines.join("\n");
}
