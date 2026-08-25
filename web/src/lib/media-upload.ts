"use client";

// 클라이언트 업로드 헬퍼 — presign → S3 직접 PUT → 등록.
// 서버 액션은 admin/media-actions.ts, 여기는 브라우저 쪽 절차만 담는다.
import { presignMediaUploadAction, registerMediaAction } from "@/app/admin/media-actions";
import { mediaKindOf } from "./media";

export interface UploadedMedia {
  objectKey: string;
  kind: "image" | "video";
}

async function measureImage(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  try {
    const url = URL.createObjectURL(file);
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
    URL.revokeObjectURL(url);
    return size;
  } catch {
    return {};
  }
}

/** 파일 하나를 업로드하고 등록까지 마친다. 실패 시 Error 를 던진다. */
export async function uploadMediaFile(file: File): Promise<UploadedMedia> {
  const kind = mediaKindOf(file.type);
  if (!kind) throw new Error(`지원하지 않는 형식입니다: ${file.type || "알 수 없음"}`);

  const presign = await presignMediaUploadAction({
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (presign.error || !presign.uploadUrl || !presign.objectKey) {
    throw new Error(presign.error ?? "업로드 URL 발급 실패");
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`스토리지 업로드 실패 (${put.status}). MinIO/S3 가 켜져 있는지 확인하세요.`);
  }

  const dims = await measureImage(file);
  const registered = await registerMediaAction({
    objectKey: presign.objectKey,
    contentType: file.type,
    sizeBytes: file.size,
    originalName: file.name,
    ...dims,
  });
  if (registered.error || !registered.asset) throw new Error(registered.error ?? "등록 실패");

  return { objectKey: registered.asset.objectKey, kind };
}
