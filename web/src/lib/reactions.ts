// ============================================================
// 저장·좋아요 — 대상 종류·라벨 (순수). DB 는 lib/queries/reactions.ts, 액션은 app/reaction-actions.ts.
// 저장(save)은 모든 대상에 붙는 본인만 보는 북마크. 좋아요(like)는 게시글에만 두고 수를 공개한다 —
// 업체·파트너·상품에 공개 숫자를 붙이면 순위·평점 금지 규정(claude.md 6-2, 돌봄 파트너 5-8)과 충돌한다.
// ============================================================

export const REACTION_TARGETS = ["guide", "spot", "maker", "item", "meetup"] as const;
export type ReactionTarget = (typeof REACTION_TARGETS)[number];
export const REACTION_KINDS = ["save", "like"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_TARGET_LABEL: Record<ReactionTarget, string> = {
  guide: "게시글",
  spot: "업체·파트너",
  maker: "브랜드",
  item: "상품",
  meetup: "모임",
};

export function isReactionTarget(v: unknown): v is ReactionTarget {
  return typeof v === "string" && (REACTION_TARGETS as readonly string[]).includes(v);
}

export function isReactionKind(v: unknown): v is ReactionKind {
  return typeof v === "string" && (REACTION_KINDS as readonly string[]).includes(v);
}

/** 좋아요를 받을 수 있는 대상 — 게시글뿐 */
export function allowsLike(target: ReactionTarget): boolean {
  return target === "guide";
}

/** "guide:12" 형식의 키 — 클라이언트가 상태를 물을 때 쓴다 */
export function reactionKey(target: ReactionTarget, id: number): string {
  return `${target}:${id}`;
}

export function parseReactionKey(key: string): { target: ReactionTarget; id: number } | null {
  const [t, idRaw] = key.split(":");
  const id = Number(idRaw);
  if (!isReactionTarget(t) || !Number.isSafeInteger(id) || id <= 0) return null;
  return { target: t, id };
}
