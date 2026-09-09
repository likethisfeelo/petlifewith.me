// ============================================================
// 돌봄 파트너(펫시터·펫산책) 디렉토리 — 공용 상수
//
// 두 유형은 "시설"이 아니라 사람이 움직이는 서비스라 주소 대신 **서비스 지역**(시군구)으로
// 노출된다. 지역마다 노출 자리는 MAX_EXPOSED_PER_AREA 개, 관리자가 지역별 ON/OFF 를 정한다.
// 지역 단위는 regions 테이블(시도/시군구, 일반구는 시로 합침)을 그대로 쓴다.
// ============================================================

// 순서 = 관리자 탭·목록 순서. 두 시터는 돌봄 장소로 갈린다 —
// pet-sitter(펫시터)는 보호자 집으로 가는 방문 돌봄, hourly-sitter(시간제 시터, 2026-09 신설)는
// 시터 집에 아이를 맡기는 시간 단위 돌봄.
export const CARE_TYPE_SLUGS = ["pet-sitter", "hourly-sitter", "dog-walk"] as const;
export type CareTypeSlug = (typeof CARE_TYPE_SLUGS)[number];

export function isCareType(slug: string | null | undefined): slug is CareTypeSlug {
  return (CARE_TYPE_SLUGS as readonly string[]).includes(slug ?? "");
}

/** 지역(시군구) x 유형당 공개 노출 자리 수 */
export const MAX_EXPOSED_PER_AREA = 5;

/** 통칭 — 시터와 산책 제공자를 함께 부를 때 */
export const CARE_PROVIDER_LABEL = "돌봄 파트너";

/** 유형별 사람 호칭 (spot_types.name 은 서비스명: 펫시터 / 펫산책) */
export const CARE_PERSON_LABEL: Record<CareTypeSlug, string> = {
  "pet-sitter": "펫시터",
  "hourly-sitter": "시간제 시터",
  "dog-walk": "도그워커",
};

export function carePersonLabel(slug: string): string {
  return isCareType(slug) ? CARE_PERSON_LABEL[slug] : CARE_PROVIDER_LABEL;
}

/**
 * 큐레이션 CSV 의 서비스지역 셀 → 지역 문자열 목록.
 * "서울특별시 마포구 | 서울특별시 서대문구" 처럼 | 또는 ; 로 구분한다. 빈 조각은 버린다.
 */
export function parseAreaListCell(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[|;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
