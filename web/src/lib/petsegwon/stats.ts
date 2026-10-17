// ============================================================
// 펫세권 분석 — "업장 1곳당 등록 반려견 수" (순수 함수, 테스트 대상)
//
// 지표 = 등록 반려견 수 ÷ 영업 중 업장 수. 클수록 업장 1곳에 대응하는 등록견이 많고, 작을수록 적다.
// (수요·수익성 지표가 아니다 — 판정 이름도 지표 그대로 "업장 대비 등록견 많음/적음"으로 쓴다)
// 자료는 두 단계다.
//  1) 기본: 농식품부 2025 실태조사 시도별 총량(baseline-2025.json) — 시도·전국 값만 있다. 코드에 들어 있어 늘 동작한다.
//  2) 시군구: scripts/petsegwon 파이프라인(공공데이터포털 등록·인허가 자료)이 만든 stats.json 을
//     관리자 뉴스 화면에서 올리면 site_settings(petsegwon_stats)에 저장되고, 시군구 선택이 열린다.
// 판정 기준: 비교 대상 평균의 120% 이상 "업장 대비 등록견 많음", 80% 미만 "업장 대비 등록견 적음", 그 사이 "평균 수준", 원 업장 3곳 미만 "표본 적음".
// ============================================================
import baseline from "./baseline-2025.json";

export const PETSEGWON_STATS_KEY = "petsegwon_stats";
export const DEFAULT_INDUSTRY = "grooming";

export type PetsegwonLabel = "업장 대비 등록견 많음" | "평균 수준" | "업장 대비 등록견 적음" | "표본 적음" | "업장 없음";

/** 예전 파이프라인 판정 이름 → 지금 이름 */
const LEGACY_LABELS: Record<string, PetsegwonLabel> = { "공급 부족 후보": "업장 대비 등록견 많음", 평균권: "평균 수준", "밀집 지역": "업장 대비 등록견 적음" };

export interface NationalIndustry {
  dogs: number;
  shops: number;
  per_shop: number | null;
}

export interface SidoIndustry {
  shops: number;
  per_shop: number | null;
  national_rank?: number;
  rank_total?: number;
}

export interface SigunguIndustry {
  shops: number;
  shops_raw: number;
  per_shop: number | null;
  pct_of_sido_avg: number | null;
  pct_of_national_avg: number | null;
  label: PetsegwonLabel;
  rank_in_sido?: number;
  count_in_sido?: number;
}

export interface SigunguRecord {
  sido: string;
  sigungu: string;
  dogs: number;
  industries: Record<string, SigunguIndustry>;
}

export interface PetsegwonStats {
  meta: {
    generated_at: string;
    baseline: string;
    baseline_reference_date: string;
    industries: Record<string, string>;
    thresholds: { short: number; dense: number; minShops: number };
    /** baseline = 실태조사 시도 값만, pipeline = 시군구까지 */
    source: "baseline" | "pipeline";
  };
  national: Record<string, NationalIndustry>;
  sido: Record<string, { dogs: number; industries: Record<string, SidoIndustry> }>;
  sigungu: SigunguRecord[];
}

export const THRESHOLDS = { short: 120, dense: 80, minShops: 3 } as const;

/** 업종 표시 순서 — 보호자가 자주 쓰는 업종부터. 동물판매업(sales)은 도구에 보이지 않게 뺐다 (계산 자료에는 남아 있다) */
export const INDUSTRY_ORDER = ["grooming", "boarding", "exhibition", "transport", "funeral", "production", "import"] as const;

/** 업종 이름에서 "동물" 떼기 (동물미용업 → 미용업) */
export function industryShort(name: string): string {
  return name.replace(/^동물/, "");
}

export const SIDO_ORDER = Object.keys(baseline.sido);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function labelFor(pct: number | null, shopsRaw: number | null, t: { short: number; dense: number; minShops: number } = THRESHOLDS): PetsegwonLabel {
  if (shopsRaw !== null && shopsRaw < t.minShops) return "표본 적음";
  if (pct === null) return "업장 없음";
  if (pct >= t.short) return "업장 대비 등록견 많음";
  if (pct < t.dense) return "업장 대비 등록견 적음";
  return "평균 수준";
}

