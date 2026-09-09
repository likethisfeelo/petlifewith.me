"use server";

// 펫모임 회원 액션 — 내 지역 저장, 모임 만들기·수정·열기/마감, 참여·나가기, 게시판 글.
// 승인 없음: 모임은 만들면 바로 열린다(관리자는 숨김만). 새 모임은 슬랙으로 알린다.
// 비회원은 아무것도 못 한다. 게시판은 참여 회원만 쓴다.
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { siteUrl, slackRequestsWebhookUrl } from "@/lib/config";
import { getCurrentMember } from "@/lib/member";
import { MEETUP_LIMITS, isFull, meetupSlug, parseRegionIds, validateMeetupInput, validatePostBody } from "@/lib/meetups";
import { sendSlackMessage } from "@/lib/slack";

const { meetups, meetupMembers, meetupPosts, userRegions, regions } = schema;

export interface MeetupActionState {
  error?: string;
  saved?: boolean;
  values?: Record<string, string>;
}

function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") values[k] = v;
  return values;
}

function num(formData: FormData, name: string): number | null {
  const n = Number(String(formData.get(name) ?? "").trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 모임 페이지 경로 — 슬러그에 한글이 들어가므로 인코딩한다 (액션 응답 헤더는 ASCII 만 받는다) */
function meetupPath(slug: string): string {
  return `/meetup/${encodeURIComponent(slug)}`;
}

function meetupPaths(slug: string): string[] {
  return ["/meetup", meetupPath(slug), "/me", "/topic/play"];
}

// ---------- 내 지역 ----------

export async function saveMyRegionsAction(_prev: MeetupActionState, formData: FormData): Promise<MeetupActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인해 주세요." };
  const parsed = parseRegionIds(formData.get("regionIds"));
  if (!parsed.ok) return { error: parsed.error };
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  const db = getDb();
  const ids = parsed.value;
  if (ids.length > 0) {
    const found = await db.select({ id: regions.id }).from(regions).where(inArray(regions.id, ids));
    if (found.length !== ids.length) return { error: "지역을 다시 골라 주세요." };
  }
  await db.transaction(async (tx) => {
    await tx.delete(userRegions).where(eq(userRegions.userId, member.id));
    if (ids.length > 0) await tx.insert(userRegions).values(ids.map((regionId, i) => ({ userId: member.id, regionId, sortOrder: i })));
  });
  revalidatePath("/me");
  revalidatePath("/meetup");
  return { saved: true };
}

// ---------- 모임 만들기 · 수정 ----------

export async function createMeetupAction(_prev: MeetupActionState, formData: FormData): Promise<MeetupActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "모임을 만들려면 로그인해 주세요." };
  const values = echo(formData);
  const v = validateMeetupInput(Object.fromEntries(formData.entries()));
  if (!v.ok) return { error: v.error, values };
  const regionId = num(formData, "regionId");
  if (!regionId) return { error: "모임 지역을 골라 주세요.", values };
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다.", values };
  const db = getDb();

  // 내 지역(최대 3곳)에서만 만든다 — 지역 선택의 의미를 지킨다
  const mine = (await db.select({ id: userRegions.id }).from(userRegions).where(and(eq(userRegions.userId, member.id), eq(userRegions.regionId, regionId))).limit(1))[0];
  if (!mine) return { error: "내 지역으로 고른 곳에서만 모임을 만들 수 있어요. 내 정보에서 지역을 먼저 골라 주세요.", values };

  const recent = (
    await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(meetups)
      .where(and(eq(meetups.hostUserId, member.id), gt(meetups.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
  )[0]?.n;
  if ((recent ?? 0) >= MEETUP_LIMITS.meetupsPerDay) return { error: `모임은 하루에 ${MEETUP_LIMITS.meetupsPerDay}개까지 만들 수 있어요.`, values };

  const region = (await db.select({ sidoName: regions.sidoName, sigunguName: regions.sigunguName }).from(regions).where(eq(regions.id, regionId)).limit(1))[0];
  if (!region) return { error: "지역을 다시 골라 주세요.", values };

  let slug = "";
  let id = 0;
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    slug = meetupSlug(v.value.title, randomBytes(3).toString("hex"));
    try {
      const inserted = await db
        .insert(meetups)
        .values({ slug, title: v.value.title, regionId, hostUserId: member.id, descriptionMd: v.value.descriptionMd, placeText: v.value.placeText, meetingAt: v.value.meetingAt, capacity: v.value.capacity })
        .returning({ id: meetups.id });
      id = inserted[0]!.id;
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23505") throw e;
    }
  }
  if (!id) return { error: "잠시 후 다시 시도해 주세요.", values };
  await db.insert(meetupMembers).values({ meetupId: id, userId: member.id }).onConflictDoNothing();

  await sendSlackMessage(
    [`🐾 새 펫모임 #${id} · ${v.value.title}`, `• 지역: ${region.sidoName} ${region.sigunguName}`, `• 주최: ${member.displayName}`, v.value.placeText ? `• 장소: ${v.value.placeText}` : "", `→ ${siteUrl()}/admin/meetups`]
      .filter(Boolean)
      .join("\n"),
    slackRequestsWebhookUrl(),
  );

  for (const p of meetupPaths(slug)) revalidatePath(p);
  redirect(`${meetupPath(slug)}?created=1`);
}

async function requireHost(meetupId: number) {
  const member = await getCurrentMember();
  if (!member || !isDbConfigured()) return null;
  const db = getDb();
  const row = (await db.select({ id: meetups.id, slug: meetups.slug, hostUserId: meetups.hostUserId, hiddenAt: meetups.hiddenAt }).from(meetups).where(eq(meetups.id, meetupId)).limit(1))[0];
  if (!row || row.hostUserId !== member.id || row.hiddenAt) return null;
  return { member, db, meetup: row };
}

export async function updateMeetupAction(_prev: MeetupActionState, formData: FormData): Promise<MeetupActionState> {
  const values = echo(formData);
  const id = num(formData, "id");
  if (!id) return { error: "잘못된 요청", values };
  const ctx = await requireHost(id);
  if (!ctx) return { error: "주최자만 고칠 수 있어요.", values };
  const v = validateMeetupInput(Object.fromEntries(formData.entries()));
  if (!v.ok) return { error: v.error, values };
  await ctx.db
    .update(meetups)
    .set({ title: v.value.title, descriptionMd: v.value.descriptionMd, placeText: v.value.placeText, meetingAt: v.value.meetingAt, capacity: v.value.capacity, updatedAt: new Date() })
    .where(eq(meetups.id, id));
  for (const p of meetupPaths(ctx.meetup.slug)) revalidatePath(p);
  redirect(`${meetupPath(ctx.meetup.slug)}?updated=1`);
}

/** 열기 / 마감 — 주최자 */
export async function setMeetupStatusAction(formData: FormData): Promise<void> {
  const id = num(formData, "id");
  const status = String(formData.get("status") ?? "");
  if (!id || (status !== "open" && status !== "closed")) return;
  const ctx = await requireHost(id);
  if (!ctx) return;
  await ctx.db.update(meetups).set({ status, updatedAt: new Date() }).where(eq(meetups.id, id));
  for (const p of meetupPaths(ctx.meetup.slug)) revalidatePath(p);
}

// ---------- 참여 · 나가기 ----------

export async function joinMeetupAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  const id = num(formData, "id");
  if (!member || !id || !isDbConfigured()) return;
  const db = getDb();
  const row = (
    await db
      .select({ id: meetups.id, slug: meetups.slug, status: meetups.status, hiddenAt: meetups.hiddenAt, capacity: meetups.capacity, // 바깥 테이블 컬럼은 글자 그대로 — drizzle 이 조인 없는 select 에서는 "id" 로만 렌더해 서브쿼리 안쪽 컬럼에 잡힌다
      n: sql<number>`(select count(*) from ${meetupMembers} mm where mm.meetup_id = meetups.id)`.mapWith(Number) })
      .from(meetups)
      .where(eq(meetups.id, id))
      .limit(1)
  )[0];
  if (!row || row.status !== "open" || row.hiddenAt || isFull(row.n, row.capacity)) return;
  await db.insert(meetupMembers).values({ meetupId: id, userId: member.id }).onConflictDoNothing();
  for (const p of meetupPaths(row.slug)) revalidatePath(p);
}

