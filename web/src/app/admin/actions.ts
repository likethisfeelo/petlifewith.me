"use server";

// 관리자 서버 액션 — 인증은 lib/auth.ts 만 거친다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession, loginWithToken, logout } from "@/lib/auth";
import { MAX_EXPOSED_PER_AREA, categoriesForTopic, slugify } from "@app/data";
import { isValidObjectKey } from "@/lib/assets";
import { parseMediaRef, sameRef, videoEmbeds } from "@/lib/media-ref";
import { hashtagsIn, mergeTags, parseTagInput, tagHref } from "@/lib/tags";
import { parseAreaOrder, parseCuratedOrder } from "@/lib/guide-order";
import { careRelatedPaths, guideRelatedPaths } from "@/lib/revalidate-paths";
import { countExposedInArea } from "@/lib/queries/care";
import { canPromoteRehabSpot } from "@/lib/queries/devices";

const { guides, topics, users, comments, spots, spotTypes, guideItemTags, guideSpotTags, guideMakerTags, promotions, spotServiceAreas } = schema;

/** 대표 영상(hero_media) — 형식이 맞고 본문에 있는 영상만. 비우면 자동(본문 첫 영상) */
function readHeroMedia(formData: FormData, bodyMd: string): { error?: string; heroMedia: string | null } {
  const raw = String(formData.get("heroMedia") ?? "").trim();
  if (!raw) return { heroMedia: null };
  const ref = parseMediaRef(raw);
  if (!ref) return { error: "대표 영상 값이 올바르지 않습니다.", heroMedia: null };
  if (!videoEmbeds(bodyMd).some((e) => sameRef(e.ref, ref))) return { error: "대표 영상은 본문에 넣은 영상 가운데 골라야 합니다.", heroMedia: null };
  return { heroMedia: raw };
}

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
/** 큐레이션 노출 순서(1~9) — 토픽 안에서 순번은 하나에 글 하나 */
async function readCuratedOrder(
  db: ReturnType<typeof getDb>,
  formData: FormData,
  topicId: number,
  selfId: number | null,
): Promise<{ error?: string; curatedOrder: number | null }> {
  const raw = String(formData.get("curatedOrder") ?? "").trim();
  if (!raw) return { curatedOrder: null };
  const curatedOrder = parseCuratedOrder(raw);
  if (!curatedOrder) return { error: "큐레이션 순번은 1~9 중 하나입니다.", curatedOrder: null };
  const conds = [eq(guides.topicId, topicId), eq(guides.curatedOrder, curatedOrder)];
  if (selfId) conds.push(ne(guides.id, selfId));
  const taken = (await db.select({ id: guides.id, title: guides.title }).from(guides).where(and(...conds)).limit(1))[0];
  if (taken) return { error: `큐레이션 ${curatedOrder}번에는 이미 "${taken.title}" 이 있습니다. 그 글의 순번을 먼저 풀거나 다른 순번을 고르세요.`, curatedOrder: null };
  return { curatedOrder };
}

