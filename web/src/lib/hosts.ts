// ============================================================
// 기능별 서브도메인 → 경로 매핑 (middleware 에서 사용)
//
//   admin.<apex>    → /admin        전체 관리자 (블로그 글 포함)
//   service.<apex>  → /portal/spot  업체 정보 — 사장님용
//   product.<apex>  → /portal/product  제품·브랜드 등록 — 사장님용
//   link.<apex>     → /l            업체 링크 페이지 (link.<apex>/123, link.<apex>/짧은주소)
//   dev.<apex>      → (매핑 없음)   개발 배포는 별도 스택. NEXT_PUBLIC_SITE_ENV=preview
//
// 하이픈 형식: apex 가 이미 서브도메인인 스테이지(dev.petlifewith.me)에서는
// admin.dev.petlifewith.me 가 2단계라 와일드카드 인증서(*.petlifewith.me)에 안 잡힌다.
// 대신 <sub>-<apex> (admin-dev.petlifewith.me 등) 를 같은 서브도메인으로 취급한다.
//
// 기획서의 "지역별 서브도메인 금지"(SECTION 01)는 콘텐츠 SEO 이야기다.
// 여기는 운영용 기능 분리라 그 결정과 충돌하지 않는다 — 지역 URL 은
// 계속 단일 도메인 서브폴더(/spot/[시도]/[시군구])로 간다.
//
// 순수 함수로 분리한 이유: middleware 는 Edge 런타임이라 테스트가 어렵다.
// 매핑 로직만 여기서 단위 테스트한다.
// ============================================================

/** 호스트 헤더에서 서브도메인을 뽑는다. apex 자신·www 는 null. */
export function subdomainOf(hostHeader: string, apex: string): string | null {
  const host = hostHeader.split(":")[0]?.trim().toLowerCase() ?? "";
  const apexHost = apex.trim().toLowerCase();
  if (!host || !apexHost) return null;
  if (host === apexHost || host === `www.${apexHost}`) return null;
  if (host.endsWith(`.${apexHost}`)) {
    const sub = host.slice(0, -(apexHost.length + 1));
    // a.b.<apex> 같은 다단계는 다루지 않는다
    return sub.includes(".") ? null : sub;
  }
  // 하이픈 형식 <sub>-<apex> — apex 자체가 서브도메인(라벨 3개 이상)일 때만.
  // 운영 apex(petlifewith.me)에서 admin-petlifewith.me 같은 남의 도메인이 잡히지 않게 한다.
  if (apexHost.split(".").length >= 3 && host.endsWith(`-${apexHost}`)) {
    const sub = host.slice(0, -(apexHost.length + 1));
    return sub && !sub.includes(".") ? sub : null;
  }
  return null;
}

const SUBDOMAIN_PREFIX: Record<string, string> = {
  admin: "/admin",
  service: "/portal/spot",
  product: "/portal/product",
  link: "/l",
};

/**
 * 서브도메인에 맞는 rewrite 경로. 재작성이 불필요하면 null.
 * 이미 접두사가 붙은 경로(앱 내부 redirect("/admin/login") 등)는 그대로 둔다 —
 * 이중 접두사(/admin/admin/...)를 막는다.
 */
export function rewritePathForHost(sub: string | null, pathname: string): string | null {
  if (!sub) return null;
  const prefix = SUBDOMAIN_PREFIX[sub];
  if (!prefix) return null; // dev. 등 알 수 없는 서브도메인은 메인 앱 그대로
  if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return null;
  return pathname === "/" ? prefix : `${prefix}${pathname}`;
}
