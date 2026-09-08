// 현재 회원 — 헤더 메뉴·댓글 폼이 마운트 후 조회한다.
// 서버 컴포넌트에서 cookies() 를 읽으면 ISR 페이지가 전부 동적으로 바뀌므로, 로그인 상태는
// 이 라우트로만 알아낸다 (페이지 HTML 은 로그인 여부와 무관하게 동일).
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getCurrentMember();
  return NextResponse.json(
    { member: member ? { id: member.id, displayName: member.displayName } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
