import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cleanParams, gtmEventRegex, pageContextForPath, paramsFromDataset } from "./tracking";

describe("pageContextForPath", () => {
  it("디렉토리 4단과 상세", () => {
    expect(pageContextForPath("/spot")).toMatchObject({ page_type: "spot_hub", content_group: "directory" });
    expect(pageContextForPath("/spot/type/grooming")).toMatchObject({ page_type: "spot_type", spot_type: "grooming" });
    expect(pageContextForPath("/spot/%EC%84%9C%EC%9A%B8/%EA%B0%95%EB%82%A8%EA%B5%AC/grooming")).toMatchObject({
      page_type: "spot_region_type",
      region_sido: "서울",
      region_sigungu: "강남구",
      spot_type: "grooming",
    });
    expect(pageContextForPath("/place/12-abc")).toMatchObject({ page_type: "place", entity_type: "spot" });
  });
  it("토픽 게시판 3분할", () => {
    expect(pageContextForPath("/topic/senior-life")).toMatchObject({ page_type: "topic", topic: "senior-life" });
    expect(pageContextForPath("/topic/senior-life/curated")).toMatchObject({ board: "curated" });
    expect(pageContextForPath("/topic/senior-life/challenge")).toMatchObject({ board: "general", content_group: "community" });
    expect(pageContextForPath("/topic/senior-life/joint")).toMatchObject({ board: "category", category: "joint" });
  });
  it("계정 화면은 분류만", () => {
    expect(pageContextForPath("/me/settings")).toEqual({ page_type: "my_page", content_group: "account" });
  });
});

describe("params", () => {
  it("빈 값은 보내지 않는다", () => {
    expect(cleanParams({ a: "", b: undefined, c: null, d: 0, e: false, f: "x" })).toEqual({ d: 0, e: false, f: "x" });
  });
  it("data-track-* → snake_case", () => {
    expect(paramsFromDataset({ track: "contact_click", trackEntityId: "12", trackIsPromoted: "true", trackChannel: "kakao" })).toEqual({
      entity_id: "12",
      is_promoted: true,
      channel: "kakao",
    });
  });
});

describe("GTM 컨테이너", () => {
  it("이벤트 트리거 정규식이 코드의 이벤트 목록과 같다", () => {
    const json = readFileSync(resolve(__dirname, "../../../docs/gtm/petlife-gtm-container.json"), "utf8");
    expect(json).toContain(JSON.stringify(gtmEventRegex()).slice(1, -1));
  });
});
