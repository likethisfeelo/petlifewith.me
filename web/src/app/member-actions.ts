"use server";

// 회원 서버 액션 — 프로필(닉네임)·회원 글·댓글. 가입·로그인·비밀번호는 app/auth-actions.ts (Cognito).
// 인증은 lib/auth.ts(세션)·lib/member.ts(현재 회원)만 거친다.
// 회원 글은 pending 으로 시작해 관리자가 승인(published)해야 노출된다 — 관리자 설정(member_media.requireApproval)을
// 끄면 저장 즉시 공개된다. 본문의 사진·영상은 자기 자산만, 외부 영상은 창작자·원본 링크가 있어야 한다.
import { randomInt } from "node:crypto";
import { revalidatePath } from "@/lib/cdn";
import { redirect } from "next/navigation";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { categoriesForTopic, slugify } from "@app/data";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { DISPLAY_NAME_RE } from "@/lib/identity";
import { getCurrentMember } from "@/lib/member";
import {
  COMMENT_MAX,
  MAX_COMMENTS_PER_HOUR,
  MAX_PENDING_POSTS,
  POST_BODY_MAX,
  POST_BODY_MIN,
  POST_SUMMARY_MAX,
  POST_TITLE_MAX,
} from "@/lib/member-limits";
import { extractEmbeds, parseMediaRef, sameRef, uploadedKeysIn, videoEmbeds } from "@/lib/media-ref";
import { findAssetsByKeys } from "@/lib/queries/media";
import { listOwnedEntityOptions } from "@/lib/queries/owner";
import { getMemberMediaSettings } from "@/lib/queries/settings";
import { guideRelatedPaths } from "@/lib/revalidate-paths";
import { mediaCountError } from "@/lib/settings";
import { hashtagsIn, mergeTags, parseTagInput, tagHref } from "@/lib/tags";

const { users, guides, topics, comments, guideSpotTags, guideMakerTags, guideItemTags } = schema;

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

// ---------- 회원 글 ----------

interface PostInput {
  topicId: number;
  topicSlug: string;
  category: string | null;
  title: string;
  summary: string | null;
  bodyMd: string;
  heroMedia: string | null;
  tags: string[];
}

/**
 * 본문 미디어 검사 — 외부 영상은 창작자·원본 링크가 있어야 하고(운영 규칙 3-4), 업로드 자산은 등록된 자기 것이어야 하며,
 * 개수는 관리자 설정 한도 안이어야 한다. 대표 영상은 본문에 있는 영상만 가리킬 수 있다.
 */
