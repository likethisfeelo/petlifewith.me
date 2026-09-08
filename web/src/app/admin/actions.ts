"use server";

// 관리자 서버 액션 — 인증은 lib/auth.ts 만 거친다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession, loginWithToken, logout } from "@/lib/auth";
import { categoriesForTopic, slugify } from "@app/data";
import { isValidObjectKey } from "@/lib/assets";
import { parsePinnedOrder } from "@/lib/guide-order";
import { guideRelatedPaths } from "@/lib/revalidate-paths";

const { guides, topics, users, comments, claims, spots, spotTypes, guideItemTags, guideSpotTags, guideMakerTags, promotions } = schema;

type GuideStatus = "draft" | "review_pending" | "published" | "archived" | "pending";
const GUIDE_STATUSES: readonly GuideStatus[] = ["draft", "review_pending", "published", "archived", "pending"];

function readStatus(formData: FormData, fallback: GuideStatus): GuideStatus {
  const raw = String(formData.get("status") ?? "");
  return (GUIDE_STATUSES as readonly string[]).includes(raw) ? (raw as GuideStatus) : fallback;
}

/** 카테고리(위치)는 토픽 정의에 있는 슬러그만. 빈 값은 "전체". */
async function readCategory(db: ReturnType<typeof getDb>, formData: FormData, topicId: number): Promise<{ error?: string; category: string | null; topicSlug: string }> {
  const topic = (await db.select({ slug: topics.slug }).from(topics).where(eq(topics.id, topicId)).limit(1))[0];
  if (!topic) return { error: "토픽을 찾을 수 없습니다.", category: null, topicSlug: "" };
  const category = String(formData.get("category") ?? "").trim() || null;
  if (category && !categoriesForTopic(topic.slug).some((c) => c.slug === category)) {
    return { error: `토픽 "${topic.slug}" 에 없는 카테고리입니다.`, category: null, topicSlug: topic.slug };
  }
  return { category, topicSlug: topic.slug };
}

/** 최상단 고정 — 토픽 안에서 같은 순번은 하나뿐 (1~3) */
async function readPinnedOrder(
  db: ReturnType<typeof getDb>,
  formData: FormData,
  topicId: number,
  selfId: number | null,
): Promise<{ error?: string; pinnedOrder: number | null }> {
  const raw = String(formData.get("pinnedOrder") ?? "").trim();
  if (!raw) return { pinnedOrder: null };
  const pinnedOrder = parsePinnedOrder(raw);
  if (!pinnedOrder) return { error: "최상단 순번은 1~3 중 하나입니다.", pinnedOrder: null };
  const conds = [eq(guides.topicId, topicId), eq(guides.pinnedOrder, pinnedOrder)];
  if (selfId) conds.push(ne(guides.id, selfId));
  const taken = (await db.select({ id: guides.id, title: guides.title }).from(guides).where(and(...conds)).limit(1))[0];
  if (taken) return { error: `최상단 ${pinnedOrder}번에는 이미 "${taken.title}" 이 고정돼 있습니다. 그 글의 고정을 먼저 풀거나 다른 순번을 고르세요.`, pinnedOrder: null };
  return { pinnedOrder };
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

export interface ActionState {
  error?: string;
  saved?: boolean;
}

// ---------- 로그인 ----------

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const ok = await loginWithToken(token);
  if (!ok) return { error: "토큰이 올바르지 않거나 ADMIN_TOKEN/AUTH_SECRET 이 설정되지 않았습니다." };
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/admin/login");
}

// ---------- 가이드 ----------

