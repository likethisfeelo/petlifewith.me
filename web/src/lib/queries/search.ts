// 검색 유입(Search Console 보관분) 조회 — 관리자 /admin/search 와 CSV 내려받기용.
// 데이터는 data/src/gsc/sync.ts 가 매일 쌓는다. 평균 순위는 노출 수로 가중 평균한다.
import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { GSC_SYNC_KEY, type GscSyncStatus } from "@app/data/gsc";
import { getDb, isDbConfigured, schema } from "../db";

const { gscDailyTotals, gscQueryDaily, siteSettings } = schema;

export interface SearchFilter {
  from: string;
  to: string;
  /** 검색어에 포함 */
  q?: string;
  /** 페이지 경로에 포함 (/place/… 등) */
  page?: string;
  device?: string;
}

export interface SearchMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const SEARCH_DEVICES = ["DESKTOP", "MOBILE", "TABLET"] as const;

/** 쿼리스트링 → 필터. 기간이 없으면 보관된 마지막 날부터 28일 */
export function parseSearchFilter(sp: Record<string, string | string[] | undefined>, latest: string | null): SearchFilter {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const end = latest ?? new Date().toISOString().slice(0, 10);
  const defFrom = new Date(`${end}T00:00:00Z`);
  defFrom.setUTCDate(defFrom.getUTCDate() - 27);
  let from = DATE_RE.test(one("from")) ? one("from") : defFrom.toISOString().slice(0, 10);
  let to = DATE_RE.test(one("to")) ? one("to") : end;
  if (from > to) [from, to] = [to, from];
  const device = one("device").toUpperCase();
  return {
    from,
    to,
    q: one("q").slice(0, 100) || undefined,
    page: one("page").slice(0, 200) || undefined,
    device: (SEARCH_DEVICES as readonly string[]).includes(device) ? device : undefined,
  };
}

