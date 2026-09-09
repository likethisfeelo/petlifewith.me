// 미디어 자산 조회 — 포스터(영상 첫 화면) 찾기, 본문이 참조한 자산의 존재·소유 검사.
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "../db";

const { mediaAssets } = schema;

/** 업로드 영상 키 → 포스터 이미지 키 (없으면 null). 카드 섬네일용 */
export async function listPostersForKeys(keys: string[]): Promise<Record<string, string | null>> {
  const uniq = [...new Set(keys)];
  if (uniq.length === 0 || !isDbConfigured()) return {};
  const rows = await getDb()
    .select({ objectKey: mediaAssets.objectKey, posterKey: mediaAssets.posterKey })
    .from(mediaAssets)
    .where(inArray(mediaAssets.objectKey, uniq));
  return Object.fromEntries(rows.map((r) => [r.objectKey, r.posterKey]));
}

export interface OwnedAsset {
  objectKey: string;
  kind: "image" | "video";
  uploaderUserId: string | null;
}

/** 키 목록의 자산 (등록된 것만) — 회원 글 검사용 */
export async function findAssetsByKeys(keys: string[]): Promise<OwnedAsset[]> {
  const uniq = [...new Set(keys)];
  if (uniq.length === 0 || !isDbConfigured()) return [];
  return getDb()
    .select({ objectKey: mediaAssets.objectKey, kind: mediaAssets.kind, uploaderUserId: mediaAssets.uploaderUserId })
    .from(mediaAssets)
    .where(inArray(mediaAssets.objectKey, uniq));
}

/** 회원이 최근 한 시간에 등록한 자산 수 (업로드 남용 제한) */
export async function countRecentUploadsByUser(userId: string, sinceMs: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  const row = (
    await getDb()
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.uploaderUserId, userId), gt(mediaAssets.createdAt, new Date(Date.now() - sinceMs))))
  )[0];
  return row?.count ?? 0;
}
