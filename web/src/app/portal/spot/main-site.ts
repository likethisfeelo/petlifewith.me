// 메인 사이트 주소 (가입·로그인·내 업체 관리) — 등록 화면은 service.<apex> 에서도 열리는데,
// 거기서는 /signup 같은 경로도 /portal/spot 아래로 재작성되므로(lib/hosts.ts) 메인 주소로 보낸다.
export const MAIN_SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