/** 실태조사 시도 값으로 만든 기본 통계 (시군구 없음) — build_stats.py 와 같은 계산 */
export function baselineStats(): PetsegwonStats {
  const industries = baseline.industries as Record<string, string>;
  const sidos = baseline.sido as Record<string, { dogs: number; shops: Record<string, number> }>;
  const totalDogs = Object.values(sidos).reduce((s, v) => s + v.dogs, 0);

  const national: Record<string, NationalIndustry> = {};
  for (const ind of Object.keys(industries)) {
    const shops = Object.values(sidos).reduce((s, v) => s + (v.shops[ind] ?? 0), 0);
    national[ind] = { dogs: totalDogs, shops, per_shop: shops ? round1(totalDogs / shops) : null };
  }

  const sido: PetsegwonStats["sido"] = {};
  for (const [name, v] of Object.entries(sidos)) {
    sido[name] = { dogs: v.dogs, industries: {} };
    for (const ind of Object.keys(industries)) {
      const n = v.shops[ind] ?? 0;
      sido[name].industries[ind] = { shops: n, per_shop: n ? round1(v.dogs / n) : null };
    }
  }
  rankSidos(sido, Object.keys(industries));

  return {
    meta: {
      generated_at: "2026-06-30T00:00:00+00:00",
      baseline: baseline.source,
      baseline_reference_date: baseline.reference_date,
      industries,
      thresholds: { ...THRESHOLDS },
      source: "baseline",
    },
    national,
    sido,
    sigungu: [],
  };
}

function rankSidos(sido: PetsegwonStats["sido"], industries: string[]) {
  for (const ind of industries) {
    const ranked = Object.keys(sido)
      .filter((s) => sido[s]!.industries[ind]?.per_shop != null)
      .sort((a, b) => sido[b]!.industries[ind]!.per_shop! - sido[a]!.industries[ind]!.per_shop!);
    ranked.forEach((s, i) => {
      const d = sido[s]!.industries[ind]!;
      d.national_rank = i + 1;
      d.rank_total = ranked.length;
    });
  }
}

// ---------- 올린 stats.json 검사 ----------

