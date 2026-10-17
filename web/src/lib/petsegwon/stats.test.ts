import { describe, expect, it } from "vitest";
import { baselineStats, industryList, labelFor, normalizeStats, regionResult, searchRegions, levelFor, levelExplain } from "./stats";

describe("baselineStats", () => {
  const s = baselineStats();
  it("전국·서울 미용업 평균이 실태조사 계산과 같다 (릴스 원고 332·357)", () => {
    expect(Math.round(s.national.grooming!.per_shop!)).toBe(332);
    expect(Math.round(s.sido["서울"]!.industries.grooming!.per_shop!)).toBe(357);
  });
  it("시도 순위는 1곳당 마리 수가 큰 순", () => {
    const ranks = Object.values(s.sido).map((v) => v.industries.grooming!);
    const first = ranks.find((r) => r.national_rank === 1)!;
    expect(Math.max(...ranks.map((r) => r.per_shop ?? 0))).toBe(first.per_shop);
    expect(first.rank_total).toBe(17);
  });
  it("업장 0곳 업종은 값 없음", () => {
    expect(s.sido["울산"]!.industries.import!.per_shop).toBeNull();
  });
  it("업종은 판매업을 뺀 7개, 미용업이 먼저", () => {
    expect(industryList(s)).toHaveLength(7);
    expect(industryList(s)).not.toContain("sales");
    expect(industryList(s)[0]).toBe("grooming");
  });
});

describe("labelFor", () => {
  it("기준", () => {
    expect(labelFor(120, 10)).toBe("업장 대비 등록견 많음");
    expect(labelFor(119.9, 10)).toBe("평균 수준");
    expect(labelFor(80, 10)).toBe("평균 수준");
    expect(labelFor(79.9, 10)).toBe("업장 대비 등록견 적음");
    expect(labelFor(150, 2)).toBe("표본 적음");
    expect(labelFor(null, 5)).toBe("업장 없음");
  });
});

describe("regionResult (시도)", () => {
  it("전국 평균과 비교", () => {
    const r = regionResult(baselineStats(), "서울", null, "grooming")!;
    expect(r.compareName).toBe("전국 평균");
    expect(r.pctOfCompare).toBeCloseTo((357.2 / 332.4) * 100, 0);
    expect(r.label).toBe("평균 수준");
  });
});

describe("normalizeStats", () => {
  const sample = {
    meta: { generated_at: "2026-10-01T00:00:00+00:00", baseline_reference_date: "2025-12-31", label_thresholds_pct_of_sido_avg: { short: 120, dense: 80 } },
    sigungu: [
      {
        sido: "서울",
        sigungu: "강남구",
        dogs: 30000,
        industries: {
          grooming: { shops: 100, shops_raw: 90, per_shop: 300, pct_of_sido_avg: 84, pct_of_national_avg: 90.3, label: "평균권", rank_in_sido: 20, count_in_sido: 25 },
          bogus: { shops: 1 },
        },
      },
      { sido: "없는도", sigungu: "x", dogs: 1, industries: {} },
      { sido: "서울", sigungu: "강남구", dogs: 1, industries: {} },
    ],
  };
  it("알 수 있는 행·업종만 남긴다", () => {
    const r = normalizeStats(sample);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sigungu).toHaveLength(1);
    expect(Object.keys(r.value.sigungu[0]!.industries)).toEqual(["grooming"]);
    expect(r.value.meta.source).toBe("pipeline");
    expect(industryList(r.value)).toEqual(["grooming"]);
    const res = regionResult(r.value, "서울", "강남구", "grooming")!;
    expect(res.compareName).toBe("서울 평균");
    expect(res.rank).toBe(20);
    expect(res.label).toBe("평균 수준");
  });
  it("모양이 다르면 거절", () => {
    expect(normalizeStats(null).ok).toBe(false);
    expect(normalizeStats({ meta: {}, sigungu: [] }).ok).toBe(false);
    expect(normalizeStats({ meta: {}, sigungu: [{ sido: "없는도", sigungu: "a" }] }).ok).toBe(false);
  });
});

describe("searchRegions", () => {
  const withSgg = normalizeStats({
    meta: {},
    sigungu: [
      { sido: "서울", sigungu: "강남구", dogs: 1, industries: {} },
      { sido: "서울", sigungu: "강동구", dogs: 1, industries: {} },
      { sido: "부산", sigungu: "강서구", dogs: 1, industries: {} },
      { sido: "경기", sigungu: "수원시", dogs: 1, industries: {} },
      { sido: "인천", sigungu: "제물포구·영종구", dogs: 1, industries: {} },
    ],
  });
  if (!withSgg.ok) throw new Error("fixture");
  const s = withSgg.value;
  it("빈 키워드는 시도 목록", () => {
    expect(searchRegions(s, "")).toHaveLength(17);
    expect(searchRegions(s, "")[0]).toEqual({ sido: "서울", sigungu: "", label: "서울 전체" });
  });
  it("시군구 이름 앞부분이 먼저", () => {
    expect(searchRegions(s, "강").map((o) => o.label)).toEqual(["서울 강남구", "서울 강동구", "부산 강서구", "강원 전체"]);
    expect(searchRegions(s, "수원")[0]!.label).toBe("경기 수원시");
    expect(searchRegions(s, "영종")[0]!.label).toBe("인천 제물포구·영종구");
    expect(searchRegions(s, "영통구")[0]).toEqual({ sido: "경기", sigungu: "수원시", label: "경기 수원시 (영통구 포함)" });
    expect(searchRegions(s, "수원시 영통")[0]!.sigungu).toBe("수원시");
  });
  it("시도와 붙여 써도, 정식 이름으로 써도", () => {
    expect(searchRegions(s, "서울 강남")[0]!.label).toBe("서울 강남구");
    expect(searchRegions(s, "서울특별시강남")[0]!.label).toBe("서울 강남구");
    expect(searchRegions(s, "경상남도")).toEqual([{ sido: "경남", sigungu: "", label: "경남 전체" }]);
  });
  it("시군구 자료가 없으면 시도만", () => {
    expect(searchRegions(baselineStats(), "전")).toEqual([
      { sido: "전북", sigungu: "", label: "전북" },
      { sido: "전남", sigungu: "", label: "전남" },
    ]);
  });
});

describe("levelFor", () => {
  it("5단계", () => {
    expect(levelFor(130, 10)).toBe("much_higher");
    expect(levelFor(129.9, 10)).toBe("higher");
    expect(levelFor(110, 10)).toBe("higher");
    expect(levelFor(109.9, 10)).toBe("average");
    expect(levelFor(90, 10)).toBe("average");
    expect(levelFor(89.9, 10)).toBe("lower");
    expect(levelFor(70, 10)).toBe("lower");
    expect(levelFor(69.9, 10)).toBe("much_lower");
    expect(levelFor(200, 2)).toBe("small_sample");
    expect(levelFor(null, 5)).toBe("none");
  });
  it("해석 문구", () => {
    expect(levelExplain("average", { place: "동래구", compareName: "부산 평균", industry: "미용업" }).title).toContain("부산 평균");
  });
});
