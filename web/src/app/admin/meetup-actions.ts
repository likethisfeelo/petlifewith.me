"use server";

// 펫모임 관리자 액션 — 숨김만 한다(승인 없음). 모임 숨김은 목록·페이지에서 사라지고 참여 회원도 못 본다.
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";

const { meetups, meetupPosts } = schema;

async function requireDb() {
  if (!(await getSession())) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

export async function toggleMeetupHiddenAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (await db.select({ hiddenAt: meetups.hiddenAt, slug: meetups.slug }).from(meetups).where(eq(meetups.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(meetups).set({ hiddenAt: row.hiddenAt ? null : new Date(), updatedAt: new Date() }).where(eq(meetups.id, id));
  revalidatePath("/admin/meetups");
  revalidatePath("/meetup");
  revalidatePath(`/meetup/${encodeURIComponent(row.slug)}`);
}

export async function toggleMeetupPostHiddenAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (
    await db
      .select({ hiddenAt: meetupPosts.hiddenAt, meetupId: meetupPosts.meetupId, slug: meetups.slug })
      .from(meetupPosts)
      .innerJoin(meetups, eq(meetupPosts.meetupId, meetups.id))
      .where(eq(meetupPosts.id, id))
      .limit(1)
  )[0];
  if (!row) return;
  await db.update(meetupPosts).set({ hiddenAt: row.hiddenAt ? null : new Date(), updatedAt: new Date() }).where(eq(meetupPosts.id, id));
  revalidatePath(`/admin/meetups/${row.meetupId}`);
  revalidatePath(`/meetup/${encodeURIComponent(row.slug)}`);
}
