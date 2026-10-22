import { describe, expect, it } from "vitest";
import { SPOT_TYPE_SEO, regionTypeTitle, typeSeo } from "./spot-seo";

describe("검색용 유형 이름", () => {
  it("지역 x 유형 제목은 대표 검색어가 지역 바로 뒤에", () => {
    expect(regionTypeTitle("부산 동래구", { slug: "grooming", name: "미용·스파" }, 12)).toBe("부산 동래구 애견미용 — 강아지·고양이 미용실 12곳");
    expect(regionTypeTitle("경기 수원시", { slug: "playground", name: "놀이터" })).toBe("경기 수원시 애견운동장 — 강아지 놀이터·반려견 놀이터");
  });
  it("표에 없는 유형(B2B)은 표시 이름 그대로", () => {
    expect(typeSeo({ slug: "drug-wholesale", name: "동물용의약품 도매" })).toEqual({ head: "동물용의약품 도매", alt: "동물용의약품 도매" });
    expect(regionTypeTitle("서울 강남구", { slug: "drug-wholesale", name: "동물용의약품 도매" }, 3)).toBe("서울 강남구 동물용의약품 도매 3곳");
  });
  it("대표 검색어는 애견·반려·펫·동물로 시작한다", () => {
    for (const { head } of Object.values(SPOT_TYPE_SEO)) expect(head).toMatch(/^(애견|반려|펫|동물)/);
  });
});
