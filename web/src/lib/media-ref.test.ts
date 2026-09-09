import { describe, expect, it } from "vitest";
import {
  extractEmbeds,
  instagramPermalink,
  parseMediaRef,
  pickCardMedia,
  resolveHeroVideo,
  serializeMediaRef,
  shortcodeFor,
  uploadedKeysIn,
  youtubeIdFromUrl,
} from "./media-ref";

describe("유튜브 주소 → ID", () => {
  it("watch · youtu.be · shorts · embed 를 받는다", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("유튜브가 아니거나 ID 가 없으면 null", () => {
    expect(youtubeIdFromUrl("https://vimeo.com/12345")).toBeNull();
    expect(youtubeIdFromUrl("https://www.youtube.com/@channel")).toBeNull();
    expect(youtubeIdFromUrl("not a url")).toBeNull();
  });
});

describe("인스타그램 퍼머링크", () => {
  it("게시물·릴스만 허용하고 정규화한다", () => {
    expect(instagramPermalink("https://www.instagram.com/p/C1a2B3c4D5e/?igsh=xyz")).toBe("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(instagramPermalink("https://instagram.com/reel/C1a2B3c4D5e")).toBe("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(instagramPermalink("https://www.instagram.com/reels/C1a2B3c4D5e/")).toBe("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(instagramPermalink("https://www.instagram.com/someuser/p/C1a2B3c4D5e/")).toBe("https://www.instagram.com/p/C1a2B3c4D5e/");
  });
  it("스토리·프로필·하이라이트·다른 도메인은 거른다", () => {
    expect(instagramPermalink("https://www.instagram.com/stories/someuser/3141592653589/")).toBeNull();
    expect(instagramPermalink("https://www.instagram.com/someuser/")).toBeNull();
    expect(instagramPermalink("https://www.instagram.com/stories/highlights/1234/")).toBeNull();
    expect(instagramPermalink("https://evil.example.com/p/C1a2B3c4D5e/")).toBeNull();
    expect(instagramPermalink("http://www.instagram.com/p/C1a2B3c4D5e/")).toBeNull();
  });
});

describe("대표 영상 문자열", () => {
  it("video · youtube · instagram 을 왕복한다", () => {
    expect(parseMediaRef("video:media/video/1-a.webm")).toEqual({ kind: "video", key: "media/video/1-a.webm" });
    expect(parseMediaRef("youtube:dQw4w9WgXcQ")).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseMediaRef("instagram:https://instagram.com/reel/C1a2B3c4D5e")).toEqual({ kind: "instagram", url: "https://www.instagram.com/reel/C1a2B3c4D5e/" });
    expect(serializeMediaRef({ kind: "youtube", id: "dQw4w9WgXcQ" })).toBe("youtube:dQw4w9WgXcQ");
  });
  it("틀린 형식은 null", () => {
    expect(parseMediaRef("")).toBeNull();
    expect(parseMediaRef("image:x")).toBeNull();
    expect(parseMediaRef("youtube:bad id!")).toBeNull();
    expect(parseMediaRef("instagram:https://www.instagram.com/stories/u/1/")).toBeNull();
  });
});

const BODY = [
  "첫 문단",
  "{{image:media/image/1-a.jpg|우리 개|첫 사진}}",
  "{{youtube:dQw4w9WgXcQ|멍멍채널|https://www.youtube.com/watch?v=dQw4w9WgXcQ}}",
  "{{video:media/video/2-b.webm|산책 영상}}",
  "{{instagram:https://www.instagram.com/reel/C1a2B3c4D5e/|작가|https://www.instagram.com/reel/C1a2B3c4D5e/}}",
  "{{instagram:https://www.instagram.com/stories/u/1/|작가|https://x}}",
  "{{youtube:dQw4w9WgXcQ|채널만}}",
].join("\n\n");

describe("본문 임베드", () => {
  it("순서대로 뽑고 불량 줄은 건너뛴다", () => {
    const list = extractEmbeds(BODY);
    expect(list.map((e) => e.ref.kind)).toEqual(["image", "youtube", "video", "instagram", "youtube"]);
    expect(list[1]!.complete).toBe(true);
    expect(list[4]!.complete).toBe(false); // 원본 링크 없음
    expect(uploadedKeysIn(BODY)).toEqual({ images: ["media/image/1-a.jpg"], videos: ["media/video/2-b.webm"] });
  });
  it("대표 영상은 지정값이 본문에 있을 때만, 아니면 첫 영상", () => {
    expect(resolveHeroVideo(null, BODY)).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(resolveHeroVideo("video:media/video/2-b.webm", BODY)).toEqual({ kind: "video", key: "media/video/2-b.webm" });
    expect(resolveHeroVideo("video:media/video/없음.webm", BODY)).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(resolveHeroVideo(null, "영상 없는 글")).toBeNull();
  });
});

describe("카드 미디어", () => {
  it("섬네일: 대표 이미지 → 영상 포스터 → 유튜브 섬네일 → 본문 첫 이미지", () => {
    expect(pickCardMedia({ heroMedia: null, heroImageKey: "media/image/hero.jpg", bodyMd: BODY })).toMatchObject({ thumbKey: "media/image/hero.jpg", thumbUrl: null });
    expect(pickCardMedia({ heroMedia: "video:media/video/2-b.webm", heroImageKey: null, bodyMd: BODY }, { "media/video/2-b.webm": "media/image/poster.jpg" })).toMatchObject({
      video: { kind: "video", key: "media/video/2-b.webm" },
      thumbKey: "media/image/poster.jpg",
    });
    expect(pickCardMedia({ heroMedia: null, heroImageKey: null, bodyMd: BODY })).toMatchObject({
      video: { kind: "youtube", id: "dQw4w9WgXcQ" },
      thumbKey: null,
      thumbUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
    expect(pickCardMedia({ heroMedia: "video:media/video/2-b.webm", heroImageKey: null, bodyMd: BODY })).toMatchObject({ thumbKey: "media/image/1-a.jpg" });
    expect(pickCardMedia({ heroMedia: null, heroImageKey: null, bodyMd: "글만" })).toEqual({ video: null, thumbKey: null, thumbUrl: null });
  });
});

describe("숏코드 만들기", () => {
  it("구분자를 걷어내고 기본값을 채운다", () => {
    expect(shortcodeFor({ kind: "image", key: "k" }, { alt: "우리|개" })).toBe("{{image:k|우리 개}}");
    expect(shortcodeFor({ kind: "video", key: "k" }, { caption: "산책" })).toBe("{{video:k|산책}}");
    expect(shortcodeFor({ kind: "youtube", id: "dQw4w9WgXcQ" }, { creator: "멍멍" })).toBe("{{youtube:dQw4w9WgXcQ|멍멍|https://www.youtube.com/watch?v=dQw4w9WgXcQ}}");
    expect(shortcodeFor({ kind: "instagram", url: "https://www.instagram.com/p/abc123/" }, { creator: "작가" })).toBe(
      "{{instagram:https://www.instagram.com/p/abc123/|작가|https://www.instagram.com/p/abc123/}}",
    );
  });
});
