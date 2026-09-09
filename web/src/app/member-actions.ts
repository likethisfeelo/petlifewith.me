"use server";

// 회원 서버 액션 — 가입·로그인·프로필·회원 글·댓글.
// 인증은 lib/auth.ts(세션)·lib/member.ts(현재 회원)만 거친다.
// 회원 글은 pending 으로 시작해 관리자가 승인(published)해야 노출된다.
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, sql } from "drizzle-orm";
import { categoriesForTopic, slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { endMemberSession, startMemberSession } from "@/lib/auth";
import { getCurrentMember, safeNextPath } from "@/lib/member";
import {
  COMMENT_MAX,
  MAX_COMMENTS_PER_HOUR,
  MAX_PENDING_POSTS,
  POST_BODY_MAX,
  POST_BODY_MIN,
  POST_SUMMARY_MAX,
  POST_TITLE_MAX,
} from "@/lib/member-limits";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/lib/password";
import { guideRelatedPaths } from "@/lib/revalidate-paths";

const { users, guides, topics, comments } = schema;

export interface MemberActionState {
  error?: string;
  saved?: boolean;
  /** 저장 후 한 줄 안내 (예: 다시 승인 대기로 바뀜) */
  notice?: string;
  /**
   * 실패 시 되돌려주는 입력값 — React 19 는 액션이 끝나면 비제어 폼을 초기화하므로,
   * 폼이 defaultValue 로 다시 채울 수 있게 한다 (비밀번호는 절대 포함하지 않는다)
   */
  values?: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_RE = /^[0-9A-Za-z가-힣][0-9A-Za-z가-힣 _.-]{1,19}$/; // 2~20자

// 존재하지 않는 이메일로 로그인해도 검증 시간이 비슷하도록 더미 해시를 한 번 만들어 둔다
const DUMMY_HASH = hashPassword(`dummy-${randomInt(1e9)}`);

function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

function isUniqueViolation(e: unknown, constraint: string): boolean {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = err?.code ?? err?.cause?.code;
  const name = err?.constraint ?? err?.cause?.constraint;
  return code === "23505" && name === constraint;
}

// ---------- 가입 · 로그인 ----------

export async function signupAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  const email = str(formData, "email").toLowerCase();
  const displayName = str(formData, "displayName");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("passwordConfirm") ?? "");
  const next = safeNextPath(str(formData, "next"));

  const values = { email, displayName, agree: formData.get("agree") === "on" ? "on" : "" };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "이메일 형식을 확인해 주세요.", values };
  if (!DISPLAY_NAME_RE.test(displayName)) return { error: "닉네임은 2~20자로, 한글·영문·숫자·공백·._- 만 쓸 수 있습니다.", values };
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy, values };
  if (password !== confirm) return { error: "비밀번호 확인이 일치하지 않습니다.", values };
  if (formData.get("agree") !== "on") return { error: "안내 사항을 확인하고 동의해 주세요.", values };

  const db = getDb();
  let created: { id: string; sessionVersion: number } | undefined;
  try {
    created = (
      await db
        .insert(users)
        .values({ email, displayName, role: "member", passwordHash: hashPassword(password), lastLoginAt: new Date() })
        .returning({ id: users.id, sessionVersion: users.sessionVersion })
    )[0];
  } catch (e) {
    if (isUniqueViolation(e, "users_email_unique")) return { error: "이미 가입된 이메일입니다. 로그인해 주세요.", values };
    if (isUniqueViolation(e, "users_display_name_lower_uq")) return { error: "이미 쓰이는 닉네임입니다. 다른 닉네임을 골라 주세요.", values };
    throw e;
  }
  if (!created) return { error: "가입에 실패했습니다. 다시 시도해 주세요.", values };
  await startMemberSession(created.id, created.sessionVersion);
  redirect(next);
}

export async function memberLoginAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(str(formData, "next"));
  const values = { email };
  if (!email || !password) return { error: "이메일과 비밀번호를 입력해 주세요.", values };

  const db = getDb();
  const row = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  const ok = row?.passwordHash ? verifyPassword(password, row.passwordHash) : verifyPassword(password, DUMMY_HASH);
  if (!row || !row.passwordHash || !ok) return { error: "이메일 또는 비밀번호가 올바르지 않습니다.", values };
  if (row.blockedAt) return { error: "이용이 제한된 계정입니다. 문의해 주세요.", values };
  if (!row.displayName) return { error: "닉네임이 없는 계정입니다. 문의해 주세요.", values };

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.id));
  await startMemberSession(row.id, row.sessionVersion);
  redirect(next);
}

export async function memberLogoutAction(): Promise<void> {
  await endMemberSession();
  redirect("/");
}

// ---------- 프로필 ----------

