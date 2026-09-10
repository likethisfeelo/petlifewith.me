"use server";

// 저장·좋아요·연락 기록 — 클라이언트 컴포넌트가 RPC 로 부른다 (공개 페이지는 ISR 이라 서버 렌더에서 쿠키를 읽지 않는다).
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getCurrentMember } from "@/lib/member";
import { allowsLike, isReactionKind, parseReactionKey, reactionKey, type ReactionKind } from "@/lib/reactions";
import { getReactionState, type ReactionState } from "@/lib/queries/reactions";

const { reactions, contactLogs, spots, makers } = schema;

/** 여러 대상의 내 상태 + 공개 좋아요 수. 비회원이면 mine 은 비고 loggedIn=false */
export async function getReactionStateAction(keys: string[]): Promise<ReactionState & { loggedIn: boolean }> {
  const member = await getCurrentMember();
  const targets = keys.slice(0, 50).map(parseReactionKey).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const state = await getReactionState(member?.id ?? null, targets);
  return { ...state, loggedIn: Boolean(member) };
}

export type ToggleResult = { ok: true; active: boolean; likes: number } | { ok: false; error: "login" | "invalid" };

/** 저장·좋아요 토글 — 없으면 넣고 있으면 뺀다 */
export async function toggleReactionAction(key: string, kindRaw: string): Promise<ToggleResult> {
  const member = await getCurrentMember();
  if (!member) return { ok: false, error: "login" };
  const target = parseReactionKey(key);
  if (!target || !isReactionKind(kindRaw) || !isDbConfigured()) return { ok: false, error: "invalid" };
  const kind: ReactionKind = kindRaw;
  if (kind === "like" && !allowsLike(target.target)) return { ok: false, error: "invalid" };
  const db = getDb();
  const where = and(eq(reactions.userId, member.id), eq(reactions.targetType, target.target), eq(reactions.targetId, target.id), eq(reactions.kind, kind));
  const existing = (await db.select({ id: reactions.id }).from(reactions).where(where).limit(1))[0];
  let active: boolean;
  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    active = false;
  } else {
    await db.insert(reactions).values({ userId: member.id, targetType: target.target, targetId: target.id, kind }).onConflictDoNothing();
    active = true;
  }
  const state = await getReactionState(null, [target]);
  return { ok: true, active, likes: state.likes[reactionKey(target.target, target.id)] ?? 0 };
}

/** 업체·브랜드 외부 채널 클릭 기록 — 로그인 회원만, 실패해도 조용히 */
export async function logContactAction(input: { spotId?: number; makerId?: number; channel: string }): Promise<void> {
  const member = await getCurrentMember();
  if (!member || !isDbConfigured()) return;
  const channel = String(input.channel ?? "").slice(0, 30);
  if (!channel) return;
  const db = getDb();
  if (input.spotId && Number.isSafeInteger(input.spotId)) {
    const s = (await db.select({ id: spots.id }).from(spots).where(eq(spots.id, input.spotId)).limit(1))[0];
    if (s) await db.insert(contactLogs).values({ userId: member.id, spotId: s.id, channel });
  } else if (input.makerId && Number.isSafeInteger(input.makerId)) {
    const m = (await db.select({ id: makers.id }).from(makers).where(eq(makers.id, input.makerId)).limit(1))[0];
    if (m) await db.insert(contactLogs).values({ userId: member.id, makerId: m.id, channel });
  }
}