async function checkPostMedia(memberId: string, bodyMd: string, heroMediaRaw: string): Promise<{ error?: string; heroMedia: string | null }> {
  for (const e of extractEmbeds(bodyMd)) {
    if (!e.complete) {
      return { error: e.ref.kind === "youtube" ? "유튜브 영상에는 채널(창작자) 이름과 원본 링크가 필요합니다. 툴바의 '유튜브 링크'로 넣어 주세요." : "인스타그램 게시물에는 계정 이름과 원본 링크가 필요합니다. 툴바의 '인스타그램 링크'로 넣어 주세요.", heroMedia: null };
    }
  }
  // 스토리 등 허용되지 않는 인스타그램 주소는 extractEmbeds 가 걸러 렌더도 막히지만, 글쓴이에게 미리 알린다
  if (/^\{\{instagram:[^}]*\/stories\//m.test(bodyMd)) return { error: "인스타그램 스토리는 넣을 수 없습니다. 게시물·릴스 주소만 됩니다.", heroMedia: null };

  const keys = uploadedKeysIn(bodyMd);
  const settings = await getMemberMediaSettings();
  const countError = mediaCountError({ images: keys.images.length, videos: keys.videos.length }, settings);
  if (countError) return { error: countError, heroMedia: null };
  const all = [...keys.images, ...keys.videos];
  if (all.length > 0) {
    const assets = await findAssetsByKeys(all);
    const byKey = new Map(assets.map((a) => [a.objectKey, a]));
    for (const key of all) {
      const a = byKey.get(key);
      if (!a || a.uploaderUserId !== memberId) return { error: "본문에 내가 올리지 않은 사진·영상 키가 있습니다. 툴바로 다시 올려 주세요.", heroMedia: null };
    }
  }

  const hero = heroMediaRaw ? parseMediaRef(heroMediaRaw) : null;
  if (heroMediaRaw && !hero) return { error: "대표 영상 값이 올바르지 않습니다.", heroMedia: null };
  if (hero && !videoEmbeds(bodyMd).some((e) => sameRef(e.ref, hero))) return { error: "대표 영상은 본문에 넣은 영상 가운데 골라 주세요.", heroMedia: null };
  return { heroMedia: hero ? heroMediaRaw : null };
}

async function readPostInput(formData: FormData, memberId: string): Promise<{ error?: string; values: Record<string, string>; input?: PostInput }> {
  const db = getDb();
  const values = {
    topicId: str(formData, "topicId"),
    category: str(formData, "category"),
    title: str(formData, "title"),
    summary: str(formData, "summary"),
    bodyMd: String(formData.get("bodyMd") ?? ""),
    heroMedia: str(formData, "heroMedia"),
    tags: str(formData, "tags"),
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
  const media = await checkPostMedia(memberId, bodyMd, values.heroMedia);
  if (media.error) return { error: media.error, values };
  const tags = mergeTags(parseTagInput(values.tags), hashtagsIn(bodyMd));
  return { values, input: { topicId: topic.id, topicSlug: topic.slug, category, title, summary, bodyMd, heroMedia: media.heroMedia, tags } };
}


/** 글에 연결할 내 업체·브랜드·상품 — 폼의 체크박스(linkSpots/linkMakers/linkItems). 소유한 것만 남긴다 */
function readEntityLinks(formData: FormData): { spotIds: number[]; makerIds: number[]; itemIds: number[] } {
  const ids = (name: string) => [...new Set(formData.getAll(name).map((v) => Number(v)).filter((n) => Number.isSafeInteger(n) && n > 0))];
  return { spotIds: ids("linkSpots"), makerIds: ids("linkMakers"), itemIds: ids("linkItems") };
}

/**
 * 회원 글의 개체 연결 동기화 — 이 회원이 소유한 개체 범위 안에서만 넣고 뺀다.
 * 운영자가 붙인 다른 개체의 태그는 그대로 둔다.
 */
async function syncMemberEntityLinks(db: ReturnType<typeof getDb>, guideId: number, memberId: string, wanted: { spotIds: number[]; makerIds: number[]; itemIds: number[] }) {
  const owned = await listOwnedEntityOptions(memberId);
  const ownedSpots = owned.spots.map((s) => s.id);
  const ownedMakers = owned.makers.map((m) => m.id);
  const ownedItems = owned.items.map((i) => i.id);
  const sync = async (ownedIds: number[], wantedIds: number[], table: typeof guideSpotTags | typeof guideMakerTags | typeof guideItemTags, col: "spotId" | "makerId" | "itemId") => {
    if (ownedIds.length === 0) return;
    const keep = wantedIds.filter((id) => ownedIds.includes(id));
    const removable = ownedIds.filter((id) => !keep.includes(id));
    if (removable.length > 0) {
      if (col === "spotId") await db.delete(guideSpotTags).where(and(eq(guideSpotTags.guideId, guideId), inArray(guideSpotTags.spotId, removable)));
      else if (col === "makerId") await db.delete(guideMakerTags).where(and(eq(guideMakerTags.guideId, guideId), inArray(guideMakerTags.makerId, removable)));
      else await db.delete(guideItemTags).where(and(eq(guideItemTags.guideId, guideId), inArray(guideItemTags.itemId, removable)));
    }
    void table;
    for (const id of keep) {
      if (col === "spotId") await db.insert(guideSpotTags).values({ guideId, spotId: id }).onConflictDoNothing();
      else if (col === "makerId") await db.insert(guideMakerTags).values({ guideId, makerId: id }).onConflictDoNothing();
      else await db.insert(guideItemTags).values({ guideId, itemId: id }).onConflictDoNothing();
    }
  };
  await sync(ownedSpots, wanted.spotIds, guideSpotTags, "spotId");
  await sync(ownedMakers, wanted.makerIds, guideMakerTags, "makerId");
  await sync(ownedItems, wanted.itemIds, guideItemTags, "itemId");
}

function randomSuffix(): string {
  return randomInt(36 ** 4).toString(36).padStart(4, "0");
}

export async function createMemberPostAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fwrite");
  const db = getDb();
  const { error, values, input } = await readPostInput(formData, member.id);
  if (error || !input) return { error: error ?? "입력을 확인해 주세요.", values };
  const { requireApproval } = await getMemberMediaSettings();

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
            heroMedia: input.heroMedia,
            tags: input.tags,
            // 승인 대기가 꺼져 있으면 저장 즉시 공개
            status: requireApproval ? "pending" : "published",
            publishedAt: requireApproval ? null : new Date(),
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
  await syncMemberEntityLinks(db, inserted.id, member.id, readEntityLinks(formData));
  if (!requireApproval) {
    for (const p of await guideRelatedPaths(inserted.id)) revalidatePath(p);
    for (const t of input.tags) revalidatePath(tagHref(t));
    revalidatePath(`/topic/${input.topicSlug}/challenge`);
    revalidatePath(`/topic/${input.topicSlug}/curated`);
  }
  redirect(requireApproval ? "/me?submitted=1" : "/me?published=1");
}

export async function updateMemberPostAction(_prev: MemberActionState, formData: FormData): Promise<MemberActionState> {
  const member = await getCurrentMember();
  if (!member) return { error: "로그인이 필요합니다." };
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };
  const db = getDb();
  const existing = (await db.select().from(guides).where(eq(guides.id, id)).limit(1))[0];
  if (!existing || existing.authorUserId !== member.id) return { error: "내 글이 아닙니다." };
  // draft = 관리자가 반려한 글. 고치면 다시 승인 대기(또는 승인 대기를 끈 경우 바로 공개)로 올라간다
  if (existing.status !== "pending" && existing.status !== "published" && existing.status !== "draft") return { error: "지금 상태에서는 수정할 수 없습니다. 문의해 주세요." };

  const { error, values, input } = await readPostInput(formData, member.id);
  if (error || !input) return { error: error ?? "입력을 확인해 주세요.", values };
  const { requireApproval } = await getMemberMediaSettings();

  // 발행된 글을 고치면 다시 승인 대기로 — 승인된 내용이 조용히 바뀌지 않게. 승인 대기가 꺼져 있으면 그대로 공개 유지
  const wasPublished = existing.status === "published";
  const backToPending = requireApproval;
  const nextStatus = backToPending ? "pending" : existing.status === "pending" || existing.status === "draft" ? "published" : existing.status;
  await db
    .update(guides)
    .set({
      title: input.title,
      summary: input.summary,
      bodyMd: input.bodyMd,
      topicId: input.topicId,
      category: input.category,
      heroMedia: input.heroMedia,
      tags: input.tags,
      status: nextStatus,
      publishedAt: nextStatus === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      // 승인 전 글에는 큐레이션 순서·부위 대표가 붙어 있으면 안 된다 (관리자가 승인하며 다시 정한다)
      ...(backToPending ? { curatedOrder: null, areaOrder: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(guides.id, id));
  await syncMemberEntityLinks(db, id, member.id, readEntityLinks(formData));
  if (wasPublished || nextStatus === "published") {
    if (existing.category) revalidatePath(`/topic/${input.topicSlug}/${existing.category}`);
    for (const p of await guideRelatedPaths(id)) revalidatePath(p);
    for (const t of new Set([...existing.tags, ...input.tags])) revalidatePath(tagHref(t));
    revalidatePath(`/topic/${input.topicSlug}/challenge`);
    revalidatePath(`/topic/${input.topicSlug}/curated`);
  }
  return { saved: true, notice: wasPublished && backToPending ? "수정한 글은 다시 승인 대기로 바뀌었습니다. 승인되면 다시 공개됩니다." : undefined };
}

export async function deleteMemberPostAction(formData: FormData): Promise<void> {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme");
  const id = Number(str(formData, "id"));
  if (!Number.isSafeInteger(id)) return;
  const db = getDb();
  const existing = (await db.select().from(guides).where(eq(guides.id, id)).limit(1))[0];
  // 승인 대기·반려(draft) 글만 본인이 지운다 — 공개된 글은 운영진 확인 없이 사라지지 않게
  if (!existing || existing.authorUserId !== member.id || (existing.status !== "pending" && existing.status !== "draft")) return;
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