export async function saveGuideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };

  const status = readStatus(formData, "draft");
  const medicalAdjacent = formData.get("medicalAdjacent") === "on";
  const vetReviewed = formData.get("vetReviewed") === "on";
  const vetReviewerName = String(formData.get("vetReviewerName") ?? "").trim() || null;

  // 의료 인접 편은 감수 전 발행 불가 — DB CHECK 이전에 명확한 메시지로 막는다 (claude.md 6-2)
  if (status === "published" && medicalAdjacent && !vetReviewed) {
    return { error: "의료 인접 편은 수의사 감수 완료 전에 발행할 수 없습니다. 상태를 '감수 대기'로 두세요." };
  }
  if (vetReviewed && !vetReviewerName) {
    return { error: "감수 완료로 표시하려면 감수 수의사명을 입력하세요 (표기 의무)." };
  }

  const existing = (await db.select().from(guides).where(eq(guides.id, id)).limit(1))[0];
  if (!existing) return { error: "가이드를 찾을 수 없습니다." };

  const cat = await readCategory(db, formData, existing.topicId);
  if (cat.error) return { error: cat.error };
  const pin = await readPinnedOrder(db, formData, existing.topicId, existing.id);
  if (pin.error) return { error: pin.error };
  // 상단 배너 — 토픽 정의에 있는 카테고리만, 정의 순서대로
  const bannerCategories = categoriesForTopic(cat.topicSlug)
    .map((c) => c.slug)
    .filter((slug) => formData.get(`banner:${slug}`) === "on");
  // 고정은 발행된 글만 의미가 있다
  if (pin.pinnedOrder && status !== "published") return { error: "최상단 고정은 발행 상태의 글에만 걸 수 있습니다." };

  const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
  const seoDescription = String(formData.get("seoDescription") ?? "").trim() || null;
  const ogImageKey = String(formData.get("ogImageKey") ?? "").trim() || null;
  const heroImageKey = String(formData.get("heroImageKey") ?? "").trim() || null;
  if (seoTitle && seoTitle.length > 70) return { error: "검색·공유 제목은 70자 이하로 쓰세요." };
  if (seoDescription && seoDescription.length > 200) return { error: "검색·공유 설명은 200자 이하로 쓰세요." };
  if (ogImageKey && !isValidObjectKey(ogImageKey)) return { error: "OG 이미지 키가 올바르지 않습니다." };
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  const publishedAt = status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

  await db
    .update(guides)
    .set({
      title: String(formData.get("title") ?? existing.title).trim() || existing.title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      bodyMd: String(formData.get("bodyMd") ?? existing.bodyMd),
      spokeGroup: String(formData.get("spokeGroup") ?? "").trim() || null,
      role: formData.get("role") === "hub" ? "hub" : "spoke",
      category: cat.category,
      pinnedOrder: pin.pinnedOrder,
      bannerCategories,
      status,
      medicalAdjacent,
      vetReviewed,
      vetReviewerName,
      vetReviewedAt: String(formData.get("vetReviewedAt") ?? "").trim() || null,
      heroImageKey,
      seoTitle,
      seoDescription,
      ogImageKey,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(guides.id, id));

  // 카테고리가 바뀐 경우 이전 게시판도 함께
  if (existing.category) revalidatePath(`/topic/${cat.topicSlug}/${existing.category}`);
  for (const p of await guideRelatedPaths(id)) revalidatePath(p);
  return { saved: true };
}

/** 목록에서 바로 승인(발행) — 회원 글 승인 대기 처리용. 의료 인접 편은 감수 게이트를 그대로 지킨다. */
export async function publishGuideAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (
    await db
      .select({ guide: guides, topicSlug: topics.slug })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .where(eq(guides.id, id))
      .limit(1)
  )[0];
  if (!row) return;
  if (row.guide.medicalAdjacent && !row.guide.vetReviewed) return; // 감수 전 발행 불가 (6-2)
  await db
    .update(guides)
    .set({ status: "published", publishedAt: row.guide.publishedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(guides.id, id));
  for (const p of await guideRelatedPaths(id)) revalidatePath(p);
  revalidatePath("/admin/guides");
}

/**
 * 새 게시글 작성 — 관리자에서 직접 쓰는 블로그형 경로.
 *
 * data/content/guides/*.md 시드와 공존한다. 같은 slug 의 마크다운 파일이
 * 있으면 seed:content 재실행 시 본문이 덮어써지므로, 관리자에서 쓴 글은
 * 마크다운에 없는 slug 를 쓰는 것을 권한다.
 */
export async function createGuideAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireAdminSession();

  const title = String(formData.get("title") ?? "").trim();
  const topicId = Number(formData.get("topicId"));
  if (title.length < 2) return { error: "제목을 입력하세요." };
  if (!Number.isSafeInteger(topicId) || topicId <= 0) return { error: "토픽(클러스터)을 선택하세요." };

  const slug = slugify(String(formData.get("slug") ?? "").trim() || title, "post");
  const dup = await db.select({ id: guides.id }).from(guides).where(eq(guides.slug, slug)).limit(1);
  if (dup[0]) return { error: `슬러그 ${slug} 가 이미 사용 중입니다. 다른 값을 입력하세요.` };

  const medicalAdjacent = formData.get("medicalAdjacent") === "on";
  const status = readStatus(formData, "draft");
  // 의료 인접 편은 감수 완료 전 발행 불가 — 새 글도 같은 게이트를 지난다
  if (status === "published" && medicalAdjacent) {
    return { error: "의료 인접 편은 감수 완료 후에만 발행할 수 있습니다. '감수 대기'로 저장한 뒤 감수자를 등록하세요." };
  }
  const cat = await readCategory(db, formData, topicId);
  if (cat.error) return { error: cat.error };

  const inserted = await db
    .insert(guides)
    .values({
      slug,
      title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      bodyMd: String(formData.get("bodyMd") ?? ""),
      topicId,
      role: formData.get("role") === "hub" ? "hub" : "spoke",
      spokeGroup: String(formData.get("spokeGroup") ?? "").trim() || null,
      category: cat.category,
      status,
      medicalAdjacent,
      publishedAt: status === "published" ? new Date() : null,
    })
    .returning({ id: guides.id });

  revalidatePath("/");
  revalidatePath(`/topic/${cat.topicSlug}`);
  redirect(`/admin/guides/${inserted[0]!.id}?created=1`);
}

// ---------- 태깅 (개체 단위 — claude.md 5-4) ----------

