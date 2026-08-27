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
