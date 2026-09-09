import { describe, expect, it } from "vitest";
import { DEFAULT_TAGLINE, TOPIC_TAGLINES, taglineForTopic, topicFromPath } from "./tagline";

describe("브랜드 태그라인", () => {
  it("기본은 행복한 삶, 놀이는 즐거운 삶", () => {
    expect(taglineForTopic(null)).toBe("반려동물의 행복한 삶, 나와 함께 - pet life with me");
    expect(taglineForTopic("senior-life")).toBe(DEFAULT_TAGLINE);
    expect(taglineForTopic("play")).toBe("반려동물의 즐거운 삶, 나와 함께 - pet life with me");
  });

  it("두 문구는 길이가 같아 머리글이 흔들리지 않는다", () => {
    for (const t of Object.values(TOPIC_TAGLINES)) expect(t.length).toBe(DEFAULT_TAGLINE.length);
  });

  it("주소에서 토픽을 읽는다", () => {
    expect(topicFromPath("/topic/play")).toBe("play");
    expect(topicFromPath("/topic/play/challenge")).toBe("play");
    expect(topicFromPath("/topic/senior-life/joint")).toBe("senior-life");
    expect(topicFromPath("/topics/play")).toBeNull();
    expect(topicFromPath("/guide/play-hub")).toBeNull();
    expect(topicFromPath("/")).toBeNull();
    expect(topicFromPath(null)).toBeNull();
  });
});
