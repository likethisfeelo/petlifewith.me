import { describe, expect, it } from "vitest";
import { SENIOR_BODY_AREAS } from "./categories.js";
import { seniorSeedPosts } from "./seed-posts.js";

describe("신체 영역 Q&A 시드 글", () => {
  const posts = seniorSeedPosts();
  it("질문 하나당 글 하나, 슬러그 유일, 카테고리는 정의된 영역", () => {
    const total = SENIOR_BODY_AREAS.reduce((a, area) => a + area.questions.length, 0);
    expect(posts.length).toBe(total);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    const slugs = new Set(SENIOR_BODY_AREAS.map((a) => a.slug));
    for (const p of posts) expect(slugs.has(p.category)).toBe(true);
  });
  it("본문은 '병원에서 확인' 결론으로 끝나고 요약은 200자 이하", () => {
    for (const p of posts) {
      expect(p.bodyMd).toMatch(/동물병원에서 확인/);
      expect(p.summary.length).toBeLessThanOrEqual(200);
    }
  });
  it("발행일은 정의 순서대로 내려가며 미래가 아니다", () => {
    for (let i = 1; i < posts.length; i += 1) {
      expect(posts[i]!.publishedAt.getTime()).toBeLessThan(posts[i - 1]!.publishedAt.getTime());
    }
    expect(posts[0]!.publishedAt.getTime()).toBeLessThan(Date.now());
  });
});
