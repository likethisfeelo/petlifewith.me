"use server";

// 업체 링크 페이지 편집 — 관리자와 사장님(spots.claimed_by)이 같이 쓴다.
//  - 관리자: 페이지 만들기·공개·삭제, 유료 기간(paid_from~paid_until, 상단 노출과 별개), 짧은 주소, 소유자 지정(이메일)
//  - 사장님: 소개·주요 서비스. 유료 기간 중에는 짧은 주소와 사진·영상(종류별 10개)도
// 규칙은 lib/spot-pages.ts (짧은 주소 검사·유료 판정).
import { revalidatePath } from "@/lib/cdn";
import { and, asc, count, eq, max, ne } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCurrentMember } from "@/lib/member";
import { isValidObjectKey } from "@/lib/assets";
import { spotPageRelatedPaths } from "@/lib/revalidate-paths";
import { SPOT_MEDIA_LIMIT, isPaidActive, parseServices, validateHandle } from "@/lib/spot-pages";

const { spots, spotTypes, spotPages, spotMedia, mediaAssets, users } = schema;

export interface SpotPageActionState {
  error?: string;
  saved?: boolean;
}

type Actor = { admin: true; userId: null } | { admin: false; userId: string };

const INTRO_MAX = 600;

/** 관리자 세션이면 관리자, 아니면 그 업체의 소유 회원만 */
async function authorize(spotId: number): Promise<{ actor: Actor; db: ReturnType<typeof getDb>; monetizable: boolean } | null> {
  if (!isDbConfigured()) return null;
  const db = getDb();
  const row = (
    await db
      .select({ claimedBy: spots.claimedBy, monetizable: spotTypes.monetizable })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row) return null;
  if (await getSession()) return { actor: { admin: true, userId: null }, db, monetizable: row.monetizable };
  const member = await getCurrentMember();
  if (member && row.claimedBy === member.id) return { actor: { admin: false, userId: member.id }, db, monetizable: row.monetizable };
  return null;
}

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function dateOrNull(v: string): string | null | "invalid" {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : "invalid";
}

async function refresh(spotId: number, oldHandle?: string | null) {
  for (const p of await spotPageRelatedPaths(spotId, [oldHandle])) revalidatePath(p);
  revalidatePath(`/admin/spots/${spotId}`);
  revalidatePath(`/me/business/spot/${spotId}`);
  revalidatePath("/me/business");
}

