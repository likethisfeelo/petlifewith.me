// 회원 글·댓글 입력 한도 — 서버 액션과 클라이언트 폼이 같은 값을 쓴다
// ("use server" 파일은 async 함수만 내보낼 수 있어 상수를 여기에 둔다)
export const POST_TITLE_MAX = 80;
export const POST_SUMMARY_MAX = 200;
export const POST_BODY_MIN = 30;
export const POST_BODY_MAX = 20_000;
export const COMMENT_MAX = 1000;
export const MAX_PENDING_POSTS = 5;
export const MAX_COMMENTS_PER_HOUR = 20;
/** 회원 한 사람이 한 시간에 올릴 수 있는 파일 수 (스팸·저장소 남용 방지 — 글당 개수 한도는 관리자 설정 member_media) */
export const MAX_UPLOADS_PER_HOUR = 40;
