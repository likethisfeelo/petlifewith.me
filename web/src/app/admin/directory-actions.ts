"use server";

// 디렉토리 등록·편집 서버 액션 — 스팟 / 메이커 / 상품 / 기기 / 큐레이션.
// 인증은 lib/auth.ts 만 거친다. 규칙(배지 기준일, 큐레이션 출처 표기, 장묘 무광고)은
// DB 제약 이전에 여기서 사람이 읽을 수 있는 메시지로 막는다.
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { MAX_EXPOSED_PER_AREA, REHAB_MODALITIES, isCareType, slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/links";
import { isValidObjectKey } from "@/lib/assets";
import { countExposedInArea } from "@/lib/queries/care";
import { careRelatedPaths } from "@/lib/revalidate-paths";
import { parseRows, rowBool, rowString, type ParsedRow } from "./_components/parse-rows";

const {
  spots,
  spotLinks,
  spotServiceAreas,
  spotTypes,
  regions,
  makers,
  makerLinks,
  items,
  itemOffers,
  deviceModels,
  deviceSites,
  deviceDealers,
  curations,
  curationEntries,
  rehabSites,
  serviceRequests,
} = schema;

export interface ActionState {
  error?: string;
  saved?: boolean;
}

async function requireDb() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function nullable(formData: FormData, name: string): string | null {
  return str(formData, name) || null;
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function intOrNull(formData: FormData, name: string): number | null {
  const n = Number(str(formData, name));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

interface SeoFieldValues {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageKey: string | null;
}

/** 페이지별 SEO 오버라이드 읽기 — 길이 상한과 키 형식을 검증한다. */
function readSeoFields(formData: FormData): { error?: string; values: SeoFieldValues } {
  const seoTitle = nullable(formData, "seoTitle");
  const seoDescription = nullable(formData, "seoDescription");
  const ogImageKey = nullable(formData, "ogImageKey");
  if (seoTitle && seoTitle.length > 70) return { error: "검색·공유 제목은 70자 이하로 쓰세요.", values: { seoTitle, seoDescription, ogImageKey } };
  if (seoDescription && seoDescription.length > 200) return { error: "검색·공유 설명은 200자 이하로 쓰세요.", values: { seoTitle, seoDescription, ogImageKey } };
  if (ogImageKey && !isValidObjectKey(ogImageKey)) return { error: "OG 이미지 키가 올바르지 않습니다.", values: { seoTitle, seoDescription, ogImageKey } };
  return { values: { seoTitle, seoDescription, ogImageKey } };
}

/** 대표 이미지 키 읽기 */
function readImageKey(formData: FormData, name: string): { error?: string; key: string | null } {
  const key = nullable(formData, name);
  if (key && !isValidObjectKey(key)) return { error: "이미지 키가 올바르지 않습니다.", key };
  return { key };
}

/** slug 정규화 + 중복 검사용 기본값 */
function resolveSlug(formData: FormData, fallbackName: string): string {
  const raw = str(formData, "slug");
  return slugify(raw || fallbackName, "item");
}

/** 링크 행 검증 — url 이 http(s) 가 아니면 저장하지 않고 사유를 돌려준다. */
function validateLinkRows(rows: ParsedRow[]): { ok: true; rows: ParsedRow[] } | { ok: false; error: string } {
  const kept: ParsedRow[] = [];
  for (const row of rows) {
    const url = rowString(row, "url");
    if (!url) continue; // 빈 행은 조용히 버린다 (추가만 하고 안 채운 경우)
    if (!isSafeHttpUrl(url)) {
      return { ok: false, error: `링크 주소가 올바르지 않습니다: ${url.slice(0, 60)} (http:// 또는 https:// 로 시작해야 합니다)` };
    }
    kept.push(row);
  }
  return { ok: true, rows: kept };
}

// ============================================================
// 스팟
// ============================================================

async function replaceSpotLinks(db: Awaited<ReturnType<typeof requireDb>>, spotId: number, rows: ParsedRow[]) {
  await db.delete(spotLinks).where(eq(spotLinks.spotId, spotId));
  if (rows.length === 0) return;
  await db.insert(spotLinks).values(
    rows.map((row, i) => ({
      spotId,
      kind: rowString(row, "kind") || "etc",
      url: rowString(row, "url"),
      label: rowString(row, "label") || null,
      sortOrder: i + 1,
    })),
  );
}

// ---------- 돌봄 파트너 서비스 지역 (펫시터·펫산책) ----------

interface ServiceAreaInput {
  regionId: number;
  exposed: boolean;
}

/** ServiceAreasEditor 가 보낸 JSON → 지역 행. 중복·잘못된 id 는 버린다. */
function readServiceAreaRows(formData: FormData): ServiceAreaInput[] {
  const raw = formData.get("serviceAreasJson");
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ServiceAreaInput[] = [];
  for (const row of parsed.slice(0, 100)) {
    if (!row || typeof row !== "object") continue;
    const regionId = Number((row as { regionId?: unknown }).regionId);
    if (!Number.isSafeInteger(regionId) || regionId <= 0 || out.some((r) => r.regionId === regionId)) continue;
    out.push({ regionId, exposed: (row as { exposed?: unknown }).exposed === true });
  }
  return out;
}

/**
 * 돌봄 유형이면 지역 x 유형 자리 상한(MAX_EXPOSED_PER_AREA)을 검사한다.
 * 돌봄 유형이 아니면 빈 목록을 돌려준다(지역 행은 저장 시 지워진다).
 */
async function validateServiceAreas(
  db: Awaited<ReturnType<typeof requireDb>>,
  typeId: number,
  rows: ServiceAreaInput[],
  homeRegionId: number,
  excludeSpotId?: number,
): Promise<{ rows: ServiceAreaInput[]; error?: string }> {
  const type = (await db.select({ slug: spotTypes.slug }).from(spotTypes).where(eq(spotTypes.id, typeId)).limit(1))[0];
  if (!type || !isCareType(type.slug)) return { rows: [] };
  const list = rows.length > 0 ? rows : [{ regionId: homeRegionId, exposed: true }];
  const regionIds = list.map((r) => r.regionId);
  const known = await db.select({ id: regions.id, sidoName: regions.sidoName, sigunguName: regions.sigunguName }).from(regions).where(inArray(regions.id, regionIds));
  const nameById = new Map(known.map((r) => [r.id, `${r.sidoName} ${r.sigunguName}`]));
  for (const r of list) {
    if (!nameById.has(r.regionId)) return { rows: [], error: `알 수 없는 지역 id ${r.regionId}` };
    if (!r.exposed) continue;
    const taken = await countExposedInArea(typeId, r.regionId, excludeSpotId);
    if (taken >= MAX_EXPOSED_PER_AREA) {
      return {
        rows: [],
        error: `${nameById.get(r.regionId)} 의 노출 자리가 찼습니다 (${taken}/${MAX_EXPOSED_PER_AREA}). 이 지역은 노출 OFF 로 저장하거나, 관리자 > 돌봄 파트너에서 다른 파트너의 노출을 끄세요.`,
      };
    }
  }
  return { rows: list };
}

async function writeServiceAreas(db: Awaited<ReturnType<typeof requireDb>>, spotId: number, rows: ServiceAreaInput[]) {
  await db.delete(spotServiceAreas).where(eq(spotServiceAreas.spotId, spotId));
  if (rows.length === 0) return;
  await db.insert(spotServiceAreas).values(rows.map((r, i) => ({ spotId, regionId: r.regionId, exposed: r.exposed, sortOrder: i + 1 })));
}

/** 운동·재활 유형의 "보유 장비" — 고른 기기마다 체험 가능 업체(device_sites.kind='trial') 행을 맞춘다 */
async function writeSpotDevices(db: Awaited<ReturnType<typeof requireDb>>, spotId: number, deviceIds: number[], name: string, regionId: number) {
  const existing = await db.select({ id: deviceSites.id, deviceModelId: deviceSites.deviceModelId }).from(deviceSites).where(and(eq(deviceSites.spotId, spotId), eq(deviceSites.kind, "trial")));
  const keep = new Set(deviceIds);
  const drop = existing.filter((r) => !keep.has(r.deviceModelId)).map((r) => r.id);
  if (drop.length > 0) await db.delete(deviceSites).where(inArray(deviceSites.id, drop));
  const have = new Set(existing.map((r) => r.deviceModelId));
  const add = deviceIds.filter((id) => !have.has(id));
  if (add.length > 0) {
    await db.insert(deviceSites).values(add.map((deviceModelId) => ({ deviceModelId, facilityName: name, regionId, kind: "trial", spotId })));
  }
  // 업체명이 바뀌면 목록 표기도 함께
  if (have.size > 0) await db.update(deviceSites).set({ facilityName: name, regionId, updatedAt: new Date() }).where(and(eq(deviceSites.spotId, spotId), eq(deviceSites.kind, "trial")));
}

/** 폼의 체크박스 묶음 → 정수 배열 */
function intList(formData: FormData, name: string): number[] {
  return [...new Set(formData.getAll(name).map((v) => Number(String(v))).filter((n) => Number.isSafeInteger(n) && n > 0))];
}

export async function createSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();

  const name = str(formData, "name");
  const typeId = intOrNull(formData, "typeId");
  const regionId = intOrNull(formData, "regionId");
  if (name.length < 2) return { error: "업체명을 입력하세요." };
  if (!typeId) return { error: "유형을 선택하세요." };
  if (!regionId) return { error: "지역(시군구)을 선택하세요." };

  const slug = resolveSlug(formData, name);
  const dup = await db.select({ id: spots.id }).from(spots).where(and(eq(spots.slug, slug), eq(spots.regionId, regionId))).limit(1);
  if (dup[0]) return { error: `같은 지역에 동일한 슬러그(${slug})의 스팟이 이미 있습니다.` };

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  const hero = readImageKey(formData, "heroImageKey");
  if (hero.error) return { error: hero.error };
  const areas = await validateServiceAreas(db, typeId, readServiceAreaRows(formData), regionId);
  if (areas.error) return { error: areas.error };

  const inserted = await db
    .insert(spots)
    .values({
      slug,
      name,
      typeId,
      regionId,
      // 인허가에 없는 곳을 직접 확인해 넣는 경로다 (기획서 4-1 "미커버 영역이 곧 경쟁 우위")
      source: "direct",
      status: (str(formData, "status") || "operating") as "operating" | "suspended" | "closed" | "unknown",
      addressRoad: nullable(formData, "addressRoad"),
      phone: nullable(formData, "phone"),
      hoursText: nullable(formData, "hoursText"),
      priceText: nullable(formData, "priceText"),
      parkingText: nullable(formData, "parkingText"),
      descriptionMd: nullable(formData, "descriptionMd"),
      dataReferenceDate: nullable(formData, "dataReferenceDate"),
      heroImageKey: hero.key,
      isHospital: checked(formData, "isHospital"),
      ...seo.values,
    })
    .returning({ id: spots.id });

  const spotId = inserted[0]!.id;
  await replaceSpotLinks(db, spotId, links.rows);
  await writeServiceAreas(db, spotId, areas.rows);
  await writeSpotDevices(db, spotId, intList(formData, "deviceIds"), name, regionId);
  for (const p of await careRelatedPaths(spotId)) revalidatePath(p);

  // 요청함에서 넘어온 등록 — 요청에 스팟을 연결하고 "처리 중"으로 (완료 표시는 운영자가 안내를 마친 뒤 직접)
  const fromRequestId = intOrNull(formData, "fromRequestId");
  if (fromRequestId) {
    const req = (await db.select({ userId: serviceRequests.userId }).from(serviceRequests).where(eq(serviceRequests.id, fromRequestId)).limit(1))[0];
    await db
      .update(serviceRequests)
      .set({ spotId, status: "in_progress", updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, fromRequestId), eq(serviceRequests.status, "new")));
    await db.update(serviceRequests).set({ spotId, updatedAt: new Date() }).where(eq(serviceRequests.id, fromRequestId));
    // 로그인 회원이 보낸 등록 요청이면 그 회원을 소유자로 — /me 에서 바로 관리한다
    if (req?.userId) await db.update(spots).set({ claimedBy: req.userId }).where(eq(spots.id, spotId));
    revalidatePath("/admin/requests");
    revalidatePath("/me/business");
  }

  revalidatePath("/admin/spots");
  revalidatePath("/admin/care");
  redirect(`/admin/spots/${spotId}?created=1`);
}

export async function saveSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(spots).where(eq(spots.id, id)).limit(1))[0];
  if (!existing) return { error: "스팟을 찾을 수 없습니다." };

  const name = str(formData, "name") || existing.name;
  const typeId = intOrNull(formData, "typeId") ?? existing.typeId;

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  const hero = readImageKey(formData, "heroImageKey");
  if (hero.error) return { error: hero.error };
  const areas = await validateServiceAreas(db, typeId, readServiceAreaRows(formData), existing.regionId, id);
  if (areas.error) return { error: areas.error };
  const pathsBefore = await careRelatedPaths(id);

  await db
    .update(spots)
    .set({
      name,
      typeId,
      status: (str(formData, "status") || existing.status) as typeof existing.status,
      addressRoad: nullable(formData, "addressRoad"),
      phone: nullable(formData, "phone"),
      hoursText: nullable(formData, "hoursText"),
      priceText: nullable(formData, "priceText"),
      parkingText: nullable(formData, "parkingText"),
      descriptionMd: nullable(formData, "descriptionMd"),
      heroImageKey: hero.key,
      isHospital: checked(formData, "isHospital"),
      ...seo.values,
      updatedAt: new Date(),
    })
    .where(eq(spots.id, id));

  await replaceSpotLinks(db, id, links.rows);
  await writeServiceAreas(db, id, areas.rows);
  await writeSpotDevices(db, id, intList(formData, "deviceIds"), name, existing.regionId);
  for (const p of new Set([...pathsBefore, ...(await careRelatedPaths(id))])) revalidatePath(p);

  revalidatePath(`/place/${id}-${existing.slug}`);
  revalidatePath(`/admin/spots/${id}`);
  revalidatePath("/admin/spots");
  revalidatePath("/admin/care");
  revalidatePath("/device");
  return { saved: true };
}

