"use client";

// 클라이언트 업로드 헬퍼 — presign → S3 직접 PUT → 등록. 관리자·회원 공용 (서버 액션 app/upload-actions.ts).
// 영상은 등록 전에 포스터(첫 화면)를 잡아 이미지 자산으로 먼저 올리고, 길이와 함께 등록한다.
// 구간 자르기는 호출자가 미리 끝낸다 (components/media/use-media-uploader.tsx 의 자르기 대화상자).
import { presignUploadAction, registerUploadAction } from "@/app/upload-actions";
import { mediaKindOf } from "./media";
import { captureVideoPoster, probeVideo } from "./video-tools";

export interface UploadedMedia {
  objectKey: string;
  kind: "image" | "video";
  /** 영상이면 포스터 이미지 키 (잡지 못했으면 null) */
  posterKey: string | null;
  durationSec: number | null;
}

async function measureImage(file: Blob): Promise<{ width?: number; height?: number }> {
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

async function putToStorage(file: Blob, contentType: string, fileName: string, sizeBytes: number): Promise<string> {
  const presign = await presignUploadAction({ fileName, contentType, sizeBytes });
  if (presign.error || !presign.uploadUrl || !presign.objectKey) throw new Error(presign.error ?? "업로드 URL 발급 실패");
  const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  if (!put.ok) throw new Error(`스토리지 업로드 실패 (${put.status}). 잠시 후 다시 시도해 주세요.`);
  return presign.objectKey;
}

export interface UploadOptions {
  /** 영상 포스터를 잡을 시점(초). 기본 0.5초 */
  posterAtSec?: number;
  onStage?: (stage: "poster" | "upload" | "register") => void;
}

/** 파일 하나를 업로드하고 등록까지 마친다. 실패 시 Error 를 던진다. */
export async function uploadMediaFile(file: File, opts: UploadOptions = {}): Promise<UploadedMedia> {
  const kind = mediaKindOf(file.type);
  if (!kind) throw new Error(`지원하지 않는 형식입니다: ${file.type || "알 수 없음"}`);

  let posterKey: string | null = null;
  let durationSec: number | null = null;
  if (kind === "video") {
    opts.onStage?.("poster");
    try {
      durationSec = (await probeVideo(file)).durationSec || null;
    } catch {
      durationSec = null;
    }
    const poster = await captureVideoPoster(file, opts.posterAtSec ?? 0.5);
    if (poster) {
      const posterName = `${file.name.replace(/\.[^.]+$/, "") || "video"}-poster.jpg`;
      const key = await putToStorage(poster, "image/jpeg", posterName, poster.size);
      const dims = await measureImage(poster);
      const reg = await registerUploadAction({ objectKey: key, contentType: "image/jpeg", sizeBytes: poster.size, originalName: posterName, ...dims });
      if (!reg.error && reg.asset) posterKey = reg.asset.objectKey;
    }
  }

  opts.onStage?.("upload");
  const objectKey = await putToStorage(file, file.type, file.name, file.size);
  const dims = await measureImage(file);
  opts.onStage?.("register");
  const registered = await registerUploadAction({
    objectKey,
    contentType: file.type,
    sizeBytes: file.size,
    originalName: file.name,
    ...dims,
    posterKey,
    durationSec,
  });
  if (registered.error || !registered.asset) throw new Error(registered.error ?? "등록 실패");
  return { objectKey: registered.asset.objectKey, kind, posterKey, durationSec };
}
