// ============================================================
// 사이트 설정 — 관리자가 화면(/admin/settings)에서 바꾸는 운영값. DB 없음 (순수 기본값·정규화).
// 저장은 site_settings(key, value jsonb) 한 행 (lib/queries/settings.ts).
//
// member_media: 회원 미디어 업로드 한도와 승인 대기. 0 은 "제한 없음"(용량은 시스템 상한 lib/media.ts 까지).
// 처음에는 제한 없음으로 두고, 무리가 가면 관리자가 조인다.
// ============================================================
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "./media";

export const MEMBER_MEDIA_KEY = "member_media";

export interface MemberMediaSettings {
  /** 글 하나에 넣을 수 있는 업로드 이미지 수 (0 = 제한 없음) */
  maxImagesPerPost: number;
  /** 글 하나에 넣을 수 있는 업로드 영상 수 (0 = 제한 없음) */
  maxVideosPerPost: number;
  /** 이미지 한 장 최대 바이트 (0 = 시스템 상한 15MB) */
  maxImageBytes: number;
  /** 영상 한 편 최대 바이트 (0 = 시스템 상한 300MB) */
  maxVideoBytes: number;
  /** 영상 최대 길이(초) — 업로드 전에 브라우저에서 이 길이 안으로 자른다. 0 = 제한 없음. 관리자 업로드에도 적용 */
  maxVideoSeconds: number;
  /** 회원 글 승인 대기 — true 면 관리자가 승인해야 공개, false 면 저장 즉시 공개 */
  requireApproval: boolean;
}

export const DEFAULT_MEMBER_MEDIA: MemberMediaSettings = {
  maxImagesPerPost: 0,
  maxVideosPerPost: 0,
  maxImageBytes: 0,
  maxVideoBytes: 0,
  maxVideoSeconds: 180,
  requireApproval: true,
};

function nonNegInt(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** 저장된 JSON(부분·불량 허용) → 완전한 설정 */
export function normalizeMemberMedia(raw: unknown): MemberMediaSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    maxImagesPerPost: nonNegInt(o.maxImagesPerPost, DEFAULT_MEMBER_MEDIA.maxImagesPerPost),
    maxVideosPerPost: nonNegInt(o.maxVideosPerPost, DEFAULT_MEMBER_MEDIA.maxVideosPerPost),
    maxImageBytes: Math.min(nonNegInt(o.maxImageBytes, DEFAULT_MEMBER_MEDIA.maxImageBytes), MAX_IMAGE_BYTES),
    maxVideoBytes: Math.min(nonNegInt(o.maxVideoBytes, DEFAULT_MEMBER_MEDIA.maxVideoBytes), MAX_VIDEO_BYTES),
    maxVideoSeconds: nonNegInt(o.maxVideoSeconds, DEFAULT_MEMBER_MEDIA.maxVideoSeconds),
    requireApproval: typeof o.requireApproval === "boolean" ? o.requireApproval : DEFAULT_MEMBER_MEDIA.requireApproval,
  };
}

/** 실제 적용 바이트 상한 — 0 이면 시스템 상한 */
export function effectiveMaxBytes(kind: "image" | "video", s: MemberMediaSettings): number {
  const sys = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const set = kind === "image" ? s.maxImageBytes : s.maxVideoBytes;
  return set > 0 ? Math.min(set, sys) : sys;
}

/** 본문의 업로드 수가 한도를 넘는지 — 넘으면 안내 문장 */
export function mediaCountError(counts: { images: number; videos: number }, s: MemberMediaSettings): string | null {
  if (s.maxImagesPerPost > 0 && counts.images > s.maxImagesPerPost) return `이미지는 글 하나에 ${s.maxImagesPerPost}장까지 넣을 수 있습니다.`;
  if (s.maxVideosPerPost > 0 && counts.videos > s.maxVideosPerPost) return `영상은 글 하나에 ${s.maxVideosPerPost}개까지 넣을 수 있습니다.`;
  return null;
}

export interface UploadPolicy {
  maxImageBytes: number;
  maxVideoBytes: number;
  /** 0 = 길이 제한 없음 */
  maxVideoSeconds: number;
}

/** 누가 올리느냐에 따른 실제 상한 — 관리자는 시스템 상한, 회원은 설정값. 길이 상한은 둘 다 */
export function uploadPolicyFor(actor: "admin" | "member", s: MemberMediaSettings): UploadPolicy {
  return {
    maxImageBytes: actor === "admin" ? MAX_IMAGE_BYTES : effectiveMaxBytes("image", s),
    maxVideoBytes: actor === "admin" ? MAX_VIDEO_BYTES : effectiveMaxBytes("video", s),
    maxVideoSeconds: s.maxVideoSeconds,
  };
}
