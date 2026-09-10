"use server";

// 상담 전문가 관리 액션 — 프로필 등록·수정·공개, 주간 슬롯, 회원 계정 연결(이메일).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isValidObjectKey } from "@/lib/assets";
import { CONSULT_MODES, EXPERT_KINDS, isExpertKind, parseWeeklySlots } from "@/lib/reservations";
import { parseRows, rowString } from "./_components/parse-rows";
import type { ActionState } from "./actions";

const { experts, expertSlots, users, serviceRequests } = schema;

async function requireDb() {
  if (!(await getSession())) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}
function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

async function readExpert(db: ReturnType<typeof getDb>, formData: FormData) {
  const kind = str(formData, "kind");
  if (!isExpertKind(kind)) return { error: "종류를 골라 주세요." };
  const displayName = str(formData, "displayName");
  if (displayName.length < 2) return { error: "활동명을 2자 이상 적어 주세요." };
  const modes = CONSULT_MODES.filter((m) => formData.getAll("modes").includes(m));
  const topics = [...new Set(str(formData, "topics").split(/[,\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, 12);
  const heroImageKey = str(formData, "heroImageKey") || null;
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };
  const email = str(formData, "userEmail").toLowerCase();
  let userId: string | null = null;
  if (email) {
    const u = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
    if (!u) return { error: `회원 ${email} 을(를) 찾을 수 없습니다. 먼저 가입한 계정의 이메일을 적어 주세요.` };
    userId = u.id;
  }
  const slotRows = parseRows(formData, "slotsJson").map((r) => ({ weekday: rowString(r, "weekday"), start: rowString(r, "start"), end: rowString(r, "end") })).filter((r) => r.start || r.end);
  const slots = parseWeeklySlots(slotRows);
  if (!slots.ok) return { error: slots.error };
  const verified = str(formData, "credentialsVerifiedAt");
  if (verified && !/^\d{4}-\d{2}-\d{2}$/.test(verified)) return { error: "확인 기준일은 YYYY-MM-DD 형식입니다." };
  return {
    values: {
      kind,
      displayName,
      introMd: str(formData, "introMd") || null,
      credentialsText: str(formData, "credentialsText") || null,
      credentialsVerifiedAt: verified || null,
      topics,
      modes,
      priceText: str(formData, "priceText") || null,
      heroImageKey,
      userId,
      contact: str(formData, "contact") || null,
      status: (formData.get("status") === "published" ? "published" : "draft") as "draft" | "published",
      sortOrder: Number(str(formData, "sortOrder") || 0) || 0,
    },
    slots: slots.value,
  };
}

async function writeSlots(db: ReturnType<typeof getDb>, expertId: number, slots: Array<{ weekday: number; startMin: number; endMin: number }>) {
  await db.delete(expertSlots).where(eq(expertSlots.expertId, expertId));
  if (slots.length > 0) await db.insert(expertSlots).values(slots.map((s) => ({ expertId, ...s })));
}

export async function createExpertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const read = await readExpert(db, formData);
  if ("error" in read) return { error: read.error };
  const base = slugify(str(formData, "slug") || read.values.displayName, "expert");
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const dup = (await db.select({ id: experts.id }).from(experts).where(eq(experts.slug, slug)).limit(1))[0];
    if (!dup) break;
    slug = `${base}-${i}`;
  }
  const inserted = await db.insert(experts).values({ ...read.values, slug }).returning({ id: experts.id });
  const id = inserted[0]!.id;
  await writeSlots(db, id, read.slots);
  const fromRequestId = Number(str(formData, "fromRequestId"));
  if (Number.isSafeInteger(fromRequestId) && fromRequestId > 0) {
    await db.update(serviceRequests).set({ status: "in_progress", updatedAt: new Date() }).where(and(eq(serviceRequests.id, fromRequestId), eq(serviceRequests.status, "new")));
    revalidatePath("/admin/requests");
  }
  revalidatePath("/consult");
  redirect(`/admin/experts/${id}?created=1`);
}

export async function saveExpertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireDb();
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };
  const existing = (await db.select({ slug: experts.slug }).from(experts).where(eq(experts.id, id)).limit(1))[0];
  if (!existing) return { error: "전문가를 찾을 수 없습니다." };
  const read = await readExpert(db, formData);
  if ("error" in read) return { error: read.error };
  await db.update(experts).set({ ...read.values, updatedAt: new Date() }).where(eq(experts.id, id));
  await writeSlots(db, id, read.slots);
  revalidatePath("/consult");
  revalidatePath(`/consult/${encodeURIComponent(existing.slug)}`);
  revalidatePath("/admin/experts");
  return { saved: true };
}

export async function toggleExpertPublishedAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (await db.select({ status: experts.status, slug: experts.slug }).from(experts).where(eq(experts.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(experts).set({ status: row.status === "published" ? "draft" : "published", updatedAt: new Date() }).where(eq(experts.id, id));
  revalidatePath("/consult");
  revalidatePath(`/consult/${encodeURIComponent(row.slug)}`);
  revalidatePath("/admin/experts");
}
