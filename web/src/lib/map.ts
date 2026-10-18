// 지도 공급자 설정·외부 지도 주소 — 지금은 카카오 지도, 나중에 구글로 옮길 때 여기와 components/map 만 바꾼다.
// 키: NEXT_PUBLIC_KAKAO_MAP_KEY (Kakao Developers → 앱 키 → JavaScript 키, 플랫폼 Web 에 사이트 도메인 등록)

export type MapProvider = "kakao";

export function mapProvider(): MapProvider {
  return "kakao";
}

/** 브라우저에서 쓰는 지도 키 (빌드 때 박힌다). 없으면 지도 대신 "지도에서 보기" 링크만 */
export function kakaoMapKey(): string | undefined {
  return process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || undefined;
}

/** 외부 지도 앱으로 열기 — 위경도가 있으면 그 자리, 없으면 주소 검색 */
export function externalMapUrl(input: { name: string; lat?: number | null; lng?: number | null; address?: string | null }): string {
  if (input.lat != null && input.lng != null) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(input.name)},${input.lat},${input.lng}`;
  }
  return `https://map.kakao.com/?q=${encodeURIComponent(input.address || input.name)}`;
}
