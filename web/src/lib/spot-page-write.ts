// 링크 페이지 행 만들기 — 등록 요청으로 업체를 만들거나 소유자를 연결할 때 무료 페이지를 함께 연다 (서버 전용)
import { schema } from "./db";
import type { getDb } from "./db";

/** 페이지가 없으면 무료(공개)로 만든다. 이미 있으면 그대로 둔다 */
export async function ensureSpotPage(db: ReturnType<typeof getDb>, spotId: number): Promise<void> {
  await db.insert(schema.spotPages).values({ spotId }).onConflictDoNothing({ target: schema.spotPages.spotId });
}