// ============================================================
// 메이커
// ============================================================

async function replaceMakerLinks(db: Awaited<ReturnType<typeof requireDb>>, makerId: number, rows: ParsedRow[]) {
  await db.delete(makerLinks).where(eq(makerLinks.makerId, makerId));
  if (rows.length === 0) return;
  await db.insert(makerLinks).values(
    rows.map((row, i) => ({
      makerId,
      kind: rowString(row, "kind") || "etc",
      url: rowString(row, "url"),
      label: rowString(row, "label") || null,
      sortOrder: i + 1,
    })),
  );
}

/** 배지는 사실 진술이므로 기준일 없이 켤 수 없다 (claude.md 7) */
function validateBadges(formData: FormData): string | null {
  const feed = checked(formData, "badgeFeedRegistered");
  const ingredient = checked(formData, "badgeIngredientRegistered");
  const verifiedAt = str(formData, "badgeVerifiedAt");
  if ((feed || ingredient) && !verifiedAt) {
    return "등록 확인 배지를 켜려면 확인 기준일을 입력해야 합니다. 배지는 평가가 아니라 사실 진술이라 기준일을 함께 표기합니다.";
  }
  return null;
}

function makerValues(formData: FormData) {
  return {
    name: str(formData, "name"),
    category: str(formData, "category") || "goods",
    regionId: intOrNull(formData, "regionId"),
    storyMd: nullable(formData, "storyMd"),
    heroImageKey: nullable(formData, "heroImageKey"),
    badgeFeedRegistered: checked(formData, "badgeFeedRegistered"),
    badgeIngredientRegistered: checked(formData, "badgeIngredientRegistered"),
    badgeVerifiedAt: nullable(formData, "badgeVerifiedAt"),
    badgeNote: nullable(formData, "badgeNote"),
    selectionMemo: nullable(formData, "selectionMemo"),
    status: (str(formData, "status") || "draft") as "draft" | "published",
  };
}

