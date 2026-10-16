// ============================================================
// 측정 규약 — 순수 함수 (docs/측정기획_GA4_GTM.md 3장)
//
// 브라우저는 GTM dataLayer 로 page_context → page_view 순서로 보내고, 나머지는 아래 이벤트 이름만 쓴다.
// GTM 의 "GA4 이벤트 목록" 트리거 정규식(docs/gtm/petlife-gtm-container.json)이 이 목록과 같아야 한다 — 테스트가 맞춘다.
// 개인을 식별할 값(이메일·닉네임·연락처·회원 ID)은 어떤 이벤트에도 넣지 않는다.
// ============================================================

export const TRACK_EVENTS = [
  "page_view",
  "entity_click",
  "body_map_click",
  "directory_banner_click",
  "contact_click",
  "purchase_click",
  "promo_impression",
  "promo_click",
  "reservation_request",
  "direct_chat_start",
  "sign_up",
  "login",
  "post_submit",
  "comment",
  "save",
  "like",
  "meetup_join",
  "meetup_create",
  "request_submit",
  "share",
  "tool_action",
] as const;

export type TrackEvent = (typeof TRACK_EVENTS)[number];
export type TrackParams = Record<string, string | number | boolean | null | undefined>;

export function isTrackEvent(name: string): name is TrackEvent {
  return (TRACK_EVENTS as readonly string[]).includes(name);
}

/** GTM 트리거에 넣는 정규식 — TRACK_EVENTS 와 한 글자도 다르면 안 된다 */
export function gtmEventRegex(): string {
  return `^(${TRACK_EVENTS.join("|")})$`;
}

export interface PageContext {
  page_type: string;
  content_group: "content" | "directory" | "community" | "partner" | "account" | "portal" | "other";
  topic?: string;
  category?: string;
  board?: string;
  spot_type?: string;
  region_sido?: string;
  region_sigungu?: string;
  entity_type?: string;
  entity_id?: string;
  is_sponsored?: boolean;
  is_promoted?: boolean;
  is_member_post?: boolean;
}

/** 주소만으로 정할 수 있는 페이지 문맥. 상세 페이지는 <TrackContext> 가 개체 정보를 덧붙인다 */
export function pageContextForPath(pathname: string): PageContext {
  const seg = pathname.split("?")[0]!.split("/").filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  const [a, b, c, d] = seg;
  if (!a) return { page_type: "home", content_group: "content" };
  switch (a) {
    case "guide":
      return { page_type: "guide", content_group: "content" };
    case "topic": {
      if (!c) return { page_type: "topic", content_group: "content", topic: b };
      if (c === "curated") return { page_type: "topic_board", content_group: "content", topic: b, board: "curated" };
      if (c === "challenge") return { page_type: "topic_board", content_group: "community", topic: b, board: "general" };
      return { page_type: "topic_board", content_group: "community", topic: b, board: "category", category: c };
    }
    case "tag":
      return { page_type: "tag", content_group: "content" };
    case "curation":
      return { page_type: "curation", content_group: "content" };
    case "news":
      return b ? { page_type: "news", content_group: "content", entity_type: "news" } : { page_type: "news_list", content_group: "content" };
    case "spot": {
      if (!b) return { page_type: "spot_hub", content_group: "directory" };
      if (b === "type") return { page_type: "spot_type", content_group: "directory", spot_type: c };
      if (!c) return { page_type: "spot_sido", content_group: "directory", region_sido: b };
      if (!d) return { page_type: "spot_region", content_group: "directory", region_sido: b, region_sigungu: c };
      return { page_type: "spot_region_type", content_group: "directory", region_sido: b, region_sigungu: c, spot_type: d };
    }
    case "place":
      return { page_type: "place", content_group: "directory", entity_type: "spot" };
    case "maker":
      return b ? { page_type: "maker", content_group: "directory", entity_type: "maker" } : { page_type: "maker_hub", content_group: "directory" };
    case "item":
      return { page_type: "item", content_group: "directory", entity_type: "item" };
    case "device":
      return b ? { page_type: "device", content_group: "directory", entity_type: "device" } : { page_type: "device_hub", content_group: "directory" };
    case "rehab":
      return { page_type: "rehab", content_group: "directory" };
    case "consult":
      return b ? { page_type: "expert", content_group: "partner", entity_type: "expert" } : { page_type: "consult", content_group: "partner" };
    case "meetup":
      return { page_type: "meetup", content_group: "community" };
    case "book":
    case "reservations":
    case "chat":
      return { page_type: a, content_group: "partner" };
    case "portal":
    case "claim":
      return { page_type: "portal", content_group: "portal" };
    case "write":
      return { page_type: "write", content_group: "community" };
    case "login":
    case "signup":
    case "me":
      return { page_type: a === "me" ? "my_page" : a, content_group: "account" };
    default:
      return { page_type: "other", content_group: "other" };
  }
}

/** 페이지 문맥 키 — page_context 를 넣을 때 전부 다시 쓴다(GTM 데이터 모델은 이전 페이지 값을 기억하므로) */
export const PAGE_CONTEXT_KEYS = [
  "page_type",
  "content_group",
  "topic",
  "category",
  "board",
  "spot_type",
  "region_sido",
  "region_sigungu",
  "entity_type",
  "entity_id",
  "is_sponsored",
  "is_promoted",
  "is_member_post",
] as const;

/** 이벤트 전용 파라미터 — 이벤트마다 비우고 다시 쓴다(앞 이벤트의 channel 등이 남지 않게) */
export const EVENT_PARAM_KEYS = [
  "channel",
  "vendor",
  "is_affiliate",
  "kind",
  "method",
  "request_kind",
  "plan",
  "link_area",
  "banner",
  "has_video",
  "from_page_type",
  "tool",
] as const;

/** GTM 데이터 영역 변수로 만들 전체 키 (GA4 이벤트 태그 파라미터) */
export const GTM_PARAM_KEYS = [...PAGE_CONTEXT_KEYS, ...EVENT_PARAM_KEYS, "login_state", "page_location", "page_path", "page_title"] as const;

/** 지정 키들을 undefined 로 — dataLayer 에 넣으면 GTM 이 이전 값을 지운다 */
export function resetKeys(keys: readonly string[]): Record<string, undefined> {
  return Object.fromEntries(keys.map((k) => [k, undefined]));
}

/** undefined·빈 문자열 값은 보내지 않는다 (GA4 에 "(not set)" 대신 빈 값이 쌓이지 않게) */
export function cleanParams(params: TrackParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/** data-track-* 속성 → 이벤트 파라미터 (data-track-entity-id → entity_id) */
export function paramsFromDataset(dataset: Record<string, string | undefined>): TrackParams {
  const out: TrackParams = {};
  for (const [k, v] of Object.entries(dataset)) {
    if (!k.startsWith("track") || k === "track" || k === "trackImpression") continue;
    const name = k
      .slice("track".length)
      .replace(/^[A-Z]/, (m) => m.toLowerCase())
      .replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    if (v === "true") out[name] = true;
    else if (v === "false") out[name] = false;
    else out[name] = v;
  }
  return out;
}
