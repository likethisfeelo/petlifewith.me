"use server";

// 요청함 처리 액션 — /admin/requests. 상태 바꾸기·메모·입금 확인·업체 연결.
// "처리"의 실체는 다른 화면에서 일어난다(스팟 등록·편집·상단 노출 토글) — 여기서는 요청의 상태만 기록한다.
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests";
import { spotPageRelatedPaths } from "@/lib/revalidate-paths";
import { ensureSpotPage } from "@/lib/spot-page-write";

const { serviceRequests, spots, makers } = schema;

async function requireDb() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

function requestId(formData: FormData): number | null {
  const id = Number(formData.get("id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function setRequestStatusAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = requestId(formData);
  const status = String(formData.get("status") ?? "");
  if (!id || !(REQUEST_STATUSES as readonly string[]).includes(status)) return;
  const closed = status === "done" || status === "rejected";
  await db
    .update(serviceRequests)
    .set({ status: status as RequestStatus, handledAt: closed ? new Date() : null, updatedAt: new Date() })
    .where(eq(serviceRequests.id, id));
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
}

export async function saveRequestNoteAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = requestId(formData);
  if (!id) return;
  const note = String(formData.get("adminNote") ?? "").trim().slice(0, 2000);
  await db.update(serviceRequests).set({ adminNote: note || null, updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  revalidatePath("/admin/requests");
}

/** 유료 노출 — 입금·결제 확인 토글 (수동 결제). 확인했다고 노출이 켜지지는 않는다 — 노출은 따로 켠다 */
export async function toggleRequestPaidAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = requestId(formData);
  if (!id) return;
  const row = (await db.select({ paidAt: serviceRequests.paidAt }).from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(serviceRequests).set({ paidAt: row.paidAt ? null : new Date(), updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  revalidatePath("/admin/requests");
}

/** 요청에 기존 스팟을 연결한다 (미등록 업체의 상단 노출 요청을 등록 뒤 잇거나, 잘못 연결된 것을 바로잡을 때) */
export async function attachRequestSpotAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = requestId(formData);
  const spotId = Number(formData.get("spotId"));
  if (!id) return;
  if (!Number.isSafeInteger(spotId) || spotId <= 0) {
    await db.update(serviceRequests).set({ spotId: null, updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  } else {
    const spot = (await db.select({ id: spots.id }).from(spots).where(eq(spots.id, spotId)).limit(1))[0];
    if (!spot) return;
    await db.update(serviceRequests).set({ spotId: spot.id, updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  }
  revalidatePath("/admin/requests");
}

/**
 * 요청한 회원을 대상 업체·브랜드의 소유자로 연결한다 (spots/makers.claimed_by) — 정보 관리 요청의 "소유 확인".
 * 이미 다른 회원이 소유자면 덮어쓰지 않는다 (먼저 해제한다). 연결되면 요청은 완료로.
 */
export async function attachOwnerAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = requestId(formData);
  if (!id) return;
  const req = (await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1))[0];
  if (!req || !req.userId) return;
  if (req.spotId) {
    const spot = (await db.select({ claimedBy: spots.claimedBy }).from(spots).where(eq(spots.id, req.spotId)).limit(1))[0];
    if (!spot || (spot.claimedBy && spot.claimedBy !== req.userId)) return;
    await db.update(spots).set({ claimedBy: req.userId, updatedAt: new Date() }).where(eq(spots.id, req.spotId));
    // 소유가 확인되면 무료 링크 페이지를 연다 (관리자가 먼저 만들어 둔 페이지가 있으면 그대로 이어받는다)
    await ensureSpotPage(db, req.spotId);
    for (const p of await spotPageRelatedPaths(req.spotId)) revalidatePath(p);
  } else if (req.makerId) {
    const maker = (await db.select({ claimedBy: makers.claimedBy }).from(makers).where(eq(makers.id, req.makerId)).limit(1))[0];
    if (!maker || (maker.claimedBy && maker.claimedBy !== req.userId)) return;
    await db.update(makers).set({ claimedBy: req.userId, updatedAt: new Date() }).where(eq(makers.id, req.makerId));
  } else return;
  await db.update(serviceRequests).set({ status: "done", handledAt: new Date(), updatedAt: new Date() }).where(eq(serviceRequests.id, id));
  revalidatePath("/admin/requests");
  revalidatePath("/admin");
  revalidatePath("/me/business");
}

/** 소유자 해제 — 스팟·메이커 편집기에서 */
export async function detachOwnerAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const spotId = Number(formData.get("spotId"));
  const makerId = Number(formData.get("makerId"));
  if (Number.isSafeInteger(spotId) && spotId > 0) {
    await db.update(spots).set({ claimedBy: null, updatedAt: new Date() }).where(eq(spots.id, spotId));
    revalidatePath(`/admin/spots/${spotId}`);
  } else if (Number.isSafeInteger(makerId) && makerId > 0) {
    await db.update(makers).set({ claimedBy: null, updatedAt: new Date() }).where(eq(makers.id, makerId));
    revalidatePath(`/admin/makers/${makerId}`);
  }
  revalidatePath("/me/business");
}
