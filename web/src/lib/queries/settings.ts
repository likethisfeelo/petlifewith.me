// 사이트 설정 조회·저장 — site_settings(key, value jsonb). 기본값·정규화는 lib/settings.ts.
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
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