const MAX_SIGUNGU = 400;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function int(v: unknown): number | undefined {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : undefined;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function shortText(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

const LABELS: readonly PetsegwonLabel[] = ["업장 대비 등록견 많음", "평균 수준", "업장 대비 등록견 적음", "표본 적음", "업장 없음"];

/**
 * 파이프라인이 만든 stats.json → 화면에서 쓰는 모양. 시도·업종 이름은 실태조사 목록에 있는 것만 받는다.
 * 시도·전국 평균은 파일 값을 쓰지 않고 실태조사로 다시 계산한다(보정 설정상 둘은 같아야 한다).
 */
export function normalizeStats(raw: unknown): { ok: true; value: PetsegwonStats } | { ok: false; error: string } {
  const root = obj(raw);
  if (!root) return { ok: false, error: "JSON 객체가 아닙니다." };
  const meta = obj(root.meta);
  if (!meta || !Array.isArray(root.sigungu)) return { ok: false, error: "stats.json 모양이 아닙니다 (meta·sigungu 가 없습니다)." };
  if (root.sigungu.length === 0) return { ok: false, error: "시군구 자료가 비어 있습니다." };
  if (root.sigungu.length > MAX_SIGUNGU) return { ok: false, error: `시군구가 ${MAX_SIGUNGU}개를 넘습니다.` };

  const base = baselineStats();
  const known = base.meta.industries;
  const th = obj(meta.label_thresholds_pct_of_sido_avg) ?? obj(meta.thresholds);
  const thresholds = {
    short: num(th?.short) ?? THRESHOLDS.short,
    dense: num(th?.dense) ?? THRESHOLDS.dense,
    minShops: THRESHOLDS.minShops,
  };

  const records: SigunguRecord[] = [];
  const seen = new Set<string>();
  const present = new Set<string>();
  for (const r of root.sigungu) {
    const o = obj(r);
    if (!o) continue;
    const sido = shortText(o.sido, 10);
    const sigungu = shortText(o.sigungu, 30).trim();
    if (!base.sido[sido] || !sigungu || seen.has(`${sido}|${sigungu}`)) continue;
    seen.add(`${sido}|${sigungu}`);
    const inds: Record<string, SigunguIndustry> = {};
    for (const [ind, d] of Object.entries(obj(o.industries) ?? {})) {
      const x = obj(d);
      if (!known[ind] || !x) continue;
      present.add(ind);
      const rawLabel = typeof x.label === "string" ? (LEGACY_LABELS[x.label] ?? x.label) : "";
      const label = LABELS.includes(rawLabel as PetsegwonLabel) ? (rawLabel as PetsegwonLabel) : labelFor(num(x.pct_of_sido_avg), num(x.shops_raw), thresholds);
      inds[ind] = {
        shops: num(x.shops) ?? 0,
        shops_raw: num(x.shops_raw) ?? 0,
        per_shop: num(x.per_shop),
        pct_of_sido_avg: num(x.pct_of_sido_avg),
        pct_of_national_avg: num(x.pct_of_national_avg),
        label,
        rank_in_sido: int(x.rank_in_sido),
        count_in_sido: int(x.count_in_sido),
      };
    }
    records.push({ sido, sigungu, dogs: Math.max(0, Math.round(num(o.dogs) ?? 0)), industries: inds });
  }
  if (records.length === 0) return { ok: false, error: "알아볼 수 있는 시군구 행이 없습니다 (시도 이름을 확인하세요)." };

  records.sort((a, b) => SIDO_ORDER.indexOf(a.sido) - SIDO_ORDER.indexOf(b.sido) || a.sigungu.localeCompare(b.sigungu, "ko"));
  return {
    ok: true,
    value: {
      ...base,
      meta: {
        ...base.meta,
        generated_at: shortText(meta.generated_at, 40) || new Date().toISOString(),
        baseline_reference_date: shortText(meta.baseline_reference_date, 20) || base.meta.baseline_reference_date,
        thresholds,
        source: "pipeline",
        // 시군구 자료가 있는 업종만 (실태조사 순서 유지)
        industries: Object.fromEntries(Object.entries(known).filter(([k]) => present.has(k))),
      },
      sigungu: records,
    },
  };
}

// ---------- 화면용 계산 ----------

/** 업종 목록 — 시군구 자료가 있으면 그 업종들, 없으면 실태조사 업종 (표시 순서대로, 판매업 제외) */
export function industryList(stats: PetsegwonStats, all = false): string[] {
  const keys = all ? Object.keys(baseline.industries) : Object.keys(stats.meta.industries);
  return INDUSTRY_ORDER.filter((k) => keys.includes(k));
}

export function industryName(stats: PetsegwonStats, ind: string): string {
  return industryShort((baseline.industries as Record<string, string>)[ind] ?? stats.meta.industries[ind] ?? ind);
}

export function sigunguList(stats: PetsegwonStats, sido: string): SigunguRecord[] {
  return stats.sigungu.filter((r) => r.sido === sido);
}

export interface RegionResult {
  /** 이 지역 1곳당 마리 수 */
  perShop: number | null;
  dogs: number;
  shops: number;
  shopsRaw: number | null;
  /** 비교 기준 (시군구면 시도 평균, 시도면 전국 평균) */
  compareName: string;
  compareAvg: number | null;
  pctOfCompare: number | null;
  sidoAvg: number | null;
  nationalAvg: number | null;
  pctOfNational: number | null;
  rank?: number;
  rankTotal?: number;
  rankScope: string;
  label: PetsegwonLabel;
}

function pct(a: number | null, b: number | null): number | null {
  return a != null && b ? round1((a / b) * 100) : null;
}

/** 시도(sigungu 없음) 또는 시군구 하나의 결과 */
export function regionResult(stats: PetsegwonStats, sido: string, sigungu: string | null, ind: string): RegionResult | null {
  const s = stats.sido[sido];
  const n = stats.national[ind];
  if (!s || !n) return null;
  const sd = s.industries[ind];
  const sidoAvg = sd?.per_shop ?? null;
  const nationalAvg = n.per_shop;

  if (sigungu) {
    const rec = stats.sigungu.find((r) => r.sido === sido && r.sigungu === sigungu);
    const d = rec?.industries[ind];
    if (!rec || !d) return null;
    return {
      perShop: d.per_shop,
      dogs: rec.dogs,
      shops: d.shops,
      shopsRaw: d.shops_raw,
      compareName: `${sido} 평균`,
      compareAvg: sidoAvg,
      pctOfCompare: d.pct_of_sido_avg ?? pct(d.per_shop, sidoAvg),
      sidoAvg,
      nationalAvg,
      pctOfNational: d.pct_of_national_avg ?? pct(d.per_shop, nationalAvg),
      rank: d.rank_in_sido,
      rankTotal: d.count_in_sido,
      rankScope: sido,
      label: d.label,
    };
  }

  const p = pct(sidoAvg, nationalAvg);
  return {
    perShop: sidoAvg,
    dogs: s.dogs,
    shops: sd?.shops ?? 0,
    shopsRaw: sd?.shops ?? 0,
    compareName: "전국 평균",
    compareAvg: nationalAvg,
    pctOfCompare: p,
    sidoAvg,
    nationalAvg,
    pctOfNational: p,
    rank: sd?.national_rank,
    rankTotal: sd?.rank_total,
    rankScope: "전국 시도",
    label: labelFor(p, sd?.shops ?? 0, stats.meta.thresholds),
  };
}

/** 숫자 표시 — 1곳당 마리 수는 정수로 반올림 */
export function fmtCount(n: number | null | undefined): string {
  return n == null ? "-" : Math.round(n).toLocaleString("ko-KR");
}

// ---------- 지역 검색 (키워드 → 시군구·시도 목록) ----------

export interface RegionOption {
  sido: string;
  /** "" 이면 시도 전체 */
  sigungu: string;
  label: string;
}

/** 시도 정식 이름 — "서울특별시"·"경상남도"로 쳐도 찾게 */
const SIDO_FULL: Record<string, string> = {
  서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시", 인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시",
  세종: "세종특별자치시", 경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도", 전남: "전라남도",
  경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도",
};

const squash = (s: string) => s.replace(/[\s·]/g, "");

/** 일반구 → 시 (자료는 시 단위로 합쳐져 있다). "영통구"로 찾아도 수원시가 나오게 */
const GENERAL_GU: Array<[string, string, string[]]> = [
  ["경기", "수원시", ["장안구", "권선구", "팔달구", "영통구"]],
  ["경기", "성남시", ["수정구", "중원구", "분당구"]],
  ["경기", "고양시", ["덕양구", "일산동구", "일산서구"]],
  ["경기", "용인시", ["처인구", "기흥구", "수지구"]],
  ["경기", "안산시", ["상록구", "단원구"]],
  ["경기", "안양시", ["만안구", "동안구"]],
  ["경기", "부천시", ["원미구", "소사구", "오정구"]],
  ["경기", "화성시", ["만세구", "효행구", "병점구", "동탄구"]],
  ["충북", "청주시", ["상당구", "서원구", "흥덕구", "청원구"]],
  ["충남", "천안시", ["동남구", "서북구"]],
  ["전북", "전주시", ["완산구", "덕진구"]],
  ["경북", "포항시", ["남구", "북구"]],
  ["경남", "창원시", ["의창구", "성산구", "마산합포구", "마산회원구", "진해구"]],
];

/**
 * 키워드로 지역 찾기 — 시군구가 있으면 가장 작은 단위(시군구)부터, 그다음 시도 전체.
 * 빈 키워드면 시도 목록. 시군구 이름이 앞에서 맞는 것을 먼저 보여 준다.
 */
export function searchRegions(stats: PetsegwonStats, query: string, limit = 30): RegionOption[] {
  const q = squash(query.trim());
  const sidoOpts: RegionOption[] = SIDO_ORDER.map((s) => ({ sido: s, sigungu: "", label: stats.sigungu.length ? `${s} 전체` : s }));
  if (!q) return sidoOpts;
  const scored: Array<{ o: RegionOption; score: number }> = [];
  for (const r of stats.sigungu) {
    const g = squash(r.sigungu);
    const full = squash(`${r.sido}${r.sigungu}`);
    const fullOfficial = squash(`${SIDO_FULL[r.sido] ?? r.sido}${r.sigungu}`);
    const score = g.startsWith(q) ? 0 : g.includes(q) ? 1 : full.startsWith(q) || fullOfficial.startsWith(q) ? 2 : full.includes(q) || fullOfficial.includes(q) ? 3 : -1;
    if (score >= 0) scored.push({ o: { sido: r.sido, sigungu: r.sigungu, label: `${r.sido} ${r.sigungu}` }, score });
  }
  // 일반구 이름으로 찾으면 그 시를 "(○○구 포함)"으로 보여 준다
  const has = new Set(scored.map((x) => `${x.o.sido}|${x.o.sigungu}`));
  for (const [sido, city, gus] of GENERAL_GU) {
    if (has.has(`${sido}|${city}`) || !stats.sigungu.some((r) => r.sido === sido && r.sigungu === city)) continue;
    const gu = gus.find((g) => squash(g).startsWith(q) || (q.length >= 2 && squash(g).includes(q)) || squash(`${city}${g}`).startsWith(q));
    if (gu) {
      scored.push({ o: { sido, sigungu: city, label: `${sido} ${city} (${gu} 포함)` }, score: squash(gu).startsWith(q) ? 0 : 1 });
      has.add(`${sido}|${city}`);
    }
  }
  for (const o of sidoOpts) {
    const names = [o.sido, SIDO_FULL[o.sido] ?? o.sido].map(squash);
    if (names.some((n) => n.startsWith(q) || q.startsWith(n))) scored.push({ o, score: 4 });
  }
  return scored
    .sort((a, b) => a.score - b.score || SIDO_ORDER.indexOf(a.o.sido) - SIDO_ORDER.indexOf(b.o.sido) || a.o.label.localeCompare(b.o.label, "ko"))
    .slice(0, limit)
    .map((x) => x.o);
}

// ---------- 5단계 판정 + 쉬운 해석 ----------
// 비교 평균(시군구는 시도 평균, 시도는 전국 평균) 대비 % 로 나눈다. "높음" = 업장 1곳당 등록견이 많다(= 업장이 적은 편).

export type PetsegwonLevel = "much_higher" | "higher" | "average" | "lower" | "much_lower" | "small_sample" | "none";

/** 단계 경계(%): 130 이상 / 110~130 / 90~110 / 70~90 / 70 미만 */
export const LEVEL_BOUNDS = { muchHigher: 130, higher: 110, lower: 90, muchLower: 70 } as const;

export const LEVEL_LABEL: Record<PetsegwonLevel, string> = {
  much_higher: "평균보다 많이 높음",
  higher: "평균보다 조금 높음",
  average: "평균",
  lower: "평균보다 조금 낮음",
  much_lower: "평균보다 많이 낮음",
  small_sample: "표본 적음",
  none: "업장 없음",
};

export function levelFor(pct: number | null, shopsRaw: number | null, minShops: number = THRESHOLDS.minShops): PetsegwonLevel {
  if (shopsRaw !== null && shopsRaw < minShops) return "small_sample";
  if (pct === null) return "none";
  if (pct >= LEVEL_BOUNDS.muchHigher) return "much_higher";
  if (pct >= LEVEL_BOUNDS.higher) return "higher";
  if (pct >= LEVEL_BOUNDS.lower) return "average";
  if (pct >= LEVEL_BOUNDS.muchLower) return "lower";
  return "much_lower";
}

/** 받침에 맞는 조사 (동래구는 / 서울은, 평균과 / 시도와) */
export function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withBatchim : without;
}

/** 결과 아래 해석 — 한 줄 요약(title)과 풀어 쓴 설명(detail) */
export function levelExplain(level: PetsegwonLevel, ctx: { place: string; compareName: string; industry: string }): { title: string; detail: string } {
  const { compareName, industry } = ctx;
  const place = `${ctx.place}${josa(ctx.place, "은", "는")}`;
  switch (level) {
    case "much_higher":
      return {
        title: `${place} ${industry}장 1곳이 맡는 반려견이 ${compareName}보다 훨씬 많아요.`,
        detail: `반려견 수에 비해 ${industry}장이 적은 편이라는 뜻이에요. 새로 문을 열 여지가 있을 수 있지만, 이웃 동네로 다니는 손님이 많을 수도 있으니 실제 이동 동선과 상권을 함께 확인하세요.`,
      };
    case "higher":
      return {
        title: `${place} ${industry}장 1곳이 맡는 반려견이 ${compareName}보다 조금 많아요.`,
        detail: `경쟁이 평균보다 약간 덜한 편이에요. 같은 지역 안에서도 업장이 몰린 곳과 비어 있는 곳이 있으니 동 단위로 한 번 더 살펴보세요.`,
      };
    case "average":
      return {
        title: `${place} ${industry}장 1곳이 맡는 반려견 수가 ${compareName}${josa(compareName, "과", "와")} 비슷해요.`,
        detail: `숫자만으로는 업장이 특별히 많거나 적지 않아요. 이런 지역에서는 위치, 서비스 차별점, 가격대가 더 중요해요.`,
      };
    case "lower":
      return {
        title: `${place} ${industry}장 1곳이 맡는 반려견이 ${compareName}보다 조금 적어요.`,
        detail: `반려견 수에 비해 ${industry}장이 조금 많은 편이라, 평균보다 경쟁이 약간 있는 지역이에요.`,
      };
    case "much_lower":
      return {
        title: `${place} ${industry}장 1곳이 맡는 반려견이 ${compareName}보다 훨씬 적어요.`,
        detail: `${industry}장이 많이 모여 있는 지역이라 경쟁이 치열할 수 있어요. 다만 업무지구·번화가처럼 다른 동네에서 손님이 찾아오는 곳이라 숫자가 낮게 나올 수도 있어요.`,
      };
    case "small_sample":
      return {
        title: `${place} 영업 중인 ${industry}장이 ${THRESHOLDS.minShops}곳 미만이에요.`,
        detail: `업장이 아주 적으면 1곳만 늘거나 줄어도 숫자가 크게 흔들려요. 비교보다는 참고용으로만 보세요.`,
      };
    case "none":
      return { title: `${ctx.place}에는 비교할 ${industry}장 자료가 없어요.`, detail: "" };
  }
}
