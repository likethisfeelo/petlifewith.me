"use server";

// 소유자(회원) 편집 액션 — 소유 확인된 업체(spots.claimed_by)·브랜드(makers.claimed_by)와 그 브랜드의 상품.
// 관리자 편집기와 같은 검증(링크 http/https, 이미지 키)을 쓰되 범위는 좁다: 이름·유형·지역·주소는 요청함으로만 바꾼다.
// 브랜드 공개(status) 는 관리자만. 상품은 브랜드가 공개 상태면 저장 즉시 보인다. 쿠팡 제휴 링크는 운영자만 단다.
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { isValidObjectKey } from "@/lib/assets";
import { idSlugPath } from "@/lib/format";
import { MAKER_LINK_KINDS, SPOT_LINK_KINDS, isSafeHttpUrl } from "@/lib/links";
import { getCurrentMember } from "@/lib/member";
import { careRelatedPaths } from "@/lib/revalidate-paths";
import { parseRows, rowString, type ParsedRow } from "./admin/_components/parse-rows";

const { spots, spotLinks, makers, makerLinks, items, itemOffers, guideItemTags } = schema;

export interface OwnerActionState {
  error?: string;
  saved?: boolean;
}

const LIMITS = { text: 120, description: 4000, name: 80, summary: 200, links: 10, offers: 6, itemsPerMaker: 50 } as const;
const ITEM_CATEGORIES = ["toy", "treat", "supplement", "tool", "gear"] as const;
const SPOT_STATUSES = ["operating", "suspended", "closed"] as const;
const OWNER_OFFER_VENDORS = ["brand_store", "other"] as const;

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}
function nullable(formData: FormData, name: string, max: number): string | null | { error: string } {
  const v = str(formData, name);
  if (!v) return null;
  if (v.length > max) return { error: `${max}자 이내로 적어 주세요.` };
  return v;
}
function intOrNull(formData: FormData, name: string): number | null {
  const n = Number(str(formData, name));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function validateLinks(rows: ParsedRow[], kinds: readonly string[]): { ok: true; rows: ParsedRow[] } | { ok: false; error: string } {
  const kept: ParsedRow[] = [];
  for (const row of rows) {
    const url = rowString(row, "url");
    if (!url) continue;
    if (!isSafeHttpUrl(url)) return { ok: false, error: `링크 주소가 올바르지 않습니다: ${url.slice(0, 60)} (http:// 또는 https:// 로 시작해야 합니다)` };
    if (!kinds.includes(rowString(row, "kind"))) return { ok: false, error: "링크 종류를 골라 주세요." };
    kept.push(row);
  }
  if (kept.length > LIMITS.links) return { ok: false, error: `링크는 ${LIMITS.links}개까지입니다.` };
  return { ok: true, rows: kept };
}

async function requireMemberDb() {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme%2Fbusiness");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return { member, db: getDb() };
}

// ---------- 업체 ----------

export async function saveOwnedSpotAction(_prev: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { member, db } = await requireMemberDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };
  const existing = (await db.select().from(spots).where(and(eq(spots.id, id), eq(spots.claimedBy, member.id))).limit(1))[0];
  if (!existing) return { error: "내 업체가 아닙니다." };

  const status = str(formData, "status");
  if (!(SPOT_STATUSES as readonly string[]).includes(status)) return { error: "영업 상태를 골라 주세요." };
  const fields: Record<string, string | null> = {};
  for (const [name, max] of [["phone", 40], ["hoursText", LIMITS.text], ["priceText", LIMITS.text], ["parkingText", LIMITS.text], ["descriptionMd", LIMITS.description]] as const) {
    const v = nullable(formData, name, max);
    if (v && typeof v === "object") return { error: `${name === "descriptionMd" ? "소개" : "항목"}은(는) ${v.error}` };
    fields[name] = v;
  }
  const heroImageKey = str(formData, "heroImageKey") || null;
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "대표 이미지가 올바르지 않습니다." };
  const links = validateLinks(parseRows(formData, "linksJson"), SPOT_LINK_KINDS.map((k) => k.kind));
  if (!links.ok) return { error: links.error };

  await db
    .update(spots)
    .set({
      status: status as (typeof SPOT_STATUSES)[number],
      phone: fields.phone,
      hoursText: fields.hoursText,
      priceText: fields.priceText,
      parkingText: fields.parkingText,
      descriptionMd: fields.descriptionMd,
      heroImageKey,
      updatedAt: new Date(),
    })
    .where(eq(spots.id, id));
  await db.delete(spotLinks).where(eq(spotLinks.spotId, id));
  if (links.rows.length > 0) {
    await db.insert(spotLinks).values(links.rows.map((row, i) => ({ spotId: id, kind: rowString(row, "kind") || "etc", url: rowString(row, "url"), label: rowString(row, "label") || null, sortOrder: i + 1 })));
  }
  revalidatePath(idSlugPath("place", id, existing.slug));
  for (const p of await careRelatedPaths(id)) revalidatePath(p);
  revalidatePath("/me/business");
  return { saved: true };
}

