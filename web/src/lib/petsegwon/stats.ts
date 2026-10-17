// ============================================================
// 펫세권 분석 — "업장 1곳당 등록 반려견 수" (순수 함수, 테스트 대상)
//
// 지표 = 등록 반려견 수 ÷ 영업 중 업장 수. 클수록 업장이 모자란 지역(공급 부족 후보), 작을수록 몰린 지역(밀집).
// 자료는 두 단계다.
//  1) 기본: 농식품부 2025 실태조사 시도별 총량(baseline-2025.json) — 시도·전국 값만 있다. 코드에 들어 있어 늘 동작한다.
//  2) 시군구: scripts/petsegwon 파이프라인(공공데이터포털 등록·인허가 자료)이 만든 stats.json 을
//     관리자 뉴스 화면에서 올리면 site_settings(petsegwon_stats)에 저장되고, 시군구 선택이 열린다.
// 판정 기준: 비교 대상 평균의 120% 이상 "공급 부족 후보", 80% 미만 "밀집 지역", 그 사이 "평균권", 원 업장 3곳 미만 "표본 적음".
// ============================================================
import baseline from "./baseline-2025.json";

export const PETSEGWON_STATS_KEY = "petsegwon_stats";
export const DEFAULT_INDUSTRY = "grooming";

export type PetsegwonLabel = "공급 부족 후보" | "평균권" | "밀집 지역" | "표본 적음" | "업장 없음";

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

/** 업종 표시 순서 — 보호자가 자주 쓰는 업종부터 */
export const INDUSTRY_ORDER = ["grooming", "boarding", "sales", "exhibition", "transport", "funeral", "production", "import"] as const;

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
  if (pct >= t.short) return "공급 부족 후보";
  if (pct < t.dense) return "밀집 지역";
  return "평균권";
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

const LABELS: readonly PetsegwonLabel[] = ["공급 부족 후보", "평균권", "밀집 지역", "표본 적음", "업장 없음"];

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
      const label = LABELS.includes(x.label as PetsegwonLabel) ? (x.label as PetsegwonLabel) : labelFor(num(x.pct_of_sido_avg), num(x.shops_raw), thresholds);
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

/** 업종 목록 — 시군구 자료가 있으면 그 업종들, 없으면 실태조사 8개 (표시 순서대로) */
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
