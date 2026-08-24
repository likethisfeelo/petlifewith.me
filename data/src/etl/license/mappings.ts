// 인허가 데이터 매핑 선언부.
// 실제 CSV 헤더는 이 후보 목록과 대조해 해석하며, 필수 필드를 못 찾으면
// 적재하지 않고 실패한다. 여기 없는 값을 코드가 임의로 추측하지 않는다.
//
// 소스: data.go.kr (지방행정 인허가 — localdata 는 공공데이터포털로 통합됨)

export const LICENSE_HEADER_SPEC = {
  name: { candidates: ["사업장명"], required: true },
  mgmtNo: { candidates: ["관리번호"], required: true },
  roadAddress: { candidates: ["도로명전체주소", "소재지도로명주소"], required: false },
  lotAddress: { candidates: ["소재지전체주소", "소재지지번주소"], required: false },
  statusName: { candidates: ["영업상태명", "영업상태구분명"], required: false },
  statusDetailName: { candidates: ["상세영업상태명"], required: false },
  licenseDate: { candidates: ["인허가일자"], required: false },
  closedDate: { candidates: ["폐업일자"], required: false },
  phone: { candidates: ["소재지전화"], required: false },
  bizKind: { candidates: ["업태구분명"], required: false },
  coordX: { candidates: ["좌표정보(x)", "좌표정보(X)", "좌표정보x", "좌표정보X"], required: false },
  coordY: { candidates: ["좌표정보(y)", "좌표정보(Y)", "좌표정보y", "좌표정보Y"], required: false },
  lastModified: { candidates: ["최종수정시점", "데이터갱신일자"], required: false },
} satisfies Record<string, { candidates: string[]; required: boolean }>;

// 인허가 좌표는 통상 중부원점 TM 계열로 알려져 있으나, 데이터셋별로 좌표계를
// 확인하기 전에는 위경도로 변환하지 않는다. 원본값 + 표기만 저장한다.
export const RAW_COORD_SYSTEM_LABEL = "localdata-tm-unverified";

export interface SpotDatasetDef {
  kind: "spot";
  label: string;
  spotTypeSlug: string;
}
export interface FeedDatasetDef {
  kind: "feed";
  label: string;
}
export type DatasetDef = SpotDatasetDef | FeedDatasetDef;

export const DATASETS: Record<string, DatasetDef> = {
  // 스팟 시딩 (기획서 4-1)
  "animal-beauty": { kind: "spot", label: "동물미용업", spotTypeSlug: "grooming" },
  "animal-boarding": { kind: "spot", label: "동물위탁관리업", spotTypeSlug: "boarding" },
  "animal-memorial": { kind: "spot", label: "동물장묘업", spotTypeSlug: "memorial" },
  "animal-transport": { kind: "spot", label: "동물운송업", spotTypeSlug: "transport" },
  // 메이커 배지 근거 (기획서 4-4) — feed_licenses 원장으로 적재
  "feed-manufacture": { kind: "feed", label: "사료제조업" },
};

/** 영업상태 문자열 → 내부 상태. 매핑 안 되면 unknown 으로 적재하고 리포트에 남긴다. */
export function mapBizStatus(...names: Array<string | undefined | null>): {
  status: "operating" | "suspended" | "closed" | "unknown";
  matchedOn: string | null;
} {
  for (const raw of names) {
    const s = raw?.trim();
    if (!s) continue;
    if (/(폐업|취소|말소|만료|정지|중지|폐쇄)/.test(s)) return { status: "closed", matchedOn: s };
    if (/휴업/.test(s)) return { status: "suspended", matchedOn: s };
    if (/(영업|정상|운영)/.test(s)) return { status: "operating", matchedOn: s };
  }
  const first = names.find((n) => n?.trim());
  return { status: "unknown", matchedOn: first?.trim() ?? null };
}

/** "20230115" / "2023-01-15" → "2023-01-15". 해석 불가면 null. */
export function parseDate(raw: string | undefined | null): string | null {
  const s = raw?.trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

export function parseNum(raw: string | undefined | null): number | null {
  const s = raw?.trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
