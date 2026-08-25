// 미디어 업로드 제약 — 서버(presign 검증)와 클라이언트(사전 안내)가 공유한다.

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB

export type MediaKind = "image" | "video";

export function mediaKindOf(mimeType: string): MediaKind | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) return "video";
  return null;
}

export function maxBytesFor(kind: MediaKind): number {
  return kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}