export async function addGuideTagAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireAdminSession();
  const guideId = Number(formData.get("guideId"));
  const kind = String(formData.get("kind") ?? "");
  const refId = Number(formData.get("refId"));
  const contextLabel = String(formData.get("contextLabel") ?? "").trim() || null;
  if (!Number.isSafeInteger(guideId) || !Number.isSafeInteger(refId) || refId <= 0) {
    return { error: "대상을 선택하세요." };
  }

  try {
    if (kind === "item") {
      await db.insert(guideItemTags).values({ guideId, itemId: refId, contextLabel }).onConflictDoNothing();
    } else if (kind === "spot") {
      await db.insert(guideSpotTags).values({ guideId, spotId: refId, contextLabel }).onConflictDoNothing();
    } else if (kind === "maker") {
      await db.insert(guideMakerTags).values({ guideId, makerId: refId, contextLabel }).onConflictDoNothing();
    } else {
      return { error: "알 수 없는 태그 유형" };
    }
  } catch {
    return { error: "태그 추가 실패 — 대상 id 를 확인하세요." };
  }

  const g = (await db.select({ slug: guides.slug }).from(guides).where(eq(guides.id, guideId)).limit(1))[0];
  if (g) revalidatePath(`/guide/${g.slug}`);
  return { saved: true };
}

export async function removeGuideTagAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const guideId = Number(formData.get("guideId"));
  const kind = String(formData.get("kind") ?? "");
  const refId = Number(formData.get("refId"));

  if (kind === "item") {
    await db.delete(guideItemTags).where(and(eq(guideItemTags.guideId, guideId), eq(guideItemTags.itemId, refId)));
  } else if (kind === "spot") {
    await db.delete(guideSpotTags).where(and(eq(guideSpotTags.guideId, guideId), eq(guideSpotTags.spotId, refId)));
  } else if (kind === "maker") {
    await db.delete(guideMakerTags).where(and(eq(guideMakerTags.guideId, guideId), eq(guideMakerTags.makerId, refId)));
  }

  const g = (await db.select({ slug: guides.slug }).from(guides).where(eq(guides.id, guideId)).limit(1))[0];
  if (g) revalidatePath(`/guide/${g.slug}`);
}

// ---------- 클레임 ----------

export async function decideClaimAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision") ?? "");
  if (!Number.isSafeInteger(id) || (decision !== "approved" && decision !== "rejected")) return;

  await db
    .update(claims)
    .set({ status: decision, decidedAt: new Date() })
    .where(eq(claims.id, id));
  revalidatePath("/admin/claims");
}

/** 프로모션 토글 — 장묘(monetizable=false) 유형에는 만들 수 없다 (기획서 4-1) */
export async function togglePromotionAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const spotId = Number(formData.get("spotId"));
  if (!Number.isSafeInteger(spotId)) return;

  const row = (
    await db
      .select({ spot: spots, monetizable: spotTypes.monetizable })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row || !row.monetizable) return; // 장묘 등 비수익화 유형 — 무시

  const active = (
    await db
      .select()
      .from(promotions)
      .where(and(eq(promotions.spotId, spotId), eq(promotions.kind, "region_top"), eq(promotions.active, true)))
  )[0];

  if (active) {
    await db.update(promotions).set({ active: false, updatedAt: new Date() }).where(eq(promotions.id, active.id));
  } else {
    await db.insert(promotions).values({ spotId, kind: "region_top", active: true });
  }
  revalidatePath("/admin/spots");
}

// ---------- 회원 · 댓글 관리 ----------

/** 차단 토글 — 차단하면 session_version 을 올려 기존 로그인이 즉시 끊긴다 */
export async function toggleUserBlockAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const row = (await db.select({ id: users.id, blockedAt: users.blockedAt, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, id)).limit(1))[0];
  if (!row) return;
  await db
    .update(users)
    .set({ blockedAt: row.blockedAt ? null : new Date(), sessionVersion: row.sessionVersion + 1, updatedAt: new Date() })
    .where(eq(users.id, id));
  revalidatePath("/admin/members");
}

async function commentGuideId(db: ReturnType<typeof getDb>, commentId: number): Promise<number | null> {
  const row = (await db.select({ guideId: comments.guideId }).from(comments).where(eq(comments.id, commentId)).limit(1))[0];
  return row?.guideId ?? null;
}

export async function toggleCommentHiddenAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const row = (await db.select({ hiddenAt: comments.hiddenAt, guideId: comments.guideId }).from(comments).where(eq(comments.id, id)).limit(1))[0];
  if (!row) return;
  await db.update(comments).set({ hiddenAt: row.hiddenAt ? null : new Date(), updatedAt: new Date() }).where(eq(comments.id, id));
  for (const p of await guideRelatedPaths(row.guideId)) revalidatePath(p);
  revalidatePath("/admin/comments");
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;
  const guideId = await commentGuideId(db, id);
  await db.delete(comments).where(eq(comments.id, id));
  if (guideId) for (const p of await guideRelatedPaths(guideId)) revalidatePath(p);
  revalidatePath("/admin/comments");
}