/** 부위 대표 순번(1~3) — 같은 토픽·카테고리 안에서 순번은 하나에 글 하나 */
async function readAreaOrder(
  db: ReturnType<typeof getDb>,
  formData: FormData,
  topicId: number,
  category: string | null,
  selfId: number | null,
): Promise<{ error?: string; areaOrder: number | null }> {
  const raw = String(formData.get("areaOrder") ?? "").trim();
  if (!raw) return { areaOrder: null };
  const areaOrder = parseAreaOrder(raw);
  if (!areaOrder) return { error: "부위 대표 순번은 1~3 중 하나입니다.", areaOrder: null };
  if (!category) return { error: "부위 대표로 올리려면 먼저 카테고리(위치)를 지정하세요.", areaOrder: null };
  const conds = [eq(guides.topicId, topicId), eq(guides.category, category), eq(guides.areaOrder, areaOrder)];
  if (selfId) conds.push(ne(guides.id, selfId));
  const taken = (await db.select({ id: guides.id, title: guides.title }).from(guides).where(and(...conds)).limit(1))[0];
  if (taken) return { error: `이 부위의 대표 ${areaOrder}번에는 이미 "${taken.title}" 이 있습니다. 그 글의 대표를 먼저 풀거나 다른 순번을 고르세요.`, areaOrder: null };
  return { areaOrder };
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
  const cur = await readCuratedOrder(db, formData, existing.topicId, existing.id);
  if (cur.error) return { error: cur.error };
  const area = await readAreaOrder(db, formData, existing.topicId, cat.category, existing.id);
  if (area.error) return { error: area.error };
  // 순서를 줬으면 큐레이션 노출은 자동으로 켠다 (체크를 빼먹어도 의도는 분명하다)
  const curated = formData.get("curated") === "on" || cur.curatedOrder !== null;
  // 상단 디렉토리 배너 — 공개 스팟 유형만, 정렬 순서대로
  const listedTypes = await db.select({ slug: spotTypes.slug }).from(spotTypes).where(eq(spotTypes.listed, true)).orderBy(spotTypes.sortOrder);
  const bannerSpotTypes = listedTypes.map((t) => t.slug).filter((slug) => formData.get(`banner:${slug}`) === "on");
  // 순번은 발행된 글만 의미가 있다
  if ((cur.curatedOrder || area.areaOrder) && status !== "published") return { error: "큐레이션 순서·부위 대표는 발행 상태의 글에만 걸 수 있습니다." };

  const seoTitle = String(formData.get("seoTitle") ?? "").trim() || null;
  const seoDescription = String(formData.get("seoDescription") ?? "").trim() || null;
  const ogImageKey = String(formData.get("ogImageKey") ?? "").trim() || null;
  const heroImageKey = String(formData.get("heroImageKey") ?? "").trim() || null;
  if (seoTitle && seoTitle.length > 70) return { error: "검색·공유 제목은 70자 이하로 쓰세요." };
  if (seoDescription && seoDescription.length > 200) return { error: "검색·공유 설명은 200자 이하로 쓰세요." };
  if (ogImageKey && !isValidObjectKey(ogImageKey)) return { error: "OG 이미지 키가 올바르지 않습니다." };
  if (heroImageKey && !isValidObjectKey(heroImageKey)) return { error: "대표 이미지 키가 올바르지 않습니다." };

  const bodyMd = String(formData.get("bodyMd") ?? existing.bodyMd);
  const hero = readHeroMedia(formData, bodyMd);
  if (hero.error) return { error: hero.error };
  // 태그 칸 + 본문 #태그
  const tags = mergeTags(parseTagInput(String(formData.get("tags") ?? "")), hashtagsIn(bodyMd));

  const publishedAt = status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

  await db
    .update(guides)
    .set({
      title: String(formData.get("title") ?? existing.title).trim() || existing.title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      bodyMd,
      heroMedia: hero.heroMedia,
      tags,
      spokeGroup: String(formData.get("spokeGroup") ?? "").trim() || null,
      role: formData.get("role") === "hub" ? "hub" : "spoke",
      category: cat.category,
      curated,
      curatedOrder: cur.curatedOrder,
      areaOrder: area.areaOrder,
      bannerSpotTypes,
      status,
      medicalAdjacent,
      vetReviewed,
      vetReviewerName,
      vetReviewedAt: String(formData.get("vetReviewedAt") ?? "").trim() || null,
      // 협찬사 — 적혀 있으면 글과 기기 페이지에 "광고·협찬" 표기가 붙는다 (표시광고법)
      sponsorName: String(formData.get("sponsorName") ?? "").trim().slice(0, 80) || null,
      heroImageKey,
      seoTitle,
      seoDescription,
      ogImageKey,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(guides.id, id));

  for (const t of new Set([...existing.tags, ...tags])) revalidatePath(tagHref(t));
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
  const bodyMd = String(formData.get("bodyMd") ?? "");
  const hero = readHeroMedia(formData, bodyMd);
  if (hero.error) return { error: hero.error };
  const tags = mergeTags(parseTagInput(String(formData.get("tags") ?? "")), hashtagsIn(bodyMd));

  const inserted = await db
    .insert(guides)
    .values({
      slug,
      title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      bodyMd,
      heroMedia: hero.heroMedia,
      tags,
      topicId,
      // 운영진이 쓴 글은 큐레이션 콘텐츠가 기본 (편집 화면에서 끌 수 있다)
      curated: true,
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

/** 프로모션 토글 — 장묘(monetizable=false) 유형에는 만들 수 없다 (기획서 4-1) */
export async function togglePromotionAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const spotId = Number(formData.get("spotId"));
  if (!Number.isSafeInteger(spotId)) return;

  const row = (
    await db
      .select({ spot: spots, monetizable: spotTypes.monetizable, typeSlug: spotTypes.slug })
      .from(spots)
      .innerJoin(spotTypes, eq(spots.typeId, spotTypes.id))
      .where(eq(spots.id, spotId))
      .limit(1)
  )[0];
  if (!row || !row.monetizable) return; // 장묘 등 비수익화 유형 — 무시
  // 운동·재활: 재활·특수 훈련 장비를 등록한 곳만 유료 상단 노출. 동물병원은 제외 (claude.md 6-2)
  if (row.typeSlug === "rehab" && !(await canPromoteRehabSpot(spotId))) return;

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

// ---------- 돌봄 파트너: 지역별 노출 ON/OFF · 예약 신청 처리 ----------

/** 관리자 > 돌봄 파트너 화면의 토글. 켤 때는 지역 x 유형 자리 상한을 검사하고, 차 있으면 안내로 돌아간다. */
export async function toggleServiceAreaExposureAction(formData: FormData): Promise<void> {
  const db = await requireAdminSession();
  const spotId = Number(formData.get("spotId"));
  const regionId = Number(formData.get("regionId"));
  const back = typeof formData.get("back") === "string" ? String(formData.get("back")) : "/admin/care";
  if (!Number.isSafeInteger(spotId) || !Number.isSafeInteger(regionId)) return;
  const row = (
    await db
      .select({ exposed: spotServiceAreas.exposed, typeId: spots.typeId })
      .from(spotServiceAreas)
      .innerJoin(spots, eq(spotServiceAreas.spotId, spots.id))
      .where(and(eq(spotServiceAreas.spotId, spotId), eq(spotServiceAreas.regionId, regionId)))
      .limit(1)
  )[0];
  if (!row) return;
  if (!row.exposed) {
    const taken = await countExposedInArea(row.typeId, regionId, spotId);
    if (taken >= MAX_EXPOSED_PER_AREA) {
      const sep = back.includes("?") ? "&" : "?";
      redirect(`${back}${sep}notice=full&region=${regionId}`);
    }
  }
  await db
    .update(spotServiceAreas)
    .set({ exposed: !row.exposed, updatedAt: new Date() })
    .where(and(eq(spotServiceAreas.spotId, spotId), eq(spotServiceAreas.regionId, regionId)));
  for (const p of await careRelatedPaths(spotId)) revalidatePath(p);
  revalidatePath("/admin/care");
}

