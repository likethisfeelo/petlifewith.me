// 관리·재활 도구(기기) 조회 — device_models / device_dealers / device_sites / guide_device_tags.
// 공개 목록은 published 만. 체험 가능 업체는 스팟에 연결돼 지도·예약 요청으로 이어지고, 보유 병원은 무료 목록(순위 없음).
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";
import { idSlugPath } from "../format";
import type { DeviceCategory } from "../devices";

const { deviceModels, deviceDealers, deviceSites, guideDeviceTags, guides, regions, spots, spotTypes } = schema;

export type DeviceRow = typeof deviceModels.$inferSelect;

export interface DeviceCard {
  id: number;
  slug: string;
  name: string;
  makerName: string | null;
  category: DeviceCategory;
  imageKey: string | null;
  homeUse: boolean;
  priceText: string | null;
  featuredOrder: number | null;
  summaryExcerpt: string | null;
  trialCount: number;
  hospitalCount: number;
  guideCount: number;
}

function excerpt(md: string | null, n = 120): string | null {
  if (!md) return null;
  const plain = md.replace(/[#*_>`\[\]()]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > n ? `${plain.slice(0, n)}…` : plain;
}

const trialCountSql = sql<number>`(select count(*) from ${deviceSites} ds where ds.device_model_id = device_models.id and ds.kind = 'trial')`.mapWith(Number);
const hospitalCountSql = sql<number>`(select count(*) from ${deviceSites} ds where ds.device_model_id = device_models.id and ds.kind = 'hospital')`.mapWith(Number);
const guideCountSql = sql<number>`(select count(*) from ${guideDeviceTags} gt join ${guides} g on g.id = gt.guide_id where gt.device_model_id = device_models.id and g.status = 'published')`.mapWith(Number);

function toCard(d: DeviceRow, trialCount: number, hospitalCount: number, guideCount: number): DeviceCard {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    makerName: d.makerName,
    category: d.category,
    imageKey: d.imageKey,
    homeUse: d.homeUse,
    priceText: d.priceText,
    featuredOrder: d.featuredOrder,
    summaryExcerpt: excerpt(d.summaryMd),
    trialCount,
    hospitalCount,
    guideCount,
  };
}

export async function listPublishedDevices(category?: DeviceCategory | null): Promise<DeviceCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ d: deviceModels, trialCount: trialCountSql, hospitalCount: hospitalCountSql, guideCount: guideCountSql })
    .from(deviceModels)
    .where(category ? and(eq(deviceModels.published, true), eq(deviceModels.category, category)) : eq(deviceModels.published, true))
    .orderBy(asc(deviceModels.name));
  return rows.map((r) => toCard(r.d, r.trialCount, r.hospitalCount, r.guideCount));
}

/** 주목 기기 — 운영자가 순서를 준 것 (광고 표기). featured_order 오름차순 */
export async function listFeaturedDevices(): Promise<DeviceCard[]> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ d: deviceModels, trialCount: trialCountSql, hospitalCount: hospitalCountSql, guideCount: guideCountSql })
    .from(deviceModels)
    .where(and(eq(deviceModels.published, true), isNotNull(deviceModels.featuredOrder)))
    .orderBy(asc(deviceModels.featuredOrder))
    .limit(4);
  return rows.map((r) => toCard(r.d, r.trialCount, r.hospitalCount, r.guideCount));
}

export async function countPublishedDevicesByCategory(): Promise<Record<string, number>> {
  if (!isDbConfigured()) return {};
  const rows = await getDb().select({ category: deviceModels.category, n: sql<number>`count(*)`.mapWith(Number) }).from(deviceModels).where(eq(deviceModels.published, true)).groupBy(deviceModels.category);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
}

export interface DeviceDealerRow {
  id: number;
  name: string;
  regionLabel: string | null;
  sidoSlug: string | null;
  url: string | null;
  phone: string | null;
  note: string | null;
}

export interface DeviceHospitalSite {
  id: number;
  facilityName: string;
  regionLabel: string | null;
  verifiedAt: string | null;
  note: string | null;
}

