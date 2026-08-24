"use server";

// 디렉토리 등록·편집 서버 액션 — 스팟 / 메이커 / 상품 / 기기 / 큐레이션.
// 인증은 lib/auth.ts 만 거친다. 규칙(배지 기준일, 큐레이션 출처 표기, 장묘 무광고)은
// DB 제약 이전에 여기서 사람이 읽을 수 있는 메시지로 막는다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSafeHttpUrl } from "@/lib/links";
import { parseRows, rowBool, rowString, type ParsedRow } from "./_components/parse-rows";

const {
  spots,
  spotLinks,
  makers,
  makerLinks,
  items,
  itemOffers,
  deviceModels,
  deviceSites,
  curations,
  curationEntries,
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
    })
    .returning({ id: spots.id });

  const spotId = inserted[0]!.id;
  await replaceSpotLinks(db, spotId, links.rows);

  revalidatePath("/admin/spots");
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
      updatedAt: new Date(),
    })
    .where(eq(spots.id, id));

  await replaceSpotLinks(db, id, links.rows);

  revalidatePath(`/place/${id}-${existing.slug}`);
  revalidatePath("/admin/spots");
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

  const slug = resolveSlug(formData, values.name);
  const dup = await db.select({ id: makers.id }).from(makers).where(eq(makers.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다.` };

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };

  const inserted = await db.insert(makers).values({ ...values, slug }).returning({ id: makers.id });
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

  const links = validateLinkRows(parseRows(formData, "linksJson"));
  if (!links.ok) return { error: links.error };

  await db.update(makers).set({ ...values, updatedAt: new Date() }).where(eq(makers.id, id));
  await replaceMakerLinks(db, id, links.rows);

  revalidatePath(`/maker/${id}-${existing.slug}`);
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

  const inserted = await db.insert(items).values({ ...values, slug }).returning({ id: items.id });
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

  await db.update(items).set({ ...values, updatedAt: new Date() }).where(eq(items.id, id));
  await replaceItemOffers(db, id, offers.rows);

  revalidatePath(`/item/${id}-${existing.slug}`);
  return { saved: true };
}

// ============================================================
// 치료·진단 기기 (주어는 병원이 아니라 기기 — claude.md 6-2)
// ============================================================

async function replaceDeviceSites(db: Awaited<ReturnType<typeof requireDb>>, deviceModelId: number, rows: ParsedRow[]) {
  await db.delete(deviceSites).where(eq(deviceSites.deviceModelId, deviceModelId));
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
    })),
  );
}

function deviceValues(formData: FormData) {
  return {
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
  };
}

export async function createDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const values = deviceValues(formData);
  if (values.name.length < 2) return { error: "기기명을 입력하세요." };

  const slug = resolveSlug(formData, values.name);
  const dup = await db.select({ id: deviceModels.id }).from(deviceModels).where(eq(deviceModels.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다.` };

  const inserted = await db.insert(deviceModels).values({ ...values, slug }).returning({ id: deviceModels.id });
  const deviceId = inserted[0]!.id;
  await replaceDeviceSites(db, deviceId, parseRows(formData, "sitesJson"));

  redirect(`/admin/devices/${deviceId}?created=1`);
}

export async function saveDeviceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };

  const existing = (await db.select().from(deviceModels).where(eq(deviceModels.id, id)).limit(1))[0];
  if (!existing) return { error: "기기를 찾을 수 없습니다." };

  const values = deviceValues(formData);
  if (values.name.length < 2) return { error: "기기명을 입력하세요." };

  await db.update(deviceModels).set({ ...values, updatedAt: new Date() }).where(eq(deviceModels.id, id));
  await replaceDeviceSites(db, id, parseRows(formData, "sitesJson"));

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

  const status = (str(formData, "status") || "draft") as "draft" | "review_pending" | "published" | "archived";
  const inserted = await db
    .insert(curations)
    .values({
      themeSlug,
      title,
      introMd: nullable(formData, "introMd"),
      status,
      publishedAt: status === "published" ? new Date() : null,
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

  const status = (str(formData, "status") || existing.status) as typeof existing.status;
  await db
    .update(curations)
    .set({
      title,
      introMd: nullable(formData, "introMd"),
      status,
      publishedAt: status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(curations.id, id));

  await replaceCurationEntries(db, id, entries.rows);

  revalidatePath(`/curation/${existing.themeSlug}`);
  revalidatePath("/curation");
  return { saved: true };
}
