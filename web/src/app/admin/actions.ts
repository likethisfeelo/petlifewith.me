"use server";

// 관리자 서버 액션 — 인증은 lib/auth.ts 만 거친다.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession, loginWithToken, logout } from "@/lib/auth";

const { guides, claims, spots, spotTypes, guideItemTags, guideSpotTags, guideMakerTags, promotions } = schema;

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

  const status = String(formData.get("status") ?? "draft") as "draft" | "review_pending" | "published" | "archived";
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

  const publishedAt = status === "published" ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

  await db
    .update(guides)
    .set({
      title: String(formData.get("title") ?? existing.title).trim() || existing.title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      bodyMd: String(formData.get("bodyMd") ?? existing.bodyMd),
      spokeGroup: String(formData.get("spokeGroup") ?? "").trim() || null,
      role: formData.get("role") === "hub" ? "hub" : "spoke",
      status,
      medicalAdjacent,
      vetReviewed,
      vetReviewerName,
      vetReviewedAt: String(formData.get("vetReviewedAt") ?? "").trim() || null,
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(guides.id, id));

  revalidatePath(`/guide/${existing.slug}`);
  revalidatePath("/");
  return { saved: true };
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

// ---------- 스팟 (에디토리얼 보강 — noindex 게이트 통과 수단) ----------

export async function saveSpotAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const db = await requireAdminSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return { error: "잘못된 요청" };

  const existing = (await db.select().from(spots).where(eq(spots.id, id)).limit(1))[0];
  if (!existing) return { error: "스팟을 찾을 수 없습니다." };

  const typeId = Number(formData.get("typeId") ?? existing.typeId);
  const str = (name: string) => String(formData.get(name) ?? "").trim() || null;

  await db
    .update(spots)
    .set({
      typeId: Number.isSafeInteger(typeId) && typeId > 0 ? typeId : existing.typeId,
      status: String(formData.get("status") ?? existing.status) as typeof existing.status,
      descriptionMd: str("descriptionMd"),
      hoursText: str("hoursText"),
      priceText: str("priceText"),
      parkingText: str("parkingText"),
      reservationUrl: str("reservationUrl"),
      homepageUrl: str("homepageUrl"),
      instagramUrl: str("instagramUrl"),
      phone: str("phone"),
      updatedAt: new Date(),
    })
    .where(eq(spots.id, id));

  revalidatePath(`/place/${id}-${existing.slug}`);
  return { saved: true };
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