/** LIKE 특수문자를 글자 그대로 찾게 */
function likeContains(v: string): string {
  return `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

function detailWhere(f: SearchFilter): SQL | undefined {
  return and(
    gte(gscQueryDaily.date, f.from),
    lte(gscQueryDaily.date, f.to),
    f.q ? ilike(gscQueryDaily.query, likeContains(f.q)) : undefined,
    f.page ? ilike(gscQueryDaily.page, likeContains(f.page)) : undefined,
    f.device ? eq(gscQueryDaily.device, f.device) : undefined,
  );
}

const sumClicks = sql<number>`coalesce(sum(${gscQueryDaily.clicks}), 0)`.mapWith(Number);
const sumImpr = sql<number>`coalesce(sum(${gscQueryDaily.impressions}), 0)`.mapWith(Number);
const wPosition = sql<number>`coalesce(sum(${gscQueryDaily.position} * ${gscQueryDaily.impressions}) / nullif(sum(${gscQueryDaily.impressions}), 0), 0)`.mapWith(Number);

function withCtr<T extends { clicks: number; impressions: number }>(r: T): T & { ctr: number } {
  return { ...r, ctr: r.impressions ? r.clicks / r.impressions : 0 };
}

export function isFiltered(f: SearchFilter): boolean {
  return Boolean(f.q || f.page || f.device);
}

export interface SearchCoverage {
  oldest: string | null;
  latest: string | null;
  days: number;
  rows: number;
  status: GscSyncStatus | null;
}

export async function getSearchCoverage(): Promise<SearchCoverage> {
  if (!isDbConfigured()) return { oldest: null, latest: null, days: 0, rows: 0, status: null };
  const db = getDb();
  const [t, r, s] = await Promise.all([
    db
      .select({
        oldest: sql<string | null>`min(${gscDailyTotals.date})`,
        latest: sql<string | null>`max(${gscDailyTotals.date})`,
        days: sql<number>`count(*)`.mapWith(Number),
      })
      .from(gscDailyTotals),
    // 행 수는 대략값이면 충분하다 (큰 표에서 count(*) 를 피한다)
    db.execute(sql`select coalesce(reltuples, 0)::bigint as n from pg_class where relname = 'gsc_query_daily'`),
    db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, GSC_SYNC_KEY)).limit(1),
  ]);
  const rowsApprox = Number((r.rows[0] as { n?: string | number } | undefined)?.n ?? 0);
  return {
    oldest: t[0]?.oldest ?? null,
    latest: t[0]?.latest ?? null,
    days: t[0]?.days ?? 0,
    rows: Math.max(0, rowsApprox),
    status: (s[0]?.value as GscSyncStatus | undefined) ?? null,
  };
}

/** 기간 합계 — 필터가 없으면 정확한 사이트 합계(gsc_daily_totals), 있으면 검색어 행 합 */
export async function getSearchSummary(f: SearchFilter): Promise<SearchMetrics> {
  const db = getDb();
  if (!isFiltered(f)) {
    const row = (
      await db
        .select({
          clicks: sql<number>`coalesce(sum(${gscDailyTotals.clicks}), 0)`.mapWith(Number),
          impressions: sql<number>`coalesce(sum(${gscDailyTotals.impressions}), 0)`.mapWith(Number),
          position: sql<number>`coalesce(sum(${gscDailyTotals.position} * ${gscDailyTotals.impressions}) / nullif(sum(${gscDailyTotals.impressions}), 0), 0)`.mapWith(Number),
        })
        .from(gscDailyTotals)
        .where(and(gte(gscDailyTotals.date, f.from), lte(gscDailyTotals.date, f.to)))
    )[0];
    return withCtr(row ?? { clicks: 0, impressions: 0, position: 0 });
  }
  const row = (await db.select({ clicks: sumClicks, impressions: sumImpr, position: wPosition }).from(gscQueryDaily).where(detailWhere(f)))[0];
  return withCtr(row ?? { clicks: 0, impressions: 0, position: 0 });
}

/** 날짜별 추이 */
export async function getSearchDaily(f: SearchFilter): Promise<Array<SearchMetrics & { date: string }>> {
  const db = getDb();
  if (!isFiltered(f)) {
    const rows = await db
      .select({ date: gscDailyTotals.date, clicks: gscDailyTotals.clicks, impressions: gscDailyTotals.impressions, position: gscDailyTotals.position })
      .from(gscDailyTotals)
      .where(and(gte(gscDailyTotals.date, f.from), lte(gscDailyTotals.date, f.to)))
      .orderBy(gscDailyTotals.date);
    return rows.map(withCtr);
  }
  const rows = await db
    .select({ date: gscQueryDaily.date, clicks: sumClicks, impressions: sumImpr, position: wPosition })
    .from(gscQueryDaily)
    .where(detailWhere(f))
    .groupBy(gscQueryDaily.date)
    .orderBy(gscQueryDaily.date);
  return rows.map(withCtr);
}

/** 검색어 순위 (기간 합) */
export async function getTopQueries(f: SearchFilter, limit = 200): Promise<Array<SearchMetrics & { query: string; pages: number }>> {
  const rows = await getDb()
    .select({
      query: gscQueryDaily.query,
      clicks: sumClicks,
      impressions: sumImpr,
      position: wPosition,
      pages: sql<number>`count(distinct ${gscQueryDaily.page})`.mapWith(Number),
    })
    .from(gscQueryDaily)
    .where(detailWhere(f))
    .groupBy(gscQueryDaily.query)
    .orderBy(desc(sumClicks), desc(sumImpr))
    .limit(limit);
  return rows.map(withCtr);
}

/** 페이지 순위 (기간 합) */
export async function getTopPages(f: SearchFilter, limit = 100): Promise<Array<SearchMetrics & { page: string; queries: number }>> {
  const rows = await getDb()
    .select({
      page: gscQueryDaily.page,
      clicks: sumClicks,
      impressions: sumImpr,
      position: wPosition,
      queries: sql<number>`count(distinct ${gscQueryDaily.query})`.mapWith(Number),
    })
    .from(gscQueryDaily)
    .where(detailWhere(f))
    .groupBy(gscQueryDaily.page)
    .orderBy(desc(sumClicks), desc(sumImpr))
    .limit(limit);
  return rows.map(withCtr);
}

export interface SearchDetailRow extends SearchMetrics {
  date: string;
  query: string;
  page: string;
  device: string;
}

/** 날짜 × 검색어 × 페이지 × 기기 원본 행 (최신 날짜·클릭 많은 순) */
export async function getSearchDetail(f: SearchFilter, limit: number, offset = 0): Promise<SearchDetailRow[]> {
  return getDb()
    .select({
      date: gscQueryDaily.date,
      query: gscQueryDaily.query,
      page: gscQueryDaily.page,
      device: gscQueryDaily.device,
      clicks: gscQueryDaily.clicks,
      impressions: gscQueryDaily.impressions,
      ctr: gscQueryDaily.ctr,
      position: gscQueryDaily.position,
    })
    .from(gscQueryDaily)
    .where(detailWhere(f))
    .orderBy(desc(gscQueryDaily.date), desc(gscQueryDaily.clicks), desc(gscQueryDaily.impressions), gscQueryDaily.id)
    .limit(limit)
    .offset(offset);
}

/** CSV 한 칸 — 쉼표·따옴표·줄바꿈 처리, 엑셀 수식 주입(=,+,-,@ 로 시작) 방지 */
export function csvCell(v: string | number): string {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
