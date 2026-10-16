// Cognito OAuth 콜백 — 카카오 인증을 마친 Cognito 가 code·state 를 붙여 돌려보낸다.
// state 를 흐름 쿠키와 대조하고, code 를 토큰으로 바꿔 ID 토큰을 검증한 뒤 사이트 세션을 굽는다(lib/identity.ts).
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clearAuthFlow, getAuthFlow } from "@/lib/auth";
import { exchangeCode } from "@/lib/cognito";
import { siteUrl } from "@/lib/config";
import { completeSignIn } from "@/lib/identity";

export const dynamic = "force-dynamic";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const site = new URL(siteUrl());
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, site));
  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    // 사용자가 카카오 동의 화면에서 취소한 경우 등
    await clearAuthFlow();
    return fail(params.get("error") === "access_denied" ? "kakao_cancelled" : "kakao_failed");
  }
  const flow = await getAuthFlow("kakao");
  const code = params.get("code");
  const state = params.get("state");
  if (!flow?.state || !code || !state || !sameState(flow.state, state)) return fail("expired");

  const tokens = await exchangeCode(code, `${site.origin}/api/auth/callback`);
  await clearAuthFlow();
  if (!tokens) return fail("kakao_failed");
  const out = await completeSignIn(tokens, { next: flow.next ?? "/me" });
  if (out.error) return fail(out.error.includes("제한") ? "blocked" : "kakao_failed");
  return NextResponse.redirect(new URL(out.redirectTo ?? "/me", site));
}