export async function updateProfileAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인이 필요합니다." };
  const displayName = str(formData, "displayName");
  if (!DISPLAY_NAME_RE.test(displayName)) return { error: "닉네임은 2~20자로, 한글·영문·숫자·공백·._- 만 쓸 수 있습니다." };
  if (displayName === member.displayName) return { saved: true };
  const db = getDb();
  try {
    await db.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.id, member.id));
  } catch (e) {
    if (isUniqueViolation(e, "users_display_name_lower_uq")) return { error: "이미 쓰이는 닉네임입니다." };
    throw e;
  }
  // 닉네임이 보이는 페이지(내 글·내 댓글이 달린 글)를 다시 만든다
  const myGuides = await db.select({ slug: guides.slug }).from(guides).where(eq(guides.authorUserId, member.id));
  const commented = await db
    .selectDistinct({ slug: guides.slug })
    .from(comments)
    .innerJoin(guides, eq(comments.guideId, guides.id))
    .where(eq(comments.userId, member.id));
  for (const g of [...myGuides, ...commented]) revalidatePath(`/guide/${g.slug}`);
  return { saved: true };
}

export async function changePasswordAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인이 필요합니다." };
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("newPasswordConfirm") ?? "");
  const policy = passwordPolicyError(next);
  if (policy) return { error: policy };
  if (next !== confirm) return { error: "새 비밀번호 확인이 일치하지 않습니다." };
  const db = getDb();
  const row = (await db.select().from(users).where(eq(users.id, member.id)).limit(1))[0];
  if (!row || !verifyPassword(current, row.passwordHash)) return { error: "현재 비밀번호가 올바르지 않습니다." };
  const version = row.sessionVersion + 1;
  await db
    .update(users)
    .set({ passwordHash: hashPassword(next), sessionVersion: version, updatedAt: new Date() })
    .where(eq(users.id, member.id));
  // 다른 기기의 세션은 버전 불일치로 끊기고, 이 기기는 새 쿠키를 받는다
  await startMemberSession(member.id, version);
  return { saved: true };
}

// ---------- 회원 글 ----------

interface PostInput {
  topicId: number;
  topicSlug: string;
  category: string | null;
  title: string;
  summary: string | null;
  bodyMd: string;
}

async function readPostInput(formData: FormData): Promise<{ error?: string; values: Record<string, string>; input?: PostInput }> {
  const db = getDb();
  const values = {
    topicId: str(formData, "topicId"),
    category: str(formData, "category"),
    title: str(formData, "title"),
    summary: str(formData, "summary"),
    bodyMd: String(formData.get("bodyMd") ?? ""),
  };
  const topicId = Number(values.topicId);
  if (!Number.isSafeInteger(topicId) || topicId <= 0) return { error: "주제(클러스터)를 선택해 주세요.", values };
  const topic = (await db.select({ id: topics.id, slug: topics.slug }).from(topics).where(eq(topics.id, topicId)).limit(1))[0];
  if (!topic) return { error: "주제를 찾을 수 없습니다.", values };
  const category = values.category || null;
  if (category && !categoriesForTopic(topic.slug).some((c) => c.slug === category)) {
    return { error: "카테고리를 다시 선택해 주세요.", values };
  }
  const title = values.title;
  const summary = values.summary || null;
  const bodyMd = values.bodyMd.trim();
  if (title.length < 2 || title.length > POST_TITLE_MAX) return { error: `제목은 2~${POST_TITLE_MAX}자로 써 주세요.`, values };
  if (summary && summary.length > POST_SUMMARY_MAX) return { error: `한 줄 요약은 ${POST_SUMMARY_MAX}자 이하로 써 주세요.`, values };
  if (bodyMd.length < POST_BODY_MIN) return { error: `본문은 ${POST_BODY_MIN}자 이상 써 주세요.`, values };
  if (bodyMd.length > POST_BODY_MAX) return { error: `본문은 ${POST_BODY_MAX.toLocaleString("ko-KR")}자 이하로 써 주세요.`, values };
  return { values, input: { topicId: topic.id, topicSlug: topic.slug, category, title, summary, bodyMd } };
}

function randomSuffix(): string {
  return randomInt(36 ** 4).toString(36).padStart(4, "0");
}

