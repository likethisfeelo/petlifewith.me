// ============================================================
// 돌봄 파트너 지도 — 타일 배치표
//
// 실측 경계 대신 격자 타일(카토그램)로 그린다. 시도 17개는 대략의 지리 위치에,
// 서울 25개 구는 손으로 배치한 8x6 격자에 놓는다. 그 밖의 시도는 시군구를
// 이름순 자동 격자로 흘린다. 타일 이름은 data/src/regions 의 공식 명칭과 같아야 한다
// (care-map-layout.test.ts 가 검사한다).
// ============================================================

export interface SidoTile {
  slug: string;
  short: string; // 타일에 쓰는 짧은 이름
  col: number;
  row: number;
}

export const SIDO_GRID = { cols: 5, rows: 6 } as const;

export const SIDO_TILES: SidoTile[] = [
  { slug: "seoul", short: "서울", col: 1, row: 0 },
  { slug: "gyeonggi", short: "경기", col: 2, row: 0 },
  { slug: "gangwon", short: "강원", col: 3, row: 0 },
  { slug: "incheon", short: "인천", col: 0, row: 1 },
  { slug: "chungnam", short: "충남", col: 1, row: 1 },
  { slug: "chungbuk", short: "충북", col: 2, row: 1 },
  { slug: "gyeongbuk", short: "경북", col: 3, row: 1 },
  { slug: "sejong", short: "세종", col: 1, row: 2 },
  { slug: "daejeon", short: "대전", col: 2, row: 2 },
  { slug: "daegu", short: "대구", col: 3, row: 2 },
  { slug: "ulsan", short: "울산", col: 4, row: 2 },
  { slug: "jeonbuk", short: "전북", col: 1, row: 3 },
  { slug: "gyeongnam", short: "경남", col: 2, row: 3 },
  { slug: "busan", short: "부산", col: 3, row: 3 },
  { slug: "gwangju", short: "광주", col: 0, row: 4 },
  { slug: "jeonnam", short: "전남", col: 1, row: 4 },
  { slug: "jeju", short: "제주", col: 1, row: 5 },
];

export const SEOUL_GRID = { cols: 8, rows: 6 } as const;

/** 서울 25개 구 — 대략의 지리 배치 (북서 은평 → 남동 강동) */
export const SEOUL_TILES: Record<string, { col: number; row: number }> = {
  도봉구: { col: 5, row: 0 },
  노원구: { col: 6, row: 0 },
  은평구: { col: 2, row: 1 },
  강북구: { col: 5, row: 1 },
  서대문구: { col: 2, row: 2 },
  종로구: { col: 3, row: 2 },
  성북구: { col: 4, row: 2 },
  동대문구: { col: 5, row: 2 },
  중랑구: { col: 6, row: 2 },
  마포구: { col: 2, row: 3 },
  중구: { col: 3, row: 3 },
  용산구: { col: 4, row: 3 },
  성동구: { col: 5, row: 3 },
  광진구: { col: 6, row: 3 },
  강서구: { col: 0, row: 4 },
  양천구: { col: 1, row: 4 },
  영등포구: { col: 2, row: 4 },
  동작구: { col: 3, row: 4 },
  서초구: { col: 4, row: 4 },
  강남구: { col: 5, row: 4 },
  송파구: { col: 6, row: 4 },
  강동구: { col: 7, row: 4 },
  구로구: { col: 1, row: 5 },
  금천구: { col: 2, row: 5 },
  관악구: { col: 3, row: 5 },
};

/** 시군구 타일 라벨 — 3자 이름은 그대로, 4자 이상은 "구/시/군" 접미사를 뗀다 (동대문구 → 동대문, 서귀포시 → 서귀포) */
export function tileLabel(name: string): string {
  return name.length >= 4 ? name.replace(/(시|군|구)$/, "") : name;
}
