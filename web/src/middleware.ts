// 호스트 기반 서브도메인 라우팅.
// Edge 런타임 — Node 전용 API 를 쓰지 않는다 (claude.md 10-6).
// 정적 자산·사이트맵·robots 는 matcher 에서 제외해 모든 호스트에서 그대로 서빙된다.
import { NextResponse, type NextRequest } from "next/server";
import { apexDomain } from "@/lib/config";
import { rewritePathForHost, subdomainOf } from "@/lib/hosts";

export function middleware(req: NextRequest) {
  const sub = subdomainOf(req.headers.get("host") ?? "", apexDomain());
  const target = rewritePathForHost(sub, req.nextUrl.pathname);
  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon\\.ico|icon\\.svg|apple-icon\\.png|robots\\.txt|ads\\.txt|sitemap\\.xml|sitemaps/).*)"],
};
