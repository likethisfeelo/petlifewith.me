import { describe, expect, it } from "vitest";
import { countProvidersByRegion, countProvidersBySido, plainExcerpt, providersInArea, type CareProvider, type CareRegion } from "./care";

const regions: CareRegion[] = [
  { id: 1, sidoName: "서울특별시", sidoSlug: "seoul", sigunguName: "마포구", sigunguSlug: "mapo-gu" },
  { id: 2, sidoName: "서울특별시", sidoSlug: "seoul", sigunguName: "서대문구", sigunguSlug: "seodaemun-gu" },
  { id: 3, sidoName: "경기도", sidoSlug: "gyeonggi", sigunguName: "성남시", sigunguSlug: "seongnam-si" },
];

function provider(id: number, name: string, areas: Array<[number, boolean, number]>): CareProvider {
  return {
    id,
    slug: `p${id}`,
    name,
    typeSlug: "pet-sitter",
    typeName: "펫시터",
    source: "direct",
    status: "operating",
    intro: null,
    priceText: null,
    hoursText: null,
    dataReferenceDate: null,
    homeRegionId: areas[0]?.[0] ?? 1,
    areas: areas.map(([regionId, exposed, sortOrder]) => ({ regionId, exposed, sortOrder })),
    kakaoUrl: null,
    reservationUrl: null,
  };
}

describe("돌봄 파트너 헬퍼", () => {
  const list = [
    provider(1, "나 시터", [[1, true, 2], [2, true, 1]]),
    provider(2, "가 시터", [[1, true, 2]]),
    provider(3, "다 시터", [[1, false, 1], [3, true, 1]]),
    ...Array.from({ length: 6 }, (_, i) => provider(10 + i, `라${i} 시터`, [[1, true, 5 + i]])),
  ];

  it("지역 자리는 노출된 파트너만, 정렬값 → 이름순, 최대 5명", () => {
    const mapo = providersInArea(list, 1);
    expect(mapo.map((p) => p.name).slice(0, 2)).toEqual(["가 시터", "나 시터"]); // 같은 정렬값 2 → 이름순
    expect(mapo).toHaveLength(5);
    expect(mapo.some((p) => p.id === 3)).toBe(false); // 마포 노출 OFF
    expect(providersInArea(list, 3).map((p) => p.id)).toEqual([3]);
  });

  it("지역별 수는 노출된 지역만, 시도별 수는 사람 수 기준", () => {
    const byRegion = countProvidersByRegion(list);
    expect(byRegion[1]).toBe(8);
    expect(byRegion[2]).toBe(1);
    expect(byRegion[3]).toBe(1);
    const bySido = countProvidersBySido(list, regions);
    expect(bySido.seoul).toBe(8); // 1번은 마포+서대문 둘 다 맡아도 1명
    expect(bySido.gyeonggi).toBe(1);
  });

  it("소개 발췌는 마크다운 기호를 걷어내고 길이를 자른다", () => {
    expect(plainExcerpt("**가상의 예시** — [링크](https://x)\n\n# 제목\n본문 {{youtube:abc|a|b}} 끝")).toBe("가상의 예시 — 링크 제목 본문 끝");
    expect(plainExcerpt("가".repeat(200), 20)?.length).toBe(20);
    expect(plainExcerpt(null)).toBeNull();
  });
});