export interface DeviceTrialSite {
  id: number;
  spotId: number;
  name: string;
  path: string;
  regionLabel: string | null;
  sidoSlug: string | null;
  typeName: string | null;
  status: string | null;
  verifiedAt: string | null;
  note: string | null;
}

export interface DeviceGuideRef {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  sponsorName: string | null;
  publishedAt: Date | null;
}

export interface DeviceDetail extends DeviceCard {
  summaryMd: string | null;
  specsMd: string | null;
  makerUrl: string | null;
  makerContactUrl: string | null;
  published: boolean;
  dealers: DeviceDealerRow[];
  hospitals: DeviceHospitalSite[];
  trials: DeviceTrialSite[];
  guides: DeviceGuideRef[];
  updatedAt: Date;
}

async function detailOf(d: DeviceRow): Promise<DeviceDetail> {
  const db = getDb();
  const [dealers, sites, guideRows, counts] = await Promise.all([
    db
      .select({ id: deviceDealers.id, name: deviceDealers.name, url: deviceDealers.url, phone: deviceDealers.phone, note: deviceDealers.note, sidoName: regions.sidoName, sigunguName: regions.sigunguName, sidoSlug: regions.sidoSlug })
      .from(deviceDealers)
      .leftJoin(regions, eq(deviceDealers.regionId, regions.id))
      .where(eq(deviceDealers.deviceModelId, d.id))
      .orderBy(asc(deviceDealers.sortOrder), asc(deviceDealers.id)),
    db
      .select({
        id: deviceSites.id,
        kind: deviceSites.kind,
        facilityName: deviceSites.facilityName,
        verifiedAt: deviceSites.verifiedAt,
        note: deviceSites.note,
        spotId: spots.id,
        spotName: spots.name,
        spotSlug: spots.slug,
        spotStatus: spots.status,
        typeName: spotTypes.name,
        sidoName: regions.sidoName,
        sigunguName: regions.sigunguName,
        sidoSlug: regions.sidoSlug,
      })
      .from(deviceSites)
      .leftJoin(spots, eq(deviceSites.spotId, spots.id))
      .leftJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .leftJoin(regions, eq(sql`coalesce(${spots.regionId}, ${deviceSites.regionId})`, regions.id))
      .where(eq(deviceSites.deviceModelId, d.id))
      .orderBy(asc(deviceSites.facilityName)),
    db
      .select({ id: guides.id, slug: guides.slug, title: guides.title, summary: guides.summary, sponsorName: guides.sponsorName, publishedAt: guides.publishedAt })
      .from(guideDeviceTags)
      .innerJoin(guides, eq(guideDeviceTags.guideId, guides.id))
      .where(and(eq(guideDeviceTags.deviceModelId, d.id), eq(guides.status, "published")))
      .orderBy(desc(guides.publishedAt))
      .limit(30),
    db.select({ trialCount: trialCountSql, hospitalCount: hospitalCountSql, guideCount: guideCountSql }).from(deviceModels).where(eq(deviceModels.id, d.id)),
  ]);
  const c = counts[0] ?? { trialCount: 0, hospitalCount: 0, guideCount: 0 };
  const label = (sido: string | null, sigungu: string | null) => (sido && sigungu ? `${sido} ${sigungu}` : null);
  // 협찬 글을 앞에 — 광고 표기와 함께
  const sorted = [...guideRows].sort((a, b) => Number(Boolean(b.sponsorName)) - Number(Boolean(a.sponsorName)));
  return {
    ...toCard(d, c.trialCount, c.hospitalCount, c.guideCount),
    summaryMd: d.summaryMd,
    specsMd: d.specsMd,
    makerUrl: d.makerUrl,
    makerContactUrl: d.makerContactUrl,
    published: d.published,
    dealers: dealers.map((x) => ({ id: x.id, name: x.name, regionLabel: label(x.sidoName, x.sigunguName), sidoSlug: x.sidoSlug, url: x.url, phone: x.phone, note: x.note })),
    hospitals: sites.filter((x) => x.kind === "hospital").map((x) => ({ id: x.id, facilityName: x.facilityName, regionLabel: label(x.sidoName, x.sigunguName), verifiedAt: x.verifiedAt, note: x.note })),
    trials: sites
      .filter((x) => x.kind === "trial" && x.spotId)
      .map((x) => ({
        id: x.id,
        spotId: x.spotId!,
        name: x.spotName ?? x.facilityName,
        path: idSlugPath("place", x.spotId!, x.spotSlug ?? ""),
        regionLabel: label(x.sidoName, x.sigunguName),
        sidoSlug: x.sidoSlug,
        typeName: x.typeName,
        status: x.spotStatus,
        verifiedAt: x.verifiedAt,
        note: x.note,
      })),
    guides: sorted,
    updatedAt: d.updatedAt,
  };
}