export async function leaveMeetupAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  const id = num(formData, "id");
  if (!member || !id || !isDbConfigured()) return;
  const db = getDb();
  const row = (await db.select({ slug: meetups.slug, hostUserId: meetups.hostUserId }).from(meetups).where(eq(meetups.id, id)).limit(1))[0];
  if (!row || row.hostUserId === member.id) return; // 주최자는 나갈 수 없다 — 마감으로 닫는다
  await db.delete(meetupMembers).where(and(eq(meetupMembers.meetupId, id), eq(meetupMembers.userId, member.id)));
  for (const p of meetupPaths(row.slug)) revalidatePath(p);
}

// ---------- 게시판 ----------

export async function addMeetupPostAction(_prev: MeetupActionState, formData: FormData): Promise<MeetupActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인해 주세요." };
  const id = num(formData, "meetupId");
  const body = validatePostBody(formData.get("body"));
  const values = { body: String(formData.get("body") ?? "") };
  if (!id) return { error: "잘못된 요청", values };
  if (!body.ok) return { error: body.error, values };
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다.", values };
  const db = getDb();
  const meetup = (await db.select({ slug: meetups.slug, hiddenAt: meetups.hiddenAt }).from(meetups).where(eq(meetups.id, id)).limit(1))[0];
  if (!meetup || meetup.hiddenAt) return { error: "글을 쓸 수 없는 모임입니다.", values };
  const joined = (await db.select({ id: meetupMembers.id }).from(meetupMembers).where(and(eq(meetupMembers.meetupId, id), eq(meetupMembers.userId, member.id))).limit(1))[0];
  if (!joined) return { error: "참여 중인 회원만 쓸 수 있어요.", values };
  const recent = (
    await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(meetupPosts)
      .where(and(eq(meetupPosts.userId, member.id), gt(meetupPosts.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
  )[0]?.n;
  if ((recent ?? 0) >= MEETUP_LIMITS.postsPerHour) return { error: "글을 너무 자주 쓰고 있습니다. 잠시 후 다시 시도해 주세요.", values };
  await db.insert(meetupPosts).values({ meetupId: id, userId: member.id, body: body.value });
  revalidatePath(meetupPath(meetup.slug));
  return { saved: true };
}

export async function deleteOwnMeetupPostAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  const id = num(formData, "id");
  if (!member || !id || !isDbConfigured()) return;
  const db = getDb();
  const row = (
    await db
      .select({ id: meetupPosts.id, userId: meetupPosts.userId, slug: meetups.slug })
      .from(meetupPosts)
      .innerJoin(meetups, eq(meetupPosts.meetupId, meetups.id))
      .where(eq(meetupPosts.id, id))
      .limit(1)
  )[0];
  if (!row || row.userId !== member.id) return;
  await db.delete(meetupPosts).where(eq(meetupPosts.id, id));
  revalidatePath(meetupPath(row.slug));
}
