import { describe, expect, it } from "vitest";
import { parseBlocks, serializeBlocks } from "./blocks";

const MD = [
  "## 첫 제목",
  "",
  "본문 한 문단. **굵게** 와 [링크](https://a.b) 를 포함한다.",
  "- 목록 하나",
  "- 목록 둘",
  "",
  "{{image:media/image/a.jpg|우리 개|첫 사진}}",
  "",
  "### 소제목",
  "",
  "{{video:media/video/b.webm|산책}}",
  "",
  "{{youtube:dQw4w9WgXcQ|멍멍채널|https://youtu.be/dQw4w9WgXcQ}}",
  "",
  "{{instagram:https://www.instagram.com/reel/C1a2B3c4D5e/|작가|https://www.instagram.com/reel/C1a2B3c4D5e/}}",
  "",
  "# 한 개짜리도 제목",
  "",
  "마지막 문단",
].join("\n");

describe("블록 파싱", () => {
  it("빈 줄로 나뉜 덩어리가 블록이 되고 종류를 알아본다", () => {
    const blocks = parseBlocks(MD);
    expect(blocks.map((b) => b.kind)).toEqual(["h2", "p", "image", "h3", "video", "youtube", "instagram", "h2", "p"]);
    const p = blocks[1]!;
    expect(p.kind === "p" && p.text).toBe("본문 한 문단. **굵게** 와 [링크](https://a.b) 를 포함한다.\n- 목록 하나\n- 목록 둘");
    const img = blocks[2]!;
    expect(img.kind === "image" && [img.label, img.extra]).toEqual(["우리 개", "첫 사진"]);
    const yt = blocks[5]!;
    expect(yt.kind === "youtube" && [yt.label, yt.extra]).toEqual(["멍멍채널", "https://youtu.be/dQw4w9WgXcQ"]);
  });

  it("마크다운으로 되돌리면 같은 내용이 된다 (# 하나는 ## 로)", () => {
    const md = serializeBlocks(parseBlocks(MD));
    expect(md).toBe(MD.replace("# 한 개짜리도 제목", "## 한 개짜리도 제목") + "\n");
    expect(serializeBlocks(parseBlocks(md))).toBe(md);
  });

  it("빈 블록은 버리고 형식이 틀린 숏코드는 본문으로 남긴다", () => {
    const blocks = parseBlocks("\n\n{{instagram:https://www.instagram.com/stories/u/1/|x|y}}\n\n   \n\n글");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "p"]);
    expect(serializeBlocks([])).toBe("");
  });
});