export async function saveSpotPageAction(_prev: SpotPageActionState, formData: FormData): Promise<SpotPageActionState> {
  const spotId = Number(str(formData, "spotId"));
  if (!Number.isSafeInteger(spotId) || spotId <= 0) return { error: "잘못된 요청" };
  const auth = await authorize(spotId);
  if (!auth) return { error: "권한이 없습니다." };
  const { actor, db, monetizable } = auth;
  const existing = (await db.select().from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0] ?? null;
  if (!existing && !actor.admin) return { error: "링크 페이지가 아직 없습니다. 운영자에게 문의해 주세요." };

  const intro = str(formData, "intro");
  if (intro.length > INTRO_MAX) return { error: `소개는 ${INTRO_MAX}자 이내로 적어 주세요.` };
  const services = parseServices(str(formData, "services"));

  const values: Partial<typeof spotPages.$inferInsert> = { intro: intro || null, services, updatedAt: new Date() };

  // 짧은 주소 — 사장님은 유료 기간 중에만 (관리자는 유료 상품 칸 savePremiumAction 에서)
  const canHandle = !actor.admin && monetizable && isPaidActive(existing);
  if (canHandle && formData.has("handle")) {
    const raw = str(formData, "handle");
    if (!raw) values.handle = null;
    else {
      const v = validateHandle(raw);
      if (!v.ok) return { error: v.error };
      const taken = (await db.select({ id: spotPages.spotId }).from(spotPages).where(and(eq(spotPages.handle, v.handle), ne(spotPages.spotId, spotId))).limit(1))[0];
      if (taken) return { error: "이미 다른 업체가 쓰는 짧은 주소입니다." };
      values.handle = v.handle;
    }
  }

  if (actor.admin) {
    values.published = formData.get("published") === "on";
    // 소유자 지정 — 이메일로 회원을 찾는다. 비우면 그대로 (해제는 소유자 칸의 "해제")
    const ownerEmail = str(formData, "ownerEmail").toLowerCase();
    if (ownerEmail) {
      const user = (await db.select({ id: users.id }).from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
      if (!user) return { error: `${ownerEmail} 로 가입한 회원을 찾을 수 없습니다. 먼저 회원가입을 안내해 주세요.` };
      await db.update(spots).set({ claimedBy: user.id, updatedAt: new Date() }).where(eq(spots.id, spotId));
    }
  }

  if (existing) await db.update(spotPages).set(values).where(eq(spotPages.spotId, spotId));
  else await db.insert(spotPages).values({ spotId, ...values });

  await refresh(spotId, existing?.handle);
  return { saved: true };
}

// ---------- 유료 상품 (관리자) ----------

async function handleOrError(db: ReturnType<typeof getDb>, spotId: number, raw: string): Promise<{ handle: string | null } | { error: string }> {
  if (!raw) return { handle: null };
  const v = validateHandle(raw);
  if (!v.ok) return { error: v.error };
  const taken = (await db.select({ id: spotPages.spotId }).from(spotPages).where(and(eq(spotPages.handle, v.handle), ne(spotPages.spotId, spotId))).limit(1))[0];
  if (taken) return { error: "이미 다른 업체가 쓰는 짧은 주소입니다." };
  return { handle: v.handle };
}

/** 프리미엄 링크 페이지 기간·짧은 주소 — 지역 상단 노출과 별개 상품. 페이지가 없으면 함께 만든다 */
export async function savePremiumAction(_prev: SpotPageActionState, formData: FormData): Promise<SpotPageActionState> {
  const spotId = Number(str(formData, "spotId"));
  if (!Number.isSafeInteger(spotId) || spotId <= 0) return { error: "업체 번호를 확인해 주세요." };
  const auth = await authorize(spotId);
  if (!auth) return { error: "업체를 찾을 수 없습니다." };
  if (!auth.actor.admin) return { error: "권한이 없습니다." };
  const { db, monetizable } = auth;
  if (!monetizable) return { error: "장묘·동물약국·B2B 유형은 프리미엄을 켤 수 없습니다." };
  const from = dateOrNull(str(formData, "paidFrom"));
  const until = dateOrNull(str(formData, "paidUntil"));
  if (from === "invalid" || until === "invalid" || !from || !until) return { error: "시작일과 종료일을 모두 골라 주세요." };
  if (from > until) return { error: "종료일이 시작일보다 빠릅니다." };
  const h = await handleOrError(db, spotId, str(formData, "handle"));
  if ("error" in h) return { error: h.error };
  const existing = (await db.select({ handle: spotPages.handle }).from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0];
  const values = { paidFrom: from, paidUntil: until, handle: h.handle, updatedAt: new Date() };
  if (existing) await db.update(spotPages).set(values).where(eq(spotPages.spotId, spotId));
  else await db.insert(spotPages).values({ spotId, published: true, ...values });
  await refresh(spotId, existing?.handle);
  revalidatePath("/admin/paid");
  return { saved: true };
}

/** 프리미엄 끝내기 — 기간만 지운다 (짧은 주소·사진은 남고, 공개 페이지는 무료 디자인으로) */
export async function endPremiumAction(formData: FormData): Promise<void> {
  const spotId = Number(formData.get("spotId"));
  if (!Number.isSafeInteger(spotId) || spotId <= 0) return;
  const auth = await authorize(spotId);
  if (!auth?.actor.admin) return;
  await auth.db.update(spotPages).set({ paidFrom: null, paidUntil: null, updatedAt: new Date() }).where(eq(spotPages.spotId, spotId));
  await refresh(spotId);
  revalidatePath("/admin/paid");
}

/** 관리자: 링크 페이지 삭제 (사진·영상 연결도 함께 — 자산 파일은 미디어 관리에 남는다) */
export async function deleteSpotPageAction(formData: FormData): Promise<void> {
  const spotId = Number(formData.get("spotId"));
  if (!Number.isSafeInteger(spotId) || spotId <= 0) return;
  const auth = await authorize(spotId);
  if (!auth?.actor.admin) return;
  const old = (await auth.db.select({ handle: spotPages.handle }).from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0];
  await auth.db.delete(spotMedia).where(eq(spotMedia.spotId, spotId));
  await auth.db.delete(spotPages).where(eq(spotPages.spotId, spotId));
  await refresh(spotId, old?.handle);
}

// ---------- 사진·영상 (유료) ----------

async function authorizeMedia(spotId: number) {
  const auth = await authorize(spotId);
  if (!auth) return { error: "권한이 없습니다." } as const;
  const page = (await auth.db.select().from(spotPages).where(eq(spotPages.spotId, spotId)).limit(1))[0];
  if (!page) return { error: "링크 페이지를 먼저 만들어 주세요." } as const;
  // 관리자는 유료 기간 전에도 미리 올려 둘 수 있다 (공개 페이지에는 유료 기간에만 보인다)
  if (!auth.actor.admin && !(auth.monetizable && isPaidActive(page))) return { error: "사진·영상은 프리미엄(유료) 페이지에서 올릴 수 있습니다." } as const;
  return { ...auth, page } as const;
}

export async function addSpotMediaAction(input: { spotId: number; objectKey: string }): Promise<{ error?: string }> {
  const auth = await authorizeMedia(input.spotId);
  if ("error" in auth) return { error: auth.error };
  const { db, actor } = auth;
  if (!isValidObjectKey(input.objectKey)) return { error: "파일 키가 올바르지 않습니다." };
  const conds = [eq(mediaAssets.objectKey, input.objectKey)];
  if (actor.userId) conds.push(eq(mediaAssets.uploaderUserId, actor.userId));
  const asset = (await db.select({ id: mediaAssets.id, kind: mediaAssets.kind }).from(mediaAssets).where(and(...conds)).limit(1))[0];
  if (!asset) return { error: "올린 파일을 찾을 수 없습니다." };

  const n = (await db
    .select({ n: count() })
    .from(spotMedia)
    .innerJoin(mediaAssets, eq(spotMedia.assetId, mediaAssets.id))
    .where(and(eq(spotMedia.spotId, input.spotId), eq(mediaAssets.kind, asset.kind))))[0]?.n ?? 0;
  if (n >= SPOT_MEDIA_LIMIT) return { error: `${asset.kind === "image" ? "사진" : "영상"}은 ${SPOT_MEDIA_LIMIT}개까지 올릴 수 있습니다.` };
  const top = (await db.select({ top: max(spotMedia.sortOrder) }).from(spotMedia).where(eq(spotMedia.spotId, input.spotId)))[0]?.top;
  await db
    .insert(spotMedia)
    .values({ spotId: input.spotId, assetId: asset.id, sortOrder: (top ?? 0) + 1 })
    .onConflictDoNothing();
  await refresh(input.spotId);
  return {};
}

export async function removeSpotMediaAction(input: { spotId: number; id: number }): Promise<{ error?: string }> {
  const auth = await authorizeMedia(input.spotId);
  if ("error" in auth) return { error: auth.error };
  await auth.db.delete(spotMedia).where(and(eq(spotMedia.id, input.id), eq(spotMedia.spotId, input.spotId)));
  await refresh(input.spotId);
  return {};
}

/** 순서 바꾸기 — 같은 종류 안에서 한 칸 앞/뒤 */
export async function moveSpotMediaAction(input: { spotId: number; id: number; dir: -1 | 1 }): Promise<{ error?: string }> {
  const auth = await authorizeMedia(input.spotId);
  if ("error" in auth) return { error: auth.error };
  const { db } = auth;
  const rows = await db
    .select({ id: spotMedia.id, kind: mediaAssets.kind, sortOrder: spotMedia.sortOrder })
    .from(spotMedia)
    .innerJoin(mediaAssets, eq(spotMedia.assetId, mediaAssets.id))
    .where(eq(spotMedia.spotId, input.spotId))
    .orderBy(asc(spotMedia.sortOrder), asc(spotMedia.id));
  const me = rows.find((r) => r.id === input.id);
  if (!me) return {};
  const same = rows.filter((r) => r.kind === me.kind);
  const i = same.indexOf(me);
  const other = same[i + input.dir];
  if (!other) return {};
  // 정렬값이 겹쳐 있을 수 있어 같은 종류 전체를 다시 매긴다
  [same[i], same[i + input.dir]] = [other, me];
  await db.transaction(async (tx) => {
    for (const [n, r] of same.entries()) await tx.update(spotMedia).set({ sortOrder: n + 1 }).where(eq(spotMedia.id, r.id));
  });
  await refresh(input.spotId);
  return {};
}
