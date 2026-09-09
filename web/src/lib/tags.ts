// ============================================================
// 게시물 태그 — 글과 별도로 붙이는 키워드(guides.tags)이면서, 본문 안에 #태그 로도 쓸 수 있다.
//  - 저장 시 태그 칸의 값과 본문의 #태그 를 합친다 (mergeTags).
//  - 렌더 시 본문의 #태그 는 /tag/<태그> 링크가 된다 (linkifyHashtags — 제목·코드·숏코드·주소는 건드리지 않는다).
//  - 정규화: 앞의 # 제거, 공백 제거, 소문자, 30자, 글자·숫자·_·-··(가운뎃점)·. 만. 글자가 하나는 있어야 한다 (#1 같은 것은 태그가 아니다).
// DB 없음 (순수).
// ============================================================

export const MAX_TAGS = 10;
/** 본문 #태그 까지 합친 뒤의 상한 */
export const MAX_TAGS_MERGED = 20;
export const MAX_TAG_LENGTH = 30;

const TAG_BODY = /^[\p{L}\p{N}_][\p{L}\p{N}_\-·.]*$/u;
const HAS_LETTER = /\p{L}/u;

export function normalizeTag(raw: string): string | null {
  // 문장 끝의 마침표·하이픈·가운뎃점은 태그가 아니라 문장 부호다
  let t = raw.trim().replace(/^#+/, "").replace(/\s+/g, "").replace(/[.\-·]+$/, "").toLowerCase();
  if (!t) return null;
  t = t.slice(0, MAX_TAG_LENGTH);
  if (!TAG_BODY.test(t) || !HAS_LETTER.test(t)) return null;
  return t;
}

/** 태그 칸 입력(쉼표·줄바꿈·공백 구분, # 있어도 됨) → 정규화·중복 제거, 최대 MAX_TAGS */
export function parseTagInput(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const piece of raw.split(/[,\n\s]+/)) {
    const t = normalizeTag(piece);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// 앞에 글자·숫자·_·&·/·# 이 붙은 # 은 태그가 아니다 (주소의 #fragment, &#39; 같은 엔티티, C# 같은 낱말 속 #)
const HASHTAG_RE = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_][\p{L}\p{N}_\-·.]{0,29})/gu;

function isSkippedLine(line: string): boolean {
  return /^#{1,6}\s/.test(line) || /^\s*\{\{/.test(line) || /^\s*<!--EMBED:\d+-->\s*$/.test(line);
}

/** 코드 펜스 밖·인라인 코드 밖·링크 밖의 문장 조각마다 fn 을 적용한다 */
function mapProse(md: string, fn: (text: string) => string): string {
  const lines = md.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || isSkippedLine(line)) return line;
      // 인라인 코드(`…`)와 마크다운 링크([…](…))는 그대로 두고 나머지만 처리
      return line
        .split(/(`[^`]*`|\[[^\]]*\]\([^)]*\))/)
        .map((seg, i) => (i % 2 === 1 ? seg : fn(seg)))
        .join("");
    })
    .join("\n");
}

/** 본문의 #태그 (정규화·중복 제거) */
export function hashtagsIn(bodyMd: string): string[] {
  const out: string[] = [];
  mapProse(bodyMd, (text) => {
    for (const m of text.matchAll(HASHTAG_RE)) {
      const t = normalizeTag(m[2]!);
      if (t && !out.includes(t)) out.push(t);
    }
    return text;
  });
  return out;
}

/** 본문의 #태그 → [#태그](/tag/태그) 마크다운 링크 (렌더 직전에 쓴다) */
export function linkifyHashtags(bodyMd: string): string {
  return mapProse(bodyMd, (text) =>
    text.replace(HASHTAG_RE, (whole, pre: string, name: string) => {
      const core = name.replace(/[.\-·]+$/, "");
      const rest = name.slice(core.length);
      const t = normalizeTag(core);
      if (!t) return whole;
      return `${pre}[#${core}](/tag/${encodeURIComponent(t)})${rest}`;
    }),
  );
}

/** 태그 칸 + 본문 #태그 — 칸의 순서를 앞에, 본문 것은 뒤에. 상한 MAX_TAGS_MERGED */
export function mergeTags(explicit: string[], fromBody: string[]): string[] {
  const out: string[] = [];
  for (const t of [...explicit, ...fromBody]) {
    if (!out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS_MERGED) break;
  }
  return out;
}

export function tagHref(tag: string): string {
  return `/tag/${encodeURIComponent(tag)}`;
}
