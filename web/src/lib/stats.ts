// 지역 통계 — 노령견 비율 (지역 페이지 고유 데이터 블록의 근거)
//
// 노령 기준: 등록 기준일 시점 만 7세 이상(출생연도 차이 7년 이상)으로 계산한다.
// 통용되는 노령견 기준(7~8세)의 보수적 하한이며, 페이지에는 기준을 함께 표기한다.
export const SENIOR_AGE_YEARS = 7;

export interface DogStatRow {
  birthYear: number;
  registeredCount: number;
}

export interface SeniorRatio {
  total: number;
  senior: number;
  /** 0~1. 데이터가 없으면 null */
  ratio: number | null;
  referenceYear: number;
}

export function computeSeniorRatio(rows: DogStatRow[], referenceDate: string | Date): SeniorRatio {
  const referenceYear =
    typeof referenceDate === "string" ? Number(referenceDate.slice(0, 4)) : referenceDate.getFullYear();
  let total = 0;
  let senior = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.birthYear) || row.birthYear > referenceYear) continue; // 미래 출생연도 등 이상값 제외
    total += row.registeredCount;
    if (referenceYear - row.birthYear >= SENIOR_AGE_YEARS) senior += row.registeredCount;
  }
  return { total, senior, ratio: total > 0 ? senior / total : null, referenceYear };
}