// ---------- 브랜드 ----------

export async function saveOwnedMakerAction(_prev: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { member, db } = await requireMemberDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };
  const existing = (await db.select().from(makers).where(and(eq(makers.id, id), eq(makers.claimedBy, member.id))).limit(1))[0];
  if (!existing) return { error: "내 브랜드가 아닙니다." };
  const story = nullable(formData, "storyMd", LIMITS.description);
  if (story && typeof story === "object") return { error: `소개는 ${story.error}` };
  const heroImageKey = str(formData, "heroImageKey") || null;
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "대표 이미지가 올바르지 않습니다." };
  const links = validateLinks(parseRows(formData, "linksJson"), MAKER_LINK_KINDS.map((k) => k.kind));
  if (!links.ok) return { error: links.error };

  await db.update(makers).set({ storyMd: story, heroImageKey, updatedAt: new Date() }).where(eq(makers.id, id));
  await db.delete(makerLinks).where(eq(makerLinks.makerId, id));
  if (links.rows.length > 0) {
    await db.insert(makerLinks).values(links.rows.map((row, i) => ({ makerId: id, kind: rowString(row, "kind") || "etc", url: rowString(row, "url"), label: rowString(row, "label") || null, sortOrder: i + 1 })));
  }
  revalidatePath(idSlugPath("maker", id, existing.slug));
  revalidatePath("/me/business");
  return { saved: true };
}

// ---------- 상품 ----------

function readItemInput(formData: FormData): { error?: string; values?: { name: string; category: (typeof ITEM_CATEGORIES)[number]; summary: string | null; descriptionMd: string | null; imageKey: string | null } } {
  const name = str(formData, "name");
  if (name.length < 2 || name.length > LIMITS.name) return { error: `상품명을 2~${LIMITS.name}자로 적어 주세요.` };
  const category = str(formData, "category");
  if (!(ITEM_CATEGORIES as readonly string[]).includes(category)) return { error: "분류를 골라 주세요." };
  const summary = nullable(formData, "summary", LIMITS.summary);
  if (summary && typeof summary === "object") return { error: `한 줄 소개는 ${summary.error}` };
  const descriptionMd = nullable(formData, "descriptionMd", LIMITS.description);
  if (descriptionMd && typeof descriptionMd === "object") return { error: `설명은 ${descriptionMd.error}` };
  const imageKey = str(formData, "imageKey") || null;
  if (imageKey && !isValidObjectKey(imageKey)) return { error: "이미지가 올바르지 않습니다." };
  return { values: { name, category: category as (typeof ITEM_CATEGORIES)[number], summary, descriptionMd, imageKey } };
}

function validateOffers(rows: ParsedRow[]): { ok: true; rows: ParsedRow[] } | { ok: false; error: string } {
  const kept: ParsedRow[] = [];
  for (const row of rows) {
    const url = rowString(row, "url");
    if (!url) continue;
    if (!isSafeHttpUrl(url)) return { ok: false, error: `구매 링크가 올바르지 않습니다: ${url.slice(0, 60)}` };
    if (!(OWNER_OFFER_VENDORS as readonly string[]).includes(rowString(row, "vendor"))) return { ok: false, error: "구매처는 자사몰·스토어 또는 기타만 고를 수 있어요. 쿠팡 링크는 운영자가 답니다." };
    kept.push(row);
  }
  if (kept.length > LIMITS.offers) return { ok: false, error: `구매 링크는 ${LIMITS.offers}개까지입니다.` };
  return { ok: true, rows: kept };
}

