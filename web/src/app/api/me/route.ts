// 현재 회원·관리자 여부 — 헤더 메뉴·댓글 폼·글 관리 버튼이 마운트 후 조회한다.
// 서버 컴포넌트에서 cookies() 를 읽으면 ISR 페이지가 전부 동적으로 바뀌므로, 로그인 상태는
// 이 라우트로만 알아낸다 (페이지 HTML 은 로그인 여부와 무관하게 동일).
import { NextResponse } from "next/server";
import { getAuthFlow, isAdmin } from "@/lib/auth";
import { getCurrentMember } from "@/lib/member";

export const dynamic = "force-dynamic";

export async function GET() {
  const [member, admin, flow] = await Promise.all([getCurrentMember(), isAdmin(), getAuthFlow("profile")]);
  return NextResponse.json(
    {
      member: member ? { id: member.id, displayName: member.displayName } : null,
      // admin: 관리자 세션이 있으면 글 페이지에 관리 버튼을 띄운다 (components/admin-guide-bar.tsx)
      admin,
      // onboarding: 첫 로그인 닉네임 정하기가 남아 있으면 팝업을 띄운다 (components/onboarding-modal.tsx)
      onboarding: !member && flow?.uid ? { suggested: flow.suggest ?? "" } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
