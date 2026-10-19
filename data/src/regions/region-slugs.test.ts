import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REGIONS } from "./regions.js";

// /spot/<시도>/<x> 는 x 가 시군구면 시군구 페이지, 유형이면 시도 x 유형 페이지 (web app/spot/[sido]/[sigungu]).
// 시군구 슬러그가 항상 -si/-gun/-gu 로 끝나야 유형 슬러그와 겹치지 않는다.
describe("시군구 슬러그 ↔ 유형 슬러그", () => {
  it("시군구 슬러그는 -si / -gun / -gu 로 끝난다", () => {
    const bad = REGIONS.filter((r) => !/-(si|gun|gu)$/.test(r.sigunguSlug)).map((r) => `${r.sidoSlug}/${r.sigunguSlug}`);
    expect(bad).toEqual([]);
  });
  it("유형 슬러그는 시군구 모양이 아니다", () => {
    const src = readFileSync(new URL("../seed/base.ts", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("const SPOT_TYPES"), src.indexOf("] as const", src.indexOf("const SPOT_TYPES")));
    const slugs = [...block.matchAll(/slug: "([^"]+)"/g)].map((m) => m[1]!);
    expect(slugs.length).toBeGreaterThan(5);
    const regionSlugs = new Set(REGIONS.map((r) => r.sigunguSlug));
    expect(slugs.filter((s) => /-(si|gun|gu)$/.test(s) || regionSlugs.has(s))).toEqual([]);
  });
});
