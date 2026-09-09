import { describe, expect, it } from "vitest";
import { insertBlock } from "./media-toolbar";

describe("본문에 블록 끼워 넣기", () => {
  it("앞뒤에 빈 줄을 확보한다", () => {
    expect(insertBlock("", 0, "{{x}}")).toEqual({ value: "{{x}}\n", cursor: 6 });
    expect(insertBlock("가나", 2, "{{x}}")).toEqual({ value: "가나\n\n{{x}}\n", cursor: 10 });
    const r = insertBlock("앞\n\n뒤", 3, "{{x}}");
    expect(r.value).toBe("앞\n\n{{x}}\n\n뒤");
  });
  it("커서가 문장 중간이면 줄을 나눈다", () => {
    const r = insertBlock("앞뒤", 1, "{{x}}");
    expect(r.value).toBe("앞\n\n{{x}}\n\n뒤");
    expect(r.value.slice(r.cursor)).toBe("뒤");
  });
});
