// ============================================================
// GA4 관리 설정 자동화 — docs/운영.md 4-4, docs/측정기획_GA4_GTM.md 5장
//
// 하는 일 (이미 있는 것은 건너뛴다 — 몇 번을 실행해도 안전)
//   1) 맞춤 측정기준 등록 — 이벤트 범위 20개 + 사용자 범위 login_state
//   2) 핵심 이벤트 등록 — 이벤트가 아직 한 번도 안 들어왔어도 이름으로 미리 만든다
//   3) 데이터 보관 기간 14개월
//   4) 웹 스트림 향상된 측정: "브라우저 기록 기반 페이지 변경"·사이트 검색 끄기 (페이지뷰 2배 방지)
// 콘솔에서 직접 해야 하는 것: 원치 않는 추천, AI 어시스턴트 채널 그룹, Search Console 연결
//
// 사용법 (Node 18 이상)
//   1. https://developers.google.com/oauthplayground 에서
//      Step 1 입력칸에  https://www.googleapis.com/auth/analytics.edit  입력 → Authorize APIs → GA4 관리 계정으로 로그인
//      Step 2 → Exchange authorization code for tokens → Access token 복사 (1시간 유효)
//   2. 미리보기(바꾸지 않고 할 일만 출력):
//        PowerShell:  $env:GA_TOKEN="복사한토큰"; node scripts/ga4-setup.mjs
//   3. 실제 적용:   node scripts/ga4-setup.mjs --apply
//   속성 ID 가 다르면 GA_PROPERTY=123456789 (GA4 주소창의 p 뒤 숫자)
// ============================================================

const PROPERTY = process.env.GA_PROPERTY || "551822121";
const TOKEN = process.env.GA_TOKEN;
const APPLY = process.argv.includes("--apply");
const BASE = "https://analyticsadmin.googleapis.com";

// 측정 규약 web/src/lib/tracking.ts 와 맞춘다
const EVENT_DIMENSIONS = [
  ["page_type", "페이지 유형"],
  ["content_group", "콘텐츠 그룹"],
  ["topic", "토픽"],
  ["category", "카테고리"],
  ["board", "게시판"],
  ["spot_type", "스팟 유형"],
  ["region_sido", "시도"],
  ["region_sigungu", "시군구"],
  ["entity_type", "개체 유형"],
  ["entity_id", "개체 ID"],
  ["channel", "연락 채널"],
  ["vendor", "판매처"],
  ["kind", "종류"],
  ["method", "방식"],
  ["request_kind", "요청 종류"],
  ["link_area", "링크 위치"],
  ["banner", "배너"],
  ["is_promoted", "상단 노출 여부"],
  ["is_sponsored", "광고 여부"],
  ["tool", "도구"],
];
const USER_DIMENSIONS = [["login_state", "로그인 상태"]];
const KEY_EVENTS = ["sign_up", "contact_click", "reservation_request", "request_submit", "purchase_click"];

if (!TOKEN) {
  console.error("GA_TOKEN 이 없습니다. 파일 맨 위 사용법을 보세요 (OAuth Playground 에서 Access token 발급).");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.error?.message ?? text;
    throw new Error(`${method} ${path} → ${res.status} ${msg}`);
  }
  return data;
}

async function listAll(path, key) {
  const out = [];
  let pageToken = "";
  do {
    const sep = path.includes("?") ? "&" : "?";
    const data = await api("GET", `${path}${sep}pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`);
    out.push(...(data[key] ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

const prop = `properties/${PROPERTY}`;
let changes = 0;
const act = async (label, fn) => {
  changes++;
  if (!APPLY) return console.log(`  + ${label}`);
  await fn();
  console.log(`  ✓ ${label}`);
};

console.log(`GA4 속성 ${PROPERTY} — ${APPLY ? "적용" : "미리보기 (바꾸려면 --apply)"}\n`);

// 1) 맞춤 측정기준
console.log("맞춤 측정기준");
const dims = await listAll(`/v1beta/${prop}/customDimensions`, "customDimensions");
const have = new Set(dims.map((d) => `${d.scope}:${d.parameterName}`));
for (const [scope, list] of [["EVENT", EVENT_DIMENSIONS], ["USER", USER_DIMENSIONS]]) {
  for (const [parameterName, displayName] of list) {
    if (have.has(`${scope}:${parameterName}`)) {
      console.log(`  = ${parameterName} (${scope}) 이미 있음`);
      continue;
    }
    await act(`${parameterName} → "${displayName}" (${scope})`, () =>
      api("POST", `/v1beta/${prop}/customDimensions`, { parameterName, displayName, scope, description: "petlife 측정 규약 (scripts/ga4-setup.mjs)" }),
    );
  }
}

// 2) 핵심 이벤트
console.log("\n핵심 이벤트");
const keyEvents = new Set((await listAll(`/v1beta/${prop}/keyEvents`, "keyEvents")).map((k) => k.eventName));
for (const eventName of KEY_EVENTS) {
  if (keyEvents.has(eventName)) {
    console.log(`  = ${eventName} 이미 있음`);
    continue;
  }
  await act(eventName, () => api("POST", `/v1beta/${prop}/keyEvents`, { eventName, countingMethod: "ONCE_PER_EVENT" }));
}

// 3) 데이터 보관 기간
console.log("\n데이터 보관 기간");
const retention = await api("GET", `/v1beta/${prop}/dataRetentionSettings`);
if (retention.eventDataRetention === "FOURTEEN_MONTHS") console.log("  = 14개월 (이미 설정됨)");
else
  await act(`${retention.eventDataRetention ?? "?"} → FOURTEEN_MONTHS`, () =>
    api("PATCH", `/v1beta/${prop}/dataRetentionSettings?updateMask=eventDataRetention`, { name: retention.name, eventDataRetention: "FOURTEEN_MONTHS" }),
  );

// 4) 향상된 측정 — 웹 스트림마다
console.log("\n향상된 측정 (웹 스트림)");
const streams = (await listAll(`/v1beta/${prop}/dataStreams`, "dataStreams")).filter((s) => s.type === "WEB_DATA_STREAM");
if (streams.length === 0) console.log("  웹 스트림이 없습니다.");
for (const s of streams) {
  const path = `/v1alpha/${s.name}/enhancedMeasurementSettings`;
  const em = await api("GET", path);
  const label = `${s.displayName} (${s.webStreamData?.defaultUri ?? s.name})`;
  if (em.pageChangesEnabled === false && em.siteSearchEnabled === false) {
    console.log(`  = ${label}: 페이지 변경·사이트 검색 이미 꺼짐`);
    continue;
  }
  await act(`${label}: 브라우저 기록 기반 페이지 변경 끄기, 사이트 검색 끄기`, () =>
    api("PATCH", `${path}?updateMask=pageChangesEnabled,siteSearchEnabled`, { name: em.name, pageChangesEnabled: false, siteSearchEnabled: false }),
  );
}

console.log(
  `\n${APPLY ? "완료" : changes ? `바꿀 것 ${changes}개 — 확인했으면 --apply 로 다시 실행하세요` : "바꿀 것이 없습니다"}.` +
    "\n콘솔에서 직접: 원치 않는 추천(amazoncognito.com, kauth.kakao.com, accounts.kakao.com), AI 어시스턴트 채널 그룹, Search Console 연결",
);
