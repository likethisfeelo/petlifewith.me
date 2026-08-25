"use server";

// 미디어 업로드 서버 액션 — presigned URL 발급 → 클라이언트가 S3 에 직접 PUT →
// 완료 등록. 서버는 파일 본문을 만지지 않는다 (claude.md 10-1).
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createUploadUrl, deleteObject, isStorageConfigured } from "@/lib/storage";
import { isValidObjectKey } from "@/lib/assets";
import { formatBytes, maxBytesFor, mediaKindOf } from "@/lib/media";

const { mediaAssets } = schema;

async function requireDb() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!isDbConfigured()) throw new Error("DATABASE_URL 미설정");
  return getDb();
}

export interface PresignResult {
  error?: string;
  uploadUrl?: string;
  objectKey?: string;
}

/** 업로드 URL 발급 — 종류·용량을 여기서 먼저 거른다. */
export async function presignMediaUploadAction(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<PresignResult> {
  await requireDb();
  if (!isStorageConfigured()) {
    return { error: "스토리지가 설정되지 않았습니다. .env.local 의 STORAGE_* 와 NEXT_PUBLIC_ASSET_BASE_URL 을 채우세요 (로컬은 MinIO — docs/운영.md)." };
  }

  const kind = mediaKindOf(input.contentType);
  if (!kind) {
    return { error: `지원하지 않는 형식입니다: ${input.contentType}. 이미지(jpg/png/webp/gif/avif) 또는 영상(mp4/webm)만 올릴 수 있습니다.` };
  }
  const max = maxBytesFor(kind);
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return { error: "파일 크기를 확인할 수 없습니다." };
  if (input.sizeBytes > max) {
    return { error: `파일이 너무 큽니다 (${formatBytes(input.sizeBytes)}). ${kind === "image" ? "이미지" : "영상"} 최대 ${formatBytes(max)}.` };
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

/** 업로드 완료 등록 — media_assets 에 기록해야 라이브러리에 보인다. */
export async function registerMediaAction(input: {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  originalName: string;
  width?: number;
  height?: number;
}): Promise<RegisterResult> {
  const db = await requireDb();
  const kind = mediaKindOf(input.contentType);
  if (!kind) return { error: "지원하지 않는 형식입니다." };
  if (!isValidObjectKey(input.objectKey) || !input.objectKey.startsWith(`media/${kind}/`)) {
    return { error: "오브젝트 키가 올바르지 않습니다." };
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
    })
    .onConflictDoNothing({ target: mediaAssets.objectKey })
    .returning({ id: mediaAssets.id, objectKey: mediaAssets.objectKey });

  const asset = inserted[0] ?? undefined;
  if (!asset) return { error: "이미 등록된 키입니다." };
  revalidatePath("/admin/media");
  return { asset };
}

/** 자산 삭제 — DB 행과 S3 오브젝트를 함께 지운다. 본문에서 쓰던 키는 깨진다. */
export async function deleteMediaAction(formData: FormData): Promise<void> {
  const db = await requireDb();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id)) return;

  const row = (await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1))[0];
  if (!row) return;

  await deleteObject(row.objectKey);
  await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  revalidatePath("/admin/media");
}

export async function listMediaAssets(limit = 100) {
  const db = await requireDb();
  return db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(limit);
}
