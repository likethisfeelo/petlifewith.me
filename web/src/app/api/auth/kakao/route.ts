// 카카오 로그인 시작 — Cognito OAuth 엔드포인트(identity_provider=Kakao)로 보낸다.
// 콜백 주소는 사이트 기본 주소 하나뿐이라(Cognito 앱 클라이언트 등록값), www 등 다른 호스트로 들어왔으면 먼저 옮긴다
// — state 를 담는 흐름 쿠키가 콜백과 같은 호스트에 있어야 한다.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { setAuthFlow } from "@/lib/auth";
import { kakaoAuthorizeUrl } from "@/lib/cognito";
import { siteUrl } from "@/lib/config";
import { safeNextPath } from "@/lib/member";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const site = new URL(siteUrl());
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  if (host && host !== site.host) {
    return NextResponse.redirect(new URL(`/api/auth/kakao${req.nextUrl.search}`, site));
  }
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));
  const state = randomBytes(24).toString("base64url");
  const url = kakaoAuthorizeUrl(state, `${site.origin}/api/auth/callback`);
  if (!url) return NextResponse.redirect(new URL("/login?error=kakao_failed", site));
  await setAuthFlow({ step: "kakao", state, next });
  return NextResponse.redirect(url);
}