async function replaceOwnerOffers(db: ReturnType<typeof getDb>, itemId: number, rows: ParsedRow[]) {
  // 운영자가 단 쿠팡 제휴 링크는 남긴다 — 소유자는 자사몰·기타만 만진다
  await db.delete(itemOffers).where(and(eq(itemOffers.itemId, itemId), sql`${itemOffers.vendor} <> 'coupang'`));
  if (rows.length === 0) return;
  await db.insert(itemOffers).values(
    rows.map((row, i) => ({ itemId, vendor: rowString(row, "vendor") as "brand_store" | "other", url: rowString(row, "url"), label: rowString(row, "label") || null, isAffiliate: false, sortOrder: 10 + i })),
  );
}

export async function createOwnedItemAction(_prev: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { member, db } = await requireMemberDb();
  const makerId = intOrNull(formData, "makerId");
  if (!makerId) return { error: "잘못된 요청" };
  const maker = (await db.select({ id: makers.id }).from(makers).where(and(eq(makers.id, makerId), eq(makers.claimedBy, member.id))).limit(1))[0];
  if (!maker) return { error: "내 브랜드가 아닙니다." };
  const count = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(items).where(eq(items.makerId, makerId)))[0]?.n ?? 0;
  if (count >= LIMITS.itemsPerMaker) return { error: `브랜드당 상품은 ${LIMITS.itemsPerMaker}개까지입니다.` };
  const input = readItemInput(formData);
  if (input.error || !input.values) return { error: input.error ?? "입력을 확인해 주세요." };
  const offers = validateOffers(parseRows(formData, "offersJson"));
  if (!offers.ok) return { error: offers.error };

  const base = slugify(input.values.name, "item").slice(0, 40);
  let itemId = 0;
  for (let attempt = 0; attempt < 3 && !itemId; attempt++) {
    const slug = `${base}-${randomInt(36 ** 4).toString(36).padStart(4, "0")}`;
    try {
      const inserted = await db.insert(items).values({ ...input.values, slug, makerId }).returning({ id: items.id });
      itemId = inserted[0]!.id;
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23505") throw e;
    }
  }
  if (!itemId) return { error: "잠시 후 다시 시도해 주세요." };
  await replaceOwnerOffers(db, itemId, offers.rows);
  revalidatePath("/me/business");
  redirect(`/me/business/maker/${makerId}?item=${itemId}`);
}

export async function saveOwnedItemAction(_prev: OwnerActionState, formData: FormData): Promise<OwnerActionState> {
  const { member, db } = await requireMemberDb();
  const id = intOrNull(formData, "id");
  if (!id) return { error: "잘못된 요청" };
  const row = (await db.select({ item: items, makerId: makers.id }).from(items).innerJoin(makers, eq(items.makerId, makers.id)).where(and(eq(items.id, id), eq(makers.claimedBy, member.id))).limit(1))[0];
  if (!row) return { error: "내 상품이 아닙니다." };
  const input = readItemInput(formData);
  if (input.error || !input.values) return { error: input.error ?? "입력을 확인해 주세요." };
  const offers = validateOffers(parseRows(formData, "offersJson"));
  if (!offers.ok) return { error: offers.error };
  await db.update(items).set({ ...input.values, updatedAt: new Date() }).where(eq(items.id, id));
  await replaceOwnerOffers(db, id, offers.rows);
  revalidatePath(idSlugPath("item", id, row.item.slug));
  revalidatePath("/me/business");
  return { saved: true };
}

/** 삭제 — 아직 어느 글에도 연결되지 않은 상품만 (다른 회원 글의 태그를 끊지 않는다) */
export async function deleteOwnedItemAction(formData: FormData): Promise<void> {
  const { member, db } = await requireMemberDb();
  const id = intOrNull(formData, "id");
  if (!id) return;
  const row = (await db.select({ id: items.id, makerId: makers.id }).from(items).innerJoin(makers, eq(items.makerId, makers.id)).where(and(eq(items.id, id), eq(makers.claimedBy, member.id))).limit(1))[0];
  if (!row) return;
  const tagged = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(guideItemTags).where(eq(guideItemTags.itemId, id)))[0]?.n ?? 0;
  if (tagged > 0) return;
  await db.delete(items).where(eq(items.id, id));
  revalidatePath("/me/business");
  redirect(`/me/business/maker/${row.makerId}?deleted=1`);
}
