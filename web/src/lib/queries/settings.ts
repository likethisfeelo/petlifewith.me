// 사이트 설정 조회·저장 — site_settings(key, value jsonb). 기본값·정규화는 lib/settings.ts.
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { NEWS_BANNERS_KEY, normalizeNewsBanners, type NewsBanner } from "../news-banners";
import { PETSEGWON_STATS_KEY, baselineStats, normalizeStats, type PetsegwonStats } from "../petsegwon/stats";
import { MEMBER_MEDIA_KEY, PROMO_PLANS_KEY, normalizeMemberMedia, normalizePromoPlans, type MemberMediaSettings, type PromoPlanSettings } from "../settings";

const { siteSettings } = schema;

export async function getMemberMediaSettings(): Promise<MemberMediaSettings> {
  if (!isDbConfigured()) return normalizeMemberMedia(null);
  const row = (await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, MEMBER_MEDIA_KEY)).limit(1))[0];
  return normalizeMemberMedia(row?.value ?? null);
}

export async function saveMemberMediaSettings(next: MemberMediaSettings): Promise<void> {
  const value = normalizeMemberMedia(next);
  await getDb()
    .insert(siteSettings)
    .values({ key: MEMBER_MEDIA_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

// ---------- 유료 노출 형 안내 (promo_plans) ----------
export async function getPromoPlanSettings(): Promise<PromoPlanSettings> {
  if (!isDbConfigured()) return normalizePromoPlans(null);
  const row = (await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PROMO_PLANS_KEY)).limit(1))[0];
  return normalizePromoPlans(row?.value ?? null);
}

export async function savePromoPlanSettings(next: PromoPlanSettings): Promise<void> {
  const value = normalizePromoPlans(next);
  await getDb()
    .insert(siteSettings)
    .values({ key: PROMO_PLANS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

// ---------- 뉴스 우측 배너 (news_banners) ----------
export async function getNewsBanners(): Promise<NewsBanner[]> {
  if (!isDbConfigured()) return normalizeNewsBanners(null);
  const row = (await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, NEWS_BANNERS_KEY)).limit(1))[0];
  return normalizeNewsBanners(row?.value ?? null);
}

export async function saveNewsBanners(next: NewsBanner[]): Promise<void> {
  const value = normalizeNewsBanners(next);
  await getDb()
    .insert(siteSettings)
    .values({ key: NEWS_BANNERS_KEY, value })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } });
}

// ---------- 펫세권 분석 통계 (petsegwon_stats) ----------
// 올린 stats.json(시군구 포함)이 있으면 그것을, 없거나 모양이 깨졌으면 실태조사 시도 값만 쓴다.
export async function getPetsegwonStats(): Promise<PetsegwonStats> {
  if (!isDbConfigured()) return baselineStats();
  const row = (await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, PETSEGWON_STATS_KEY)).limit(1))[0];
  if (!row) return baselineStats();
  const r = normalizeStats(row.value);
  return r.ok ? r.value : baselineStats();
}

/** 검사한 통계를 보관한다 (읽을 때도 normalizeStats 로 다시 검사). null 이면 지워 실태조사 값만 쓴다 */
export async function savePetsegwonStats(raw: PetsegwonStats | null): Promise<void> {
  const db = getDb();
  if (raw === null) {
    await db.delete(siteSettings).where(eq(siteSettings.key, PETSEGWON_STATS_KEY));
    return;
  }
  await db
    .insert(siteSettings)
    .values({ key: PETSEGWON_STATS_KEY, value: raw })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: raw, updatedAt: new Date() } });
}
