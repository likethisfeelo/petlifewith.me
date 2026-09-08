// 신체 영역 Q&A → 게시글 시드 (순수 함수).
// 지도 패널의 질문 하나가 곧 게시글 하나다: 클릭하면 그 글로 가고, 댓글이 달린다.
// 글은 짧아서 web 의 얇은 콘텐츠 게이트(shouldIndexGuide)에 걸려 noindex 로 시작한다 —
// 관리자가 본문을 늘리면 그때 색인된다. 의료 인접 플래그는 켜지 않는다: 관찰 포인트와
// "병원에서 확인" 결론까지만 담는 짧은 글이라서다. 감수 후 관리자가 켜서 관리할 수 있다.
import { SENIOR_BODY_AREAS, type GuideCategoryDef } from "./categories.js";

export interface SeedPost {
  slug: string;
  title: string;
  summary: string;
  bodyMd: string;
  category: string;
  /** 시드 글은 실제 글보다 아래에 오도록 고정된 과거 발행일을 쓴다 */
  publishedAt: Date;
}

const BASE_DATE = Date.UTC(2026, 7, 1, 0, 0, 0); // 2026-08-01

export function areaSeedPosts(area: GuideCategoryDef, areaIndex: number): SeedPost[] {
  return area.questions.map((q, i) => ({
    slug: `senior-${area.slug}-q${i + 1}`,
    title: q.q,
    summary: q.a.length > 200 ? `${q.a.slice(0, 197)}…` : q.a,
    bodyMd: [
      `## 이런 신호가 보일 때`,
      ``,
      q.a,
      ``,
      `## 기록해 두면 좋은 것`,
      ``,
      `- 언제부터, 하루 몇 번, 어떤 상황에서 그랬는지`,
      `- 같이 달라진 것 (식욕·수면·산책 거리 등)`,
      ``,
      `이 신호가 며칠 이어지거나 갑자기 심해지면 동물병원에서 확인하세요. 진료 때 위 기록을 그대로 보여주면 됩니다.`,
    ].join("\n"),
    category: area.slug,
    // 영역 순서·질문 순서대로 1분씩 뒤로 — 목록에서 정의 순서가 유지되면서도 실제 새 글이 항상 위에 온다
    publishedAt: new Date(BASE_DATE - (areaIndex * 10 + i) * 60_000),
  }));
}

/** 노견생활 신체 영역 전체의 시드 글 */
export function seniorSeedPosts(): SeedPost[] {
  return SENIOR_BODY_AREAS.flatMap((area, idx) => areaSeedPosts(area, idx));
}
