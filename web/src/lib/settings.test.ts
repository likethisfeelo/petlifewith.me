import { describe, expect, it } from "vitest";
import { DEFAULT_MEMBER_MEDIA, effectiveMaxBytes, mediaCountError, normalizeMemberMedia } from "./settings";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "./media";

describe("회원 미디어 설정", () => {
  it("기본은 제한 없음 · 3분 · 승인 대기", () => {
    expect(normalizeMemberMedia(null)).toEqual(DEFAULT_MEMBER_MEDIA);
    expect(DEFAULT_MEMBER_MEDIA).toMatchObject({ maxImagesPerPost: 0, maxVideosPerPost: 0, maxVideoSeconds: 180, requireApproval: true });
  });
  it("불량 값은 기본값으로, 용량은 시스템 상한을 넘지 못한다", () => {
    const s = normalizeMemberMedia({ maxImagesPerPost: "3", maxVideosPerPost: -1, maxVideoBytes: 10 ** 12, requireApproval: "no", maxVideoSeconds: 59.9 });
    expect(s.maxImagesPerPost).toBe(3);
    expect(s.maxVideosPerPost).toBe(0);
    expect(s.maxVideoBytes).toBe(MAX_VIDEO_BYTES);
    expect(s.requireApproval).toBe(true);
    expect(s.maxVideoSeconds).toBe(59);
  });
  it("적용 상한과 개수 검사", () => {
    expect(effectiveMaxBytes("image", DEFAULT_MEMBER_MEDIA)).toBe(MAX_IMAGE_BYTES);
    expect(effectiveMaxBytes("video", { ...DEFAULT_MEMBER_MEDIA, maxVideoBytes: 1000 })).toBe(1000);
    expect(mediaCountError({ images: 99, videos: 99 }, DEFAULT_MEMBER_MEDIA)).toBeNull();
    expect(mediaCountError({ images: 3, videos: 0 }, { ...DEFAULT_MEMBER_MEDIA, maxImagesPerPost: 2 })).toContain("2장");
    expect(mediaCountError({ images: 0, videos: 2 }, { ...DEFAULT_MEMBER_MEDIA, maxVideosPerPost: 1 })).toContain("1개");
  });
});