export async function createMakerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const values = makerValues(formData);
  if (values.name.length < 2) return { error: "브랜드명을 입력하세요." };

  const badgeError = validateBadges(formData);
  if (badgeError) return { error: badgeError };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  if (values.heroImageKey && !isValidObjectKey(values.heroImageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  const slug = resolveSlug(formData, values.name);
  const dup = await db.select({ id: makers.id }).from(makers).where(eq(makers.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다.` };

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };

  const inserted = await db.insert(makers).values({ ...values, ...seo.values, slug }).returning({ id: makers.id });
  const makerId = inserted[0]!.id;
  await replaceMakerLinks(db, makerId, links.rows);

  revalidatePath("/maker");
  redirect(`/admin/makers/${makerId}?created=1`);
}

export async function saveMakerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(makers).where(eq(makers.id, id)).limit(1))[0];
  if (!existing) return { error: "메이커를 찾을 수 없습니다." };

  const values = makerValues(formData);
  if (values.name.length < 2) return { error: "브랜드명을 입력하세요." };

  const badgeError = validateBadges(formData);
  if (badgeError) return { error: badgeError };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  if (values.heroImageKey && !isValidObjectKey(values.heroImageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };

  await db.update(makers).set({ ...values, ...seo.values, updatedAt: new Date() }).where(eq(makers.id, id));
  await replaceMakerLinks(db, id, links.rows);

  revalidatePath(`/maker/${id}-${existing.slug}`);
  revalidatePath(`/admin/makers/${id}`);
  revalidatePath("/admin/makers");
  revalidatePath("/maker");
  return { saved: true };
}

// ============================================================
// 상품 (구매 링크 — 쿠팡 파트너스 제휴 플래그 포함)
// ============================================================

async function replaceItemOffers(db: Awaited<ReturnType<typeof requireDb>>, itemId: number, rows: ParsedRow[]) {
  await db.delete(itemOffers).where(eq(itemOffers.itemId, itemId));
  if (rows.length === 0) return;
  await db.insert(itemOffers).values(
    rows.map((row, i) => {
      const vendor = rowString(row, "vendor");
      const normalized = vendor === "coupang" || vendor === "brand_store" ? vendor : "other";
      return {
        itemId,
        vendor: normalized as "coupang" | "brand_store" | "other",
        url: rowString(row, "url"),
        // 쿠팡 파트너스는 제휴 링크다 — 켜져 있으면 페이지에 수수료 고지가 자동 노출된다.
        isAffiliate: rowBool(row, "isAffiliate") || normalized === "coupang",
        label: rowString(row, "label") || null,
        sortOrder: i + 1,
      };
    }),
  );
}

function itemValues(formData: FormData) {
  return {
    name: str(formData, "name"),
    category: str(formData, "category") || "toy",
    makerId: intOrNull(formData, "makerId"),
    summary: nullable(formData, "summary"),
    descriptionMd: nullable(formData, "descriptionMd"),
    imageKey: nullable(formData, "imageKey"),
  };
}

export async function createItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const values = itemValues(formData);
  if (values.name.length < 2) return { error: "상품명을 입력하세요." };

  const slug = resolveSlug(formData, values.name);
  const dup = await db.select({ id: items.id }).from(items).where(eq(items.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다.` };

  const offers = validateLinkRows(parseRows(formData, "offersJson"));
  if (!offers.ok) return { error: offers.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  if (values.imageKey && !isValidObjectKey(values.imageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  const inserted = await db.insert(items).values({ ...values, ...seo.values, slug }).returning({ id: items.id });
  const itemId = inserted[0]!.id;
  await replaceItemOffers(db, itemId, offers.rows);

  redirect(`/admin/items/${itemId}?created=1`);
}

export async function saveItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(items).where(eq(items.id, id)).limit(1))[0];
  if (!existing) return { error: "상품을 찾을 수 없습니다." };

  const values = itemValues(formData);
  if (values.name.length < 2) return { error: "상품명을 입력하세요." };

  const offers = validateLinkRows(parseRows(formData, "offersJson"));
  if (!offers.ok) return { error: offers.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };
  if (values.imageKey && !isValidObjectKey(values.imageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  await db.update(items).set({ ...values, ...seo.values, updatedAt: new Date() }).where(eq(items.id, id));
  await replaceItemOffers(db, id, offers.rows);

  revalidatePath(`/item/${id}-${existing.slug}`);
  revalidatePath(`/admin/items/${id}`);
  revalidatePath("/admin/items");
  return { saved: true };
}

// ============================================================
// 치료·진단 기기 (주어는 병원이 아니라 기기 — claude.md 6-2)
// ============================================================

/** 보유 병원 목록 — 무료·순위 없음. 체험 가능 업체(kind='trial')는 스팟 편집기에서 연결하므로 여기서 건드리지 않는다. */
async function replaceDeviceSites(db: Awaited<ReturnType<typeof requireDb>>, deviceModelId: number, rows: ParsedRow[]) {
  await db.delete(deviceSites).where(and(eq(deviceSites.deviceModelId, deviceModelId), eq(deviceSites.kind, "hospital")));
  const kept = rows.filter((r) => rowString(r, "facilityName"));
  if (kept.length === 0) return;
  await db.insert(deviceSites).values(
    kept.map((row) => ({
      deviceModelId,
      facilityName: rowString(row, "facilityName"),
      regionId: Number.isSafeInteger(Number(rowString(row, "regionId"))) && Number(rowString(row, "regionId")) > 0
        ? Number(rowString(row, "regionId"))
        : null,
      verifiedAt: rowString(row, "verifiedAt") || null,
      note: rowString(row, "note") || null,
      kind: "hospital",
    })),
  );
}

/** 대리점·취급처 — 본사가 알려 준 판매·설치 창구 */
async function replaceDeviceDealers(db: Awaited<ReturnType<typeof requireDb>>, deviceModelId: number, rows: ParsedRow[]) {
  await db.delete(deviceDealers).where(eq(deviceDealers.deviceModelId, deviceModelId));
  const kept = rows.filter((r) => rowString(r, "name"));
  if (kept.length === 0) return;
  await db.insert(deviceDealers).values(
    kept.map((row, i) => ({
      deviceModelId,
      name: rowString(row, "name"),
      regionId: Number.isSafeInteger(Number(rowString(row, "regionId"))) && Number(rowString(row, "regionId")) > 0 ? Number(rowString(row, "regionId")) : null,
      url: rowString(row, "url") || null,
      phone: rowString(row, "phone") || null,
      note: rowString(row, "note") || null,
      sortOrder: i + 1,
    })),
  );
}

function validateDealerRows(rows: ParsedRow[]): string | null {
  for (const [i, row] of rows.entries()) {
    const url = rowString(row, "url");
    if (url && !isSafeHttpUrl(url)) return `대리점 ${i + 1}번의 주소가 http/https 형식이 아닙니다.`;
  }
  return null;
}

function deviceValues(formData: FormData): { error: string } | { values: Record<string, unknown> } {
  const makerUrl = nullable(formData, "makerUrl");
  const makerContactUrl = nullable(formData, "makerContactUrl");
  for (const [label, url] of [["본사 사이트", makerUrl], ["본사 문의", makerContactUrl]] as const) {
    if (url && !isSafeHttpUrl(url)) return { error: `${label} 주소가 http/https 형식이 아닙니다.` };
  }
  const image = readImageKey(formData, "imageKey");
  if (image.error) return { error: image.error };
  const featured = intOrNull(formData, "featuredOrder");
  return {
    values: {
      name: str(formData, "name"),
      makerName: nullable(formData, "makerName"),
      category: (str(formData, "category") || "other") as
        | "laser"
        | "stethoscope"
        | "imaging"
        | "monitor"
        | "rehab_equipment"
        | "other",
      summaryMd: nullable(formData, "summaryMd"),
      specsMd: nullable(formData, "specsMd"),
      makerUrl,
      makerContactUrl,
      imageKey: image.key,
      priceText: nullable(formData, "priceText"),
      published: checked(formData, "published"),
      homeUse: checked(formData, "homeUse"),
      featuredOrder: featured && featured > 0 ? featured : null,
    },
  };
}

export async function createDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const parsed = deviceValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const values = parsed.values as { name: string } & Record<string, unknown>;
  if (values.name.length < 2) return { error: "기기명을 입력하세요." };
  const dealerRows = parseRows(formData, "dealersJson");
  const dealerError = validateDealerRows(dealerRows);
  if (dealerError) return { error: dealerError };

  const slug = resolveSlug(formData, values.name);
  const dup = await db.select({ id: deviceModels.id }).from(deviceModels).where(eq(deviceModels.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다.` };

  const inserted = await db.insert(deviceModels).values({ ...(values as typeof deviceModels.$inferInsert), slug }).returning({ id: deviceModels.id });
  const deviceId = inserted[0]!.id;
  await replaceDeviceSites(db, deviceId, parseRows(formData, "sitesJson"));
  await replaceDeviceDealers(db, deviceId, dealerRows);
  revalidatePath("/device");
  revalidatePath(`/device/${encodeURIComponent(slug)}`);

  redirect(`/admin/devices/${deviceId}?created=1`);
}

export async function saveDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(deviceModels).where(eq(deviceModels.id, id)).limit(1))[0];
  if (!existing) return { error: "기기를 찾을 수 없습니다." };

  const parsed = deviceValues(formData);
  if ("error" in parsed) return { error: parsed.error };
  const values = parsed.values as { name: string } & Record<string, unknown>;
  if (values.name.length < 2) return { error: "기기명을 입력하세요." };
  const dealerRows = parseRows(formData, "dealersJson");
  const dealerError = validateDealerRows(dealerRows);
  if (dealerError) return { error: dealerError };

  await db.update(deviceModels).set({ ...(values as Partial<typeof deviceModels.$inferInsert>), updatedAt: new Date() }).where(eq(deviceModels.id, id));
  await replaceDeviceSites(db, id, parseRows(formData, "sitesJson"));
  await replaceDeviceDealers(db, id, dealerRows);
  revalidatePath("/device");
  revalidatePath(`/device/${encodeURIComponent(existing.slug)}`);
  revalidatePath(`/admin/devices/${id}`);
  revalidatePath("/admin/devices");

  return { saved: true };
}

// ============================================================
// 큐레이션 (테마 단위 — 출처 표기 필수, 공식 임베드만)
// ============================================================

const YOUTUBE_ID = /^[\w-]{5,20}$/;

function validateEntries(rows: ParsedRow[]): { ok: true; rows: ParsedRow[] } | { ok: false; error: string } {
  const kept: ParsedRow[] = [];
  for (const [i, row] of rows.entries()) {
    const creator = rowString(row, "creatorName");
    const original = rowString(row, "originalUrl");
    const summary = rowString(row, "summaryMd");
    const source = rowString(row, "embedSource") || "none";
    const ref = rowString(row, "embedRef");

    // 빈 행은 버린다
    if (!creator && !original && !summary && !ref) continue;

    const at = `${i + 1}번 항목: `;
    // 출처 표기는 타협하지 않는다 (기획서 3-4)
    if (!creator) return { ok: false, error: at + "창작자명은 필수입니다." };
    if (!original || !isSafeHttpUrl(original)) return { ok: false, error: at + "원본 링크(http/https)는 필수입니다." };
    // 임베드를 빼도 읽을 가치가 있어야 한다 (기획서 3-3)
    if (!summary) return { ok: false, error: at + "우리 언어로 쓴 요약은 필수입니다. 임베드를 제거해도 읽을 가치가 있어야 합니다." };

    if (source === "youtube") {
      if (!YOUTUBE_ID.test(ref)) return { ok: false, error: at + "유튜브 영상 ID 형식이 올바르지 않습니다." };
    } else if (source === "instagram") {
      if (!/^https:\/\/(www\.)?instagram\.com\//.test(ref)) {
        return { ok: false, error: at + "인스타그램은 공식 게시물 URL(https://www.instagram.com/...)만 사용합니다." };
      }
    } else if (source !== "none") {
      return { ok: false, error: at + "임베드 종류가 올바르지 않습니다." };
    }
    kept.push(row);
  }
  return { ok: true, rows: kept };
}

async function replaceCurationEntries(
  db: Awaited<ReturnType<typeof requireDb>>,
  curationId: number,
  rows: ParsedRow[],
) {
  await db.delete(curationEntries).where(eq(curationEntries.curationId, curationId));
  if (rows.length === 0) return;
  await db.insert(curationEntries).values(
    rows.map((row, i) => {
      const source = (rowString(row, "embedSource") || "none") as "youtube" | "instagram" | "none";
      return {
        curationId,
        sortOrder: i + 1,
        embedSource: source,
        embedRef: source === "none" ? null : rowString(row, "embedRef"),
        creatorName: rowString(row, "creatorName"),
        originalUrl: rowString(row, "originalUrl"),
        summaryMd: rowString(row, "summaryMd"),
      };
    }),
  );
}

export async function createCurationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const title = str(formData, "title");
  if (title.length < 2) return { error: "제목을 입력하세요." };

  const themeSlug = slugify(str(formData, "themeSlug") || title, "theme");
  const dup = await db.select({ id: curations.id }).from(curations).where(eq(curations.themeSlug, themeSlug)).limit(1);
  if (dup[0]) return { error: `테마 슬러그 ${themeSlug} 가 이미 사용 중입니다.` };

  const entries = validateEntries(parseRows(formData, "entriesJson"));
  if (!entries.ok) return { error: entries.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };

  const status = (str(formData, "status") || "draft") as "draft" | "review_pending" | "published" | "archived";
  const inserted = await db
    .insert(curations)
    .values({
      themeSlug,
      title,
      introMd: nullable(formData, "introMd"),
      status,
      publishedAt: status === "published" ? new Date() : null,
      ...seo.values,
    })
    .returning({ id: curations.id });

  const curationId = inserted[0]!.id;
  await replaceCurationEntries(db, curationId, entries.rows);

  revalidatePath("/curation");
  redirect(`/admin/curations/${curationId}?created=1`);
}

export async function saveCurationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(curations).where(eq(curations.id, id)).limit(1))[0];
  if (!existing) return { error: "큐레이션을 찾을 수 없습니다." };

  const title = str(formData, "title");
  if (title.length < 2) return { error: "제목을 입력하세요." };

  const entries = validateEntries(parseRows(formData, "entriesJson"));
  if (!entries.ok) return { error: entries.error };
  const seo = readSeoFields(formData);
  if (seo.error) return { error: seo.error };

  const status = (str(formData, "status") || existing.status) as typeof existing.status;
  await db
    .update(curations)
    .set({
      title,
      introMd: nullable(formData, "introMd"),
      status,
      ...seo.values,
      publishedAt: status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(curations.id, id));

  await replaceCurationEntries(db, id, entries.rows);

  revalidatePath(`/curation/${existing.themeSlug}`);
  revalidatePath(`/admin/curations/${id}`);
  revalidatePath("/admin/curations");
  revalidatePath("/curation");
  return { saved: true };
}

// ============================================================
// 재활·한방·특수치료 시행처 (claude.md 6-2)
// 주어는 치료법. 순위·추천·평점을 만들지 않는다 — 확인 수준(internal_level)은 관리 화면 전용이고
// 공개 쿼리(lib/queries/rehab.ts)는 그 컬럼을 select 하지 않는다.
// ============================================================

type RehabStatus = "operating" | "suspended" | "closed" | "unknown";
const REHAB_STATUS_VALUES: readonly RehabStatus[] = ["operating", "suspended", "closed", "unknown"];
const REHAB_LEVEL_VALUES = ["A", "B", "C"] as const;

function rehabValues(formData: FormData) {
  const modalities = REHAB_MODALITIES.map((m) => m.slug).filter((slug) => checked(formData, `modality:${slug}`));
  const statusRaw = str(formData, "status");
  const levelRaw = str(formData, "internalLevel");
  return {
    name: str(formData, "name"),
    regionId: intOrNull(formData, "regionId"),
    address: nullable(formData, "address"),
    phone: nullable(formData, "phone"),
    status: (REHAB_STATUS_VALUES as readonly string[]).includes(statusRaw) ? (statusRaw as RehabStatus) : "unknown",
    modalities,
    sourceLabel: nullable(formData, "sourceLabel"),
    evidenceNote: nullable(formData, "evidenceNote"),
    internalLevel: (REHAB_LEVEL_VALUES as readonly string[]).includes(levelRaw) ? levelRaw : null,
    internalNote: nullable(formData, "internalNote"),
    verifiedAt: nullable(formData, "verifiedAt"),
    published: checked(formData, "published"),
  };
}

function validateRehab(v: ReturnType<typeof rehabValues>): string | null {
  if (v.name.length < 2) return "병원명을 입력하세요.";
  if (!v.regionId) return "지역(시군구)을 선택하세요.";
  if (v.modalities.length === 0) return "치료법을 하나 이상 고르세요. 치료법 없는 병원 목록은 만들지 않습니다 (규칙 6-2).";
  if (/(추천|최고|최상|1위|베스트|유명|잘하는)/.test(`${v.evidenceNote ?? ""} ${v.sourceLabel ?? ""}`)) {
    return "공개 근거에는 평가·순위 표현(추천·최고·1위 등)을 쓸 수 없습니다. 사실(시행·보유·등재)만 적으세요.";
  }
  if (v.published && !v.sourceLabel) return "게시하려면 근거 출처(예: 병원 공식 안내, CVA 공식 지도)를 적어야 합니다.";
  return null;
}

function revalidateRehab() {
  revalidatePath("/rehab");
  for (const m of REHAB_MODALITIES) revalidatePath(`/rehab/${m.slug}`);
  revalidatePath("/admin/rehab");
}

export async function createRehabSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const values = rehabValues(formData);
  const error = validateRehab(values);
  if (error) return { error };
  const externalRef = nullable(formData, "externalRef");
  if (externalRef) {
    const dup = await db.select({ id: rehabSites.id }).from(rehabSites).where(eq(rehabSites.externalRef, externalRef)).limit(1);
    if (dup[0]) return { error: `외부키 ${externalRef} 는 이미 있습니다 (#${dup[0].id}).` };
  }
  const inserted = await db
    .insert(rehabSites)
    .values({ ...values, regionId: values.regionId!, externalRef })
    .returning({ id: rehabSites.id });
  revalidateRehab();
  redirect(`/admin/rehab/${inserted[0]!.id}?created=1`);
}

export async function saveRehabSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };
  const existing = (await db.select({ id: rehabSites.id }).from(rehabSites).where(eq(rehabSites.id, id)).limit(1))[0];
  if (!existing) return { error: "시행처를 찾을 수 없습니다." };
  const values = rehabValues(formData);
  const error = validateRehab(values);
  if (error) return { error };
  await db
    .update(rehabSites)
    .set({ ...values, regionId: values.regionId!, updatedAt: new Date() })
    .where(eq(rehabSites.id, id));
  revalidateRehab();
  revalidatePath(`/admin/rehab/${id}`);
  return { saved: true };
}

export async function deleteRehabSiteAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return;
  await db.delete(rehabSites).where(eq(rehabSites.id, id));
  revalidateRehab();
  redirect("/admin/rehab?deleted=1");
}
