"use server";

// 미디어 업로드 서버 액션 — 관리자와 회원이 같이 쓴다.
// presigned URL 발급 → 브라우저가 S3 에 직접 PUT → 완료 등록. 서버는 파일 본문을 만지지 않는다 (claude.md 10-1).
//  - 관리자(세션): 시스템 상한(lib/media.ts)만.
//  - 회원(로그인): 관리자 설정(lib/settings.ts member_media)의 용량 상한 + 시간당 업로드 수 제한. 자산에 uploader_user_id 가 남는다.
//  - 영상은 포스터(첫 화면) 이미지 키와 길이를 함께 등록한다 — 카드 섬네일과 길이 상한 검사에 쓴다.
import { revalidatePath } from "@/lib/cdn";
import { and, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getCurrentMember } from "@/lib/member";
import { createUploadUrl, isStorageConfigured } from "@/lib/storage";
import { isValidObjectKey } from "@/lib/assets";
import { formatBytes, mediaKindOf } from "@/lib/media";
import { MAX_UPLOADS_PER_HOUR } from "@/lib/member-limits";
import { uploadPolicyFor } from "@/lib/settings";
import { getMemberMediaSettings } from "@/lib/queries/settings";
import { countRecentUploadsByUser } from "@/lib/queries/media";

const { mediaAssets } = schema;

type Actor = { kind: "admin" } | { kind: "member"; id: string };

async function resolveActor(): Promise<Actor | null> {
  if (await getSession()) return { kind: "admin" };
  const member = await getCurrentMember();
  return member ? { kind: "member", id: member.id } : null;
}


export interface PresignResult {
  error?: string;
  uploadUrl?: string;
  objectKey?: string;
}

/** 업로드 URL 발급 — 종류·용량을 여기서 먼저 거른다. */
export async function presignUploadAction(input: { fileName: string; contentType: string; sizeBytes: number }): Promise<PresignResult> {
  const actor = await resolveActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  if (!isStorageConfigured()) {
    return { error: "스토리지가 설정되지 않았습니다. .env.local 의 STORAGE_* 와 NEXT_PUBLIC_ASSET_BASE_URL 을 채우세요 (로컬은 MinIO — docs/운영.md)." };
  }
  const kind = mediaKindOf(input.contentType);
  if (!kind) return { error: `지원하지 않는 형식입니다: ${input.contentType}. 이미지(jpg/png/webp/gif/avif) 또는 영상(mp4/webm)만 올릴 수 있습니다.` };
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return { error: "파일 크기를 확인할 수 없습니다." };

  const policy = uploadPolicyFor(actor.kind, await getMemberMediaSettings());
  const max = kind === "image" ? policy.maxImageBytes : policy.maxVideoBytes;
  if (input.sizeBytes > max) {
    return { error: `파일이 너무 큽니다 (${formatBytes(input.sizeBytes)}). ${kind === "image" ? "이미지" : "영상"} 최대 ${formatBytes(max)}.` };
  }
  if (actor.kind === "member") {
    const recent = await countRecentUploadsByUser(actor.id, 60 * 60 * 1000);
    if (recent >= MAX_UPLOADS_PER_HOUR) return { error: "한 시간 안에 올릴 수 있는 파일 수를 넘었습니다. 잠시 후 다시 시도해 주세요." };
  }

  const { uploadUrl, objectKey } = await createUploadUrl({
    keyPrefix: `media/${kind}`,
    fileName: input.fileName,
    contentType: input.contentType,
  });
  return { uploadUrl, objectKey };
}

export interface RegisterResult {
  error?: string;
  asset?: { id: number; objectKey: string };
}

/** 업로드 완료 등록 — media_assets 에 기록해야 본문에서 쓸 수 있다. 영상은 포스터 키·길이를 같이 받는다. */
export async function registerUploadAction(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  originalName: string;
  width?: number;
  height?: number;
  posterKey?: string | null;
  durationSec?: number | null;
}): Promise<RegisterResult> {
  const actor = await resolveActor();
  if (!actor) return { error: "로그인이 필요합니다." };
  if (!isDbConfigured()) return { error: "저장소가 설정되지 않았습니다." };
  const db = getDb();
  const kind = mediaKindOf(input.contentType);
  if (!kind) return { error: "지원하지 않는 형식입니다." };
  if (!isValidObjectKey(input.objectKey) || !input.objectKey.startsWith(`media/${kind}/`)) return { error: "오브젝트 키가 올바르지 않습니다." };

  const uploaderUserId = actor.kind === "member" ? actor.id : null;
  let posterKey: string | null = null;
  let durationSec: number | null = null;
  if (kind === "video") {
    if (input.posterKey) {
      if (!isValidObjectKey(input.posterKey) || !input.posterKey.startsWith("media/image/")) return { error: "포스터 키가 올바르지 않습니다." };
      // 포스터는 같은 사람이 방금 올린 이미지 자산이어야 한다
      const conds = [eq(mediaAssets.objectKey, input.posterKey), eq(mediaAssets.kind, "image")];
      if (uploaderUserId) conds.push(eq(mediaAssets.uploaderUserId, uploaderUserId));
      const poster = (await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(...conds)).limit(1))[0];
      if (!poster) return { error: "포스터 이미지를 찾을 수 없습니다." };
      posterKey = input.posterKey;
    }
    if (typeof input.durationSec === "number" && Number.isFinite(input.durationSec) && input.durationSec > 0) {
      durationSec = Math.round(input.durationSec);
      const s = await getMemberMediaSettings();
      // 자르기는 브라우저에서 하지만, 상한을 훌쩍 넘긴 길이는 등록도 막는다.
      // 복사 자르기는 키프레임 경계까지 넓히므로(폰 영상은 보통 1~8초 간격) 10초 여유를 둔다
      if (s.maxVideoSeconds > 0 && durationSec > s.maxVideoSeconds + 10) {
        return { error: `영상은 ${Math.round(s.maxVideoSeconds / 60)}분 이내로 잘라서 올려 주세요.` };
      }
    }
  }

  const inserted = await db
    .insert(mediaAssets)
    .values({
      objectKey: input.objectKey,
      kind,
      mimeType: input.contentType,
      sizeBytes: Math.round(input.sizeBytes),
      width: Number.isInteger(input.width) && input.width! > 0 ? input.width! : null,
      height: Number.isInteger(input.height) && input.height! > 0 ? input.height! : null,
      originalName: input.originalName.slice(0, 200) || null,
      posterKey,
      durationSec,
      uploaderUserId,
    })
    .onConflictDoNothing({ target: mediaAssets.objectKey })
    .returning({ id: mediaAssets.id, objectKey: mediaAssets.objectKey });

  const asset = inserted[0] ?? undefined;
  if (!asset) return { error: "이미 등록된 키입니다." };
  if (actor.kind === "admin") revalidatePath("/admin/media");
  return { asset };
}
