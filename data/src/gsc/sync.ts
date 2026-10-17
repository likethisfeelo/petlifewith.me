// ============================================================
// Google Search Console → 우리 DB 보관 (gsc_daily_totals · gsc_query_daily)
//
// Search Console 은 16개월만 보관하므로 매일 받아 계속 쌓는다.
//  - 인증: 서비스 계정(JWT). Search Console 속성의 "사용자 및 권한"에 서비스 계정 이메일을 추가해 둔다.
//    env: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY(줄바꿈은 \n 으로), GSC_SITE_URL(기본 https://petlifewith.me/)
//  - 받는 날짜: (1) 아직 안 받은 날 — 16개월 전부터 최근까지, 최신 날짜부터 maxDays 개씩
//               (2) 최근 refreshDays 일 — 구글이 며칠간 값을 고치므로 매번 다시 받는다
//  - 하루 단위로 받고, 그 날짜 행을 지운 뒤 새로 넣는다(트랜잭션) — 몇 번을 돌려도 결과가 같다.
// 실행: 매일 SST Cron(data/src/gsc/handler.ts), 관리자 "지금 가져오기", 로컬 `pnpm --filter @app/data gsc:sync`
// ============================================================
import { createSign } from "node:crypto";
import { and, gte, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";

const { gscDailyTotals, gscQueryDaily } = schema;

type Db = NodePgDatabase<typeof schema>;

export interface GscConfig {
  clientEmail: string;
  privateKey: string;
  siteUrl: string;
}

export interface SyncOptions {
  /** 한 번에 새로 받을 최대 날짜 수 (관리자 버튼은 작게, Cron 은 크게) */
  maxDays?: number;
  /** 매번 다시 받을 최근 날짜 수 */
  refreshDays?: number;
  /** 기준일 (테스트용) */
  today?: Date;
}

export interface SyncResult {
  fetchedDays: string[];
  rows: number;
  remainingMissing: number;
}

/** 구글이 보관하는 기간 — 16개월. 경계 날짜는 오류가 나기 쉬워 하루 여유를 둔다 */
export const GSC_HISTORY_DAYS = 486;
/** 최근 며칠은 아직 집계 중 — 3일 전까지만 받는다 */
export const GSC_LAG_DAYS = 3;

/** env → 설정. 하나라도 없으면 null (기능 꺼짐) */
export function gscConfigFromEnv(env: Record<string, string | undefined> = process.env): GscConfig | null {
  const clientEmail = env.GSC_CLIENT_EMAIL?.trim();
  const rawKey = env.GSC_PRIVATE_KEY?.trim();
  if (!clientEmail || !rawKey) return null;
  // .env 한 줄에 넣느라 \n 으로 쓴 줄바꿈을 되돌린다. 따옴표째 붙여 넣은 경우도 벗긴다
  const privateKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  return { clientEmail, privateKey, siteUrl: env.GSC_SITE_URL?.trim() || "https://petlifewith.me/" };
}

// ---------- 날짜 ----------

/** UTC 기준 YYYY-MM-DD (Search Console 날짜는 태평양 시간이지만 하루 단위 키로만 쓴다) */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

/** 받을 수 있는 범위 [oldest, newest] */
export function gscWindow(today: Date): { oldest: string; newest: string } {
  const newest = addDays(isoDate(today), -GSC_LAG_DAYS);
  return { oldest: addDays(newest, -(GSC_HISTORY_DAYS - GSC_LAG_DAYS)), newest };
}

/** 이번에 받을 날짜 — 최근 refreshDays 일 + 아직 없는 날(최신부터) maxDays 개 */
export function planDays(
  have: Set<string>,
  today: Date,
  opts: { maxDays: number; refreshDays: number },
): { days: string[]; remainingMissing: number } {
  const { oldest, newest } = gscWindow(today);
  const refresh: string[] = [];
  for (let i = 0; i < opts.refreshDays; i++) {
    const d = addDays(newest, -i);
    if (d >= oldest) refresh.push(d);
  }
  const missing: string[] = [];
  for (let d = newest; d >= oldest; d = addDays(d, -1)) {
    if (!have.has(d) && !refresh.includes(d)) missing.push(d);
  }
  const take = missing.slice(0, Math.max(0, opts.maxDays));
  return { days: [...refresh, ...take], remainingMissing: missing.length - take.length };
}

/** https://petlifewith.me/place/x?y → /place/x?y */
export function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

// ---------- 인증 ----------

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** 서비스 계정 JWT (RS256) — 구글 토큰 교환용 */
export function serviceAccountJwt(cfg: GscConfig, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: cfg.clientEmail,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(cfg.privateKey))}`;
}

async function accessToken(cfg: GscConfig): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountJwt(cfg, Math.floor(Date.now() / 1000)),
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Search Console 인증 실패: ${data.error_description ?? data.error ?? res.status}`);
  return data.access_token;
}

// ---------- API ----------

interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function query(token: string, cfg: GscConfig, body: Record<string, unknown>): Promise<GscRow[]> {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "web", ...body }),
  });
  const data = (await res.json()) as { rows?: GscRow[]; error?: { message?: string } };
  if (!res.ok) {
    const msg = data.error?.message ?? String(res.status);
    if (res.status === 403) {
      throw new Error(`Search Console 권한 없음 (${cfg.siteUrl}): 서비스 계정 ${cfg.clientEmail} 을 속성 사용자로 추가했는지 확인하세요. — ${msg}`);
    }
    throw new Error(`Search Console 조회 실패: ${msg}`);
  }
  return data.rows ?? [];
}

const ROW_LIMIT = 25_000;

async function fetchDay(token: string, cfg: GscConfig, day: string) {
  const rows: GscRow[] = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const page = await query(token, cfg, {
      startDate: day,
      endDate: day,
      dimensions: ["query", "page", "device"],
      rowLimit: ROW_LIMIT,
      startRow,
    });
    rows.push(...page);
    if (page.length < ROW_LIMIT) break;
  }
  return rows;
}

// ---------- 동기화 ----------

export async function syncSearchConsole(db: Db, cfg: GscConfig, opts: SyncOptions = {}): Promise<SyncResult> {
  const today = opts.today ?? new Date();
  const { oldest, newest } = gscWindow(today);
  const haveRows = await db
    .select({ date: gscDailyTotals.date })
    .from(gscDailyTotals)
    .where(and(gte(gscDailyTotals.date, oldest), lte(gscDailyTotals.date, newest)));
  const plan = planDays(new Set(haveRows.map((r) => r.date)), today, { maxDays: opts.maxDays ?? 120, refreshDays: opts.refreshDays ?? 5 });
  if (plan.days.length === 0) return { fetchedDays: [], rows: 0, remainingMissing: 0 };

  const token = await accessToken(cfg);

  // 날짜별 합계 — 범위 한 번에 (유입이 없던 날은 행이 오지 않으므로 0 으로 채운다)
  const sorted = [...plan.days].sort();
  const totalsRows = await query(token, cfg, { startDate: sorted[0], endDate: sorted[sorted.length - 1], dimensions: ["date"], rowLimit: ROW_LIMIT });
  const totals = new Map(totalsRows.map((r) => [r.keys[0]!, r]));

  let rowCount = 0;
  for (const day of plan.days) {
    const detail = await fetchDay(token, cfg, day);
    const t = totals.get(day);
    await db.transaction(async (tx) => {
      await tx.delete(gscQueryDaily).where(and(gte(gscQueryDaily.date, day), lte(gscQueryDaily.date, day)));
      for (let i = 0; i < detail.length; i += 1000) {
        await tx.insert(gscQueryDaily).values(
          detail.slice(i, i + 1000).map((r) => ({
            date: day,
            query: r.keys[0] ?? "",
            page: pagePath(r.keys[1] ?? ""),
            device: r.keys[2] ?? "",
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: r.ctr,
            position: r.position,
          })),
        );
      }
      const values = { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0, fetchedAt: new Date() };
      await tx
        .insert(gscDailyTotals)
        .values({ date: day, ...values })
        .onConflictDoUpdate({ target: gscDailyTotals.date, set: values });
    });
    rowCount += detail.length;
  }
  return { fetchedDays: plan.days, rows: rowCount, remainingMissing: plan.remainingMissing };
}

// ---------- 실행 기록 (관리자 화면 표시용 — site_settings.gsc_sync) ----------

export const GSC_SYNC_KEY = "gsc_sync";

export interface GscSyncStatus {
  at: string;
  ok: boolean;
  trigger: "cron" | "admin" | "cli";
  error?: string;
  fetchedDays?: number;
  rows?: number;
  remainingMissing?: number;
}

export async function recordSyncStatus(db: Db, status: GscSyncStatus): Promise<void> {
  await db
    .insert(schema.siteSettings)
    .values({ key: GSC_SYNC_KEY, value: status })
    .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: status, updatedAt: new Date() } });
}

/** 동기화 + 기록 — 실패해도 기록은 남기고 다시 던진다 */
export async function runSearchConsoleSync(db: Db, trigger: GscSyncStatus["trigger"], opts: SyncOptions = {}): Promise<SyncResult> {
  const cfg = gscConfigFromEnv();
  if (!cfg) throw new Error("GSC_CLIENT_EMAIL·GSC_PRIVATE_KEY 가 설정되지 않았습니다.");
  try {
    const result = await syncSearchConsole(db, cfg, opts);
    await recordSyncStatus(db, {
      at: new Date().toISOString(),
      ok: true,
      trigger,
      fetchedDays: result.fetchedDays.length,
      rows: result.rows,
      remainingMissing: result.remainingMissing,
    });
    return result;
  } catch (e) {
    await recordSyncStatus(db, { at: new Date().toISOString(), ok: false, trigger, error: e instanceof Error ? e.message.slice(0, 500) : String(e) });
    throw e;
  }
}
