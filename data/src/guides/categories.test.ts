import { describe, expect, it } from "vitest";
import { SENIOR_BODY_AREAS, categoriesForTopic, getGuideCategory } from "./categories.js";

describe("게시글 카테고리 (노견 신체 영역)", () => {
  it("슬러그가 유일하고 각 영역에 질문이 하나 이상 있다", () => {
    const slugs = SENIOR_BODY_AREAS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of SENIOR_BODY_AREAS) expect(a.questions.length).toBeGreaterThan(0);
  });
  it("답변에 효과 단정·병원 추천 표현이 없다 (6-2)", () => {
    for (const a of SENIOR_BODY_AREAS) {
      for (const q of a.questions) expect(q.a).not.toMatch(/효과적|추천|치료됩니다|낫습니다/);
    }
  });
  it("토픽별 조회 — 없는 토픽은 빈 목록, 없는 슬러그는 undefined", () => {
    expect(categoriesForTopic("senior-life").length).toBe(8);
    expect(categoriesForTopic("play")).toEqual([]);
    expect(getGuideCategory("senior-life", "joint")?.name).toBe("관절·보행");
    expect(getGuideCategory("senior-life", null)).toBeUndefined();
    expect(getGuideCategory("play", "joint")).toBeUndefined();
  });
});
