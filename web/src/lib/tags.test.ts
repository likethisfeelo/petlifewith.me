import { describe, expect, it } from "vitest";
import { hashtagsIn, linkifyHashtags, mergeTags, normalizeTag, parseTagInput } from "./tags";

describe("태그 정규화", () => {
  it("# 을 떼고 공백을 없애고 소문자로", () => {
    expect(normalizeTag(" #노즈워크 매트 ")).toBe("노즈워크매트");
    expect(normalizeTag("Nose_Work")).toBe("nose_work");
    expect(normalizeTag("실내-놀이·비오는날")).toBe("실내-놀이·비오는날");
  });
  it("글자가 없거나 허용되지 않는 문자는 버린다", () => {
    expect(normalizeTag("#1")).toBeNull();
    expect(normalizeTag("가나!")).toBeNull();
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("가".repeat(40))?.length).toBe(30);
  });
  it("입력 칸은 쉼표·공백·줄바꿈으로 나누고 중복을 빼고 10개까지", () => {
    expect(parseTagInput("노즈워크, #실내놀이 노즈워크\n장난감")).toEqual(["노즈워크", "실내놀이", "장난감"]);
    expect(parseTagInput(Array.from({ length: 15 }, (_, i) => `t${i}`).join(" "))).toHaveLength(10);
  });
});

const BODY = [
  "# 제목에 #태그 는 무시",
  "본문 #노즈워크 와 #실내놀이, 그리고 문장 끝 #장난감.",
  "주소 https://example.com/page#frag 와 엔티티 &#39; 와 C#은 태그가 아니다.",
  "`코드 안 #코드` 와 [링크 #링크](https://x.y) 도 무시",
  "```",
  "#펜스안",
  "```",
  "{{youtube:abc12345678|채널|https://youtu.be/abc12345678}}",
  "다시 #노즈워크 (중복) #1 (숫자만) #nose_work",
].join("\n");

describe("본문 #태그", () => {
  it("문장 속 태그만 뽑는다", () => {
    expect(hashtagsIn(BODY)).toEqual(["노즈워크", "실내놀이", "장난감", "nose_work"]);
  });
  it("태그를 링크로 바꾸고 나머지는 그대로 둔다", () => {
    const out = linkifyHashtags(BODY);
    expect(out).toContain("본문 [#노즈워크](/tag/%EB%85%B8%EC%A6%88%EC%9B%8C%ED%81%AC) 와 [#실내놀이](/tag/%EC%8B%A4%EB%82%B4%EB%86%80%EC%9D%B4),");
    expect(out).toContain("# 제목에 #태그 는 무시");
    expect(out).toContain("https://example.com/page#frag");
    expect(out).toContain("&#39;");
    expect(out).toContain("`코드 안 #코드`");
    expect(out).toContain("[링크 #링크](https://x.y)");
    expect(out).toContain("\n#펜스안\n");
    expect(out).toContain("{{youtube:abc12345678|채널|https://youtu.be/abc12345678}}");
    expect(out).toContain("#1 (숫자만) [#nose_work](/tag/nose_work)");
  });
  it("칸의 태그를 앞에 두고 본문 태그를 합친다", () => {
    expect(mergeTags(["장난감", "노즈워크"], ["노즈워크", "실내놀이"])).toEqual(["장난감", "노즈워크", "실내놀이"]);
  });
});