export async function createMemberPostAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fwrite");
  const db = getDb();
  const { error, values, input } = await readPostInput(formData);
  if (error || !input) return { error: error ?? "입력을 확인해 주세요.", values };

  const pendingCount = (
    await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(guides)
      .where(and(eq(guides.authorUserId, member.id), eq(guides.status, "pending")))
  )[0]?.count;
  if ((pendingCount ?? 0) >= MAX_PENDING_POSTS) {
    return { error: `승인 대기 중인 글이 ${MAX_PENDING_POSTS}편입니다. 승인된 뒤 다시 써 주세요.`, values };
  }

  const base = slugify(input.title, "post");
  let inserted: { id: number } | undefined;
  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const slug = `${base}-${randomSuffix()}`;
    try {
      inserted = (
        await db
          .insert(guides)
          .values({
            slug,
            title: input.title,
            summary: input.summary,
            bodyMd: input.bodyMd,
            topicId: input.topicId,
            role: "spoke",
            category: input.category,
            status: "pending",
            medicalAdjacent: false,
            authorUserId: member.id,
          })
          .returning({ id: guides.id })
      )[0];
    } catch (e) {
      if (!isUniqueViolation(e, "guides_slug_unique")) throw e;
    }
  }
  if (!inserted) return { error: "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.", values };
  redirect("/me?submitted=1");
}

export async function updateMemberPostAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인이 필요합니다." };
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };
  const db = getDb();
  const existing = (await db.select().from(guides).where(eq(guides.id, id)).limit(1))[0];
  if (!existing || existing.authorUserId !== member.id) return { error: "내 글이 아닙니다." };
  if (existing.status !== "pending" && existing.status !== "published") return { error: "지금 상태에서는 수정할 수 없습니다. 문의해 주세요." };

  const { error, values, input } = await readPostInput(formData);
  if (error || !input) return { error: error ?? "입력을 확인해 주세요.", values };

  // 발행된 글을 고치면 다시 승인 대기로 — 승인된 내용이 조용히 바뀌지 않게
  const wasPublished = existing.status === "published";
  await db
    .update(guides)
    .set({
      title: input.title,
      summary: input.summary,
      bodyMd: input.bodyMd,
      topicId: input.topicId,
      category: input.category,
      status: "pending",
      // 승인 전 글에는 큐레이션 순서·부위 대표가 붙어 있으면 안 된다 (관리자가 승인하며 다시 정한다)
      curatedOrder: null,
      areaOrder: null,
      updatedAt: new Date(),
    })
    .where(eq(guides.id, id));
  if (wasPublished) {
    if (existing.category) revalidatePath(`/topic/${input.topicSlug}/${existing.category}`);
    for (const p of await guideRelatedPaths(id)) revalidatePath(p);
  }
  return { saved: true, notice: wasPublished ? "수정한 글은 다시 승인 대기로 바뀌었습니다. 승인되면 다시 공개됩니다." : undefined };
}

export async function deleteMemberPostAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme");
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return;
  const db = getDb();
  const existing = (await db.select().from(guides).where(eq(guides.id, id)).limit(1))[0];
  if (!existing || existing.authorUserId !== member.id || existing.status !== "pending") return;
  await db.delete(guides).where(eq(guides.id, id));
  redirect("/me?deleted=1");
}

// ---------- 댓글 ----------

export async function addCommentAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "댓글을 쓰려면 로그인해 주세요." };
  const guideId = Number(str(formData, "guideId"));
  const body = String(formData.get("body") ?? "").trim();
  const values = { body };
  if (!Number.isSafeInteger(guideId)) return { error: "잘못된 요청", values };
  if (body.length < 2) return { error: "댓글을 2자 이상 써 주세요.", values };
  if (body.length > COMMENT_MAX) return { error: `댓글은 ${COMMENT_MAX}자 이하로 써 주세요.`, values };

  const db = getDb();
  const guide = (await db.select({ id: guides.id, slug: guides.slug, status: guides.status }).from(guides).where(eq(guides.id, guideId)).limit(1))[0];
  if (!guide || guide.status !== "published") return { error: "댓글을 달 수 없는 글입니다." };

  const recent = (
    await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(comments)
      .where(and(eq(comments.userId, member.id), gt(comments.createdAt, new Date(Date.now() - 60 * 60 * 1000))))
  )[0]?.count;
  if ((recent ?? 0) >= MAX_COMMENTS_PER_HOUR) return { error: "댓글을 너무 자주 쓰고 있습니다. 잠시 후 다시 시도해 주세요.", values };

  await db.insert(comments).values({ guideId, userId: member.id, body });
  for (const p of await guideRelatedPaths(guideId)) revalidatePath(p);
  return { saved: true };
}

export async function deleteOwnCommentAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  if (!member) return;
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return;
  const db = getDb();
  const row = (await db.select({ id: comments.id, userId: comments.userId, guideId: comments.guideId }).from(comments).where(eq(comments.id, id)).limit(1))[0];
  if (!row || row.userId !== member.id) return;
  await db.delete(comments).where(eq(comments.id, id));
  for (const p of await guideRelatedPaths(row.guideId)) revalidatePath(p);
}
