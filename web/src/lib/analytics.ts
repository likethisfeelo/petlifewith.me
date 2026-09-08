// ============================================================
// 애널리틱스 로드 판정 — 순수 함수 (컴포넌트는 이 판정만 따른다)
//
// 제외 대상:
//  - 관리자 화면. admin.<apex> 호스트는 브라우저 경로가 "/" 라서 경로만으로는
//    걸러지지 않는다 (미들웨어가 내부에서만 /admin 으로 재작성). 호스트도 본다.
//    내부 사용량이 통계에 섞이는 것과 관리 URL(개체 ID 포함)이 GA 로 전송되는 것을 막는다.
//  - production 이 아닌 환경은 아예 마운트하지 않는다 (layout.tsx, config.siteEnv).
// ============================================================
import { subdomainOf } from "./hosts";

export function isAnalyticsExcludedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAnalyticsExcluded(pathname: string, host: string, apex: string): boolean {
  if (isAnalyticsExcludedPath(pathname)) return true;
  return subdomainOf(host, apex) === "admin";
}

// ---------- AdSense ----------
// 광고 스크립트는 통계보다 범위가 좁다 (기획서 4-1·claude.md 6-2):
//  - 관리자·사장님 포털·클레임 폼: 광고를 붙일 화면이 아니다 (포털 호스트 service./product. 포함)
//  - /rehab: 의료 인접 "무료 노출 전용" 목록 — 광고 상품이 되면 안 된다
//  - 장묘·동물약국·B2B(monetizable=false)·의료 인접 게시글은 경로만으로 알 수 없어 페이지가
//    <meta name="petlife-ads" content="off"> 로 표시한다 (lib/seo.ts buildMeta({ ads: false }))

/** 광고 미허용 페이지가 head 에 넣는 메타 이름 — 클라이언트 로더가 이 값을 보고 로드를 건너뛴다 */
export const ADS_OPT_OUT_META = "petlife-ads";

export function isAdsExcludedPath(pathname: string): boolean {
  if (isAnalyticsExcludedPath(pathname)) return true;
  return ["/portal", "/claim", "/rehab"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAdsExcluded(pathname: string, host: string, apex: string): boolean {
  if (isAdsExcludedPath(pathname)) return true;
  const sub = subdomainOf(host, apex);
  return sub === "admin" || sub === "service" || sub === "product";
}
