"use server";

// 공개 글 페이지의 관리자 버튼(components/admin-guide-bar.tsx) — 보관 · 반려 · 삭제.
// 관리자 패널에 들어가지 않고 사이트를 보다가 바로 처리하는 경로다. 인증은 lib/auth.ts 의 관리자 세션만.
//   보관: status → archived. 공개에서 내려가고 관리자 게시글 목록에 남는다(언제든 다시 발행).
//   반려: 회원 글만. status → draft. 회원은 /me/posts 에서 "반려됨"으로 보고 고쳐 다시 올리거나 지운다.
//   삭제: 행 삭제(태그·댓글은 FK cascade, 좋아요·저장은 여기서 함께 지운다). 되돌릴 수 없다.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { guideRelatedPaths } from "@/lib/revalidate-paths";

const { guides, topics, reactions } = schema;

export type GuideModerationOp = "archive" | "reject" | "delete";

export interface GuideModerationResult {
  error?: string;
  /** 처리 뒤 이동할 곳 — 글이 공개에서 내려가므로 토픽 페이지로 보낸다 */
  redirectTo?: string;
}

export async function moderateGuideAction(id: number, op: GuideModerationOp): Promise<GuideModerationResult> {
  if (!(await getSession())) return { error: "관리자 로그인이 필요합니다." };
  if (!isDbConfigured()) return { error: "DATABASE_URL 미설정" };
  if (!Number.isSafeInteger(id) || !["archive", "reject", "delete"].includes(op)) return { error: "잘못된 요청" };

  const db = getDb();
  const row = (
    await db
      .select({ id: guides.id, authorUserId: guides.authorUserId, topicSlug: topics.slug })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .where(eq(guides.id, id))
      .limit(1)
  )[0];
  if (!row) return { error: "글을 찾을 수 없습니다." };
  if (op === "reject" && !row.authorUserId) return { error: "반려는 회원 글에만 쓸 수 있습니다. 운영진 글은 보관하세요." };

  // 삭제하면 행이 사라져 경로를 못 구하므로 먼저 모아 둔다
  const paths = await guideRelatedPaths(id);

  if (op === "delete") {
    await db.delete(reactions).where(and(eq(reactions.targetType, "guide"), eq(reactions.targetId, id)));
    await db.delete(guides).where(eq(guides.id, id));
  } else {
    await db
      .update(guides)
      .set({
        status: op === "archive" ? "archived" : "draft",
        // 큐레이션 순번·부위 대표는 발행 글에만 — 자리를 비워 다른 글이 쓸 수 있게 한다
        curatedOrder: null,
        areaOrder: null,
        updatedAt: new Date(),
      })
      .where(eq(guides.id, id));
  }

  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin/guides");
  revalidatePath("/admin");
  return { redirectTo: `/topic/${row.topicSlug}` };
}
