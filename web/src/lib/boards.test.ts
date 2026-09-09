import { describe, expect, it } from "vitest";
import { MEMBER_BOARD_KIND, memberBoardLabel, memberBoardName } from "./boards";

describe("회원 게시판 이름", () => {
  it("노견생활은 정해 둔 이름, 나머지는 토픽명으로 만든다", () => {
    expect(memberBoardName("senior-life", "노견생활")).toBe("노령견 생활 공유 게시판");
    expect(memberBoardName("play", "놀이")).toBe("놀이 생활 공유 게시판");
  });

  it("전체 이름은 종류를 앞에 붙인다", () => {
    expect(MEMBER_BOARD_KIND).toBe("일반");
    expect(memberBoardLabel("senior-life", "노견생활")).toBe("일반 - 노령견 생활 공유 게시판");
  });
});
