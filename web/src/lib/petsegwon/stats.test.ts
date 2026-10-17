import { describe, expect, it } from "vitest";
import { baselineStats, industryList, labelFor, normalizeStats, regionResult } from "./stats";

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
  it("업종은 8개 전부, 미용업이 먼저", () => {
    expect(industryList(s)).toHaveLength(8);
    expect(industryList(s)[0]).toBe("grooming");
  });
});

describe("labelFor", () => {
  it("기준", () => {
    expect(labelFor(120, 10)).toBe("공급 부족 후보");
    expect(labelFor(119.9, 10)).toBe("평균권");
    expect(labelFor(80, 10)).toBe("평균권");
    expect(labelFor(79.9, 10)).toBe("밀집 지역");
    expect(labelFor(150, 2)).toBe("표본 적음");
    expect(labelFor(null, 5)).toBe("업장 없음");
  });
});

describe("regionResult (시도)", () => {
  it("전국 평균과 비교", () => {
    const r = regionResult(baselineStats(), "서울", null, "grooming")!;
    expect(r.compareName).toBe("전국 평균");
    expect(r.pctOfCompare).toBeCloseTo((357.2 / 332.4) * 100, 0);
    expect(r.label).toBe("평균권");
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
    expect(res.label).toBe("평균권");
  });
  it("모양이 다르면 거절", () => {
    expect(normalizeStats(null).ok).toBe(false);
    expect(normalizeStats({ meta: {}, sigungu: [] }).ok).toBe(false);
    expect(normalizeStats({ meta: {}, sigungu: [{ sido: "없는도", sigungu: "a" }] }).ok).toBe(false);
  });
});