export async function getDeviceBySlug(slug: string): Promise<DeviceDetail | null> {
  if (!isDbConfigured()) return null;
  const d = (await getDb().select().from(deviceModels).where(eq(deviceModels.slug, slug)).limit(1))[0];
  return d ? detailOf(d) : null;
}

export async function getDeviceById(id: number): Promise<DeviceDetail | null> {
  if (!isDbConfigured()) return null;
  const d = (await getDb().select().from(deviceModels).where(eq(deviceModels.id, id)).limit(1))[0];
  return d ? detailOf(d) : null;
}

/** 스팟이 보유·체험 제공하는 기기 — 업체 페이지 "보유 장비" 칩과 운동·재활 노출 게이트 */
export async function listDevicesForSpot(spotId: number): Promise<Array<{ id: number; slug: string; name: string; category: DeviceCategory; published: boolean }>> {
  if (!isDbConfigured()) return [];
  return getDb()
    .select({ id: deviceModels.id, slug: deviceModels.slug, name: deviceModels.name, category: deviceModels.category, published: deviceModels.published })
    .from(deviceSites)
    .innerJoin(deviceModels, eq(deviceSites.deviceModelId, deviceModels.id))
    .where(and(eq(deviceSites.spotId, spotId), eq(deviceSites.kind, "trial")))
    .orderBy(asc(deviceModels.name));
}

export async function countDevicesForSpots(spotIds: number[]): Promise<Record<number, number>> {
  if (!isDbConfigured() || spotIds.length === 0) return {};
  const rows = await getDb()
    .select({ spotId: deviceSites.spotId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(deviceSites)
    .where(and(inArray(deviceSites.spotId, spotIds), eq(deviceSites.kind, "trial")))
    .groupBy(deviceSites.spotId);
  return Object.fromEntries(rows.filter((r) => r.spotId !== null).map((r) => [r.spotId!, r.n]));
}

/** 관리자 스팟 편집기의 "보유 장비" 선택지 */
export async function listDeviceOptions(): Promise<Array<{ id: number; name: string; makerName: string | null }>> {
  if (!isDbConfigured()) return [];
  return getDb().select({ id: deviceModels.id, name: deviceModels.name, makerName: deviceModels.makerName }).from(deviceModels).orderBy(asc(deviceModels.name));
}

/** 색인용 — 공개 + 원리 설명이 충분한 기기 */
export async function listIndexableDevices(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  if (!isDbConfigured()) return [];
  const rows = await getDb()
    .select({ slug: deviceModels.slug, updatedAt: deviceModels.updatedAt, summaryMd: deviceModels.summaryMd })
    .from(deviceModels)
    .where(eq(deviceModels.published, true));
  return rows.filter((r) => (r.summaryMd ?? "").trim().length >= 200).map((r) => ({ slug: r.slug, updatedAt: r.updatedAt }));
}

/**
 * 운동·재활 유형의 유료 상단 노출 조건 — 재활·특수 훈련 장비를 등록했고, 동물병원이 아닐 것.
 * 병원은 장비 보유처로 무료 노출만 한다 (claude.md 6-2).
 */
export async function canPromoteRehabSpot(spotId: number): Promise<boolean> {
  if (!isDbConfigured()) return false;
  const row = (await getDb().select({ isHospital: spots.isHospital }).from(spots).where(eq(spots.id, spotId)).limit(1))[0];
  if (!row || row.isHospital) return false;
  const link = (
    await getDb()
      .select({ id: deviceSites.id })
      .from(deviceSites)
      .where(and(eq(deviceSites.spotId, spotId), eq(deviceSites.kind, "trial")))
      .limit(1)
  )[0];
  return Boolean(link);
}
