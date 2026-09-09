// ============================================================
// 회원 게시판 이름 — 토픽별.
// "일반" 은 게시판 종류 표시(큐레이션 콘텐츠·부위별 게시판과 구분)이고, 이름은 토픽마다 다르다.
// 주소는 /topic/[토픽]/challenge 그대로다 (처음 이름이 "도전 게시판"이었다 — 2026-09 개명).
// ============================================================

export const MEMBER_BOARD_KIND = "일반";

const NAMES: Record<string, string> = {
  "senior-life": "노령견 생활 공유 게시판",
};

/** 게시판 이름 — 토픽에 정해 둔 이름이 없으면 "<토픽명> 생활 공유 게시판" */
export function memberBoardName(topicSlug: string, topicName: string): string {
  return NAMES[topicSlug] ?? `${topicName} 생활 공유 게시판`;
}

/** 종류를 붙인 전체 이름 — 제목·빵부스러기·구조화 데이터용. 예: "일반 - 노령견 생활 공유 게시판" */
export function memberBoardLabel(topicSlug: string, topicName: string): string {
  return `${MEMBER_BOARD_KIND} - ${memberBoardName(topicSlug, topicName)}`;
}
