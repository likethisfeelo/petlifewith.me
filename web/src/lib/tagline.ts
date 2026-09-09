// ============================================================
// 브랜드 태그라인 — 브랜드명 옆·푸터에 붙는 한 줄.
// 기본은 "행복한 삶", 놀이 클러스터(/topic/play 와 그 글)에서는 "즐거운 삶"으로 바뀐다.
// 두 문구는 글자 수가 같아 바뀌어도 머리글 폭이 흔들리지 않는다.
// env(NEXT_PUBLIC_SITE_TAGLINE)로 덮어쓰면 토픽과 무관하게 그 문구 하나만 쓴다 (lib/config.ts).
// ============================================================

export const DEFAULT_TAGLINE = "반려동물의 행복한 삶, 나와 함께 - pet life with me";

export const TOPIC_TAGLINES: Record<string, string> = {
  play: "반려동물의 즐거운 삶, 나와 함께 - pet life with me",
};

/** 토픽별 태그라인 — 정해 둔 토픽이 아니면 기본 문구 */
export function taglineForTopic(topic: string | null | undefined): string {
  return (topic && TOPIC_TAGLINES[topic]) || DEFAULT_TAGLINE;
}

/** 주소에서 토픽 슬러그를 읽는다 — /topic/play, /topic/play/curated, /topic/play/challenge … */
export function topicFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const m = /^\/topic\/([^/?#]+)/.exec(pathname);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}
