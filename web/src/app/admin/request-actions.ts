"use server";

// 요청함 처리 액션 — /admin/requests. 상태 바꾸기·메모·입금 확인·업체 연결.
// "처리"의 실체는 다른 화면에서 일어난다(스팟 등록·편집·상단 노출 토글) — 여기서는 요청의 상태만 기록한다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/requests";

const { serviceRequests, spots } = schema;

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
