// ============================================================
// 블록 편집 모델 — 본문(마크다운 + 숏코드)을 블록 목록으로 오가게 한다. DB 없음 (순수).
//
// 저장 형식은 그대로 마크다운이다. 편집기(components/editor/block-editor.tsx)는 블록으로 보여 주고,
// 저장 직전에 다시 마크다운으로 합친다. 왕복 규칙:
//  - 빈 줄로 나뉜 덩어리 하나 = 블록 하나
//  - "## 제목" → h2, "### 소제목" → h3 (# 하나짜리도 h2 — 글 제목이 이미 h1 이다)
//  - 숏코드 한 줄 → 미디어 블록 (image / video / youtube / instagram)
//  - 그 밖(목록·인용·굵게·링크 포함) → 본문(p) 블록, 마크다운 원문 그대로
// ============================================================
import { extractEmbeds, shortcodeFor, type MediaRef } from "./media-ref";

export type TextBlock = { id: string; kind: "p" | "h2" | "h3"; text: string };
export type MediaBlock = {
  id: string;
  kind: "image" | "video" | "youtube" | "instagram";
  ref: MediaRef;
  /** image: 대체텍스트 · video: 캡션 · youtube/instagram: 창작자명 */
  label: string;
  /** image: 캡션 · youtube/instagram: 원본 링크 */
  extra: string;
};
export type Block = TextBlock | MediaBlock;

let seq = 0;
export function newBlockId(): string {
  seq += 1;
  return `b${Date.now().toString(36)}${seq.toString(36)}`;
}

const SHORTCODE_LINE = /^\s*\{\{(youtube|instagram|image|video):[^}]*\}\}\s*$/;

/** 마크다운 → 블록 목록 */
export function parseBlocks(md: string): Block[] {
  const chunks = md.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n+/);
  const out: Block[] = [];
  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (SHORTCODE_LINE.test(chunk)) {
      const e = extractEmbeds(chunk)[0];
      if (e) {
        const [second, third] = shortcodeParts(chunk);
        out.push({ id: newBlockId(), kind: e.ref.kind, ref: e.ref, label: second, extra: third });
        continue;
      }
      // 형식이 틀린 숏코드는 본문으로 남겨 고칠 수 있게 한다
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(chunk);
    if (heading && !chunk.includes("\n")) {
      out.push({ id: newBlockId(), kind: heading[1]!.length >= 3 ? "h3" : "h2", text: heading[2]! });
      continue;
    }
    out.push({ id: newBlockId(), kind: "p", text: chunk });
  }
  return out;
}

function shortcodeParts(line: string): [string, string] {
  const m = /^\s*\{\{[a-z]+:[^|}]*(?:\|([^|}]*))?(?:\|([^|}]*))?\}\}\s*$/.exec(line);
  return [(m?.[1] ?? "").trim(), (m?.[2] ?? "").trim()];
}

/** 블록 목록 → 마크다운 */
export function serializeBlocks(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === "p") {
      const t = b.text.trim();
      if (t) parts.push(t);
    } else if (b.kind === "h2" || b.kind === "h3") {
      const t = b.text.trim().replace(/\n+/g, " ");
      if (t) parts.push(`${b.kind === "h2" ? "##" : "###"} ${t}`);
    } else {
      parts.push(mediaShortcode(b as MediaBlock));
    }
  }
  return parts.join("\n\n") + (parts.length ? "\n" : "");
}

export function mediaShortcode(b: MediaBlock): string {
  switch (b.ref.kind) {
    case "image":
      return shortcodeFor(b.ref, { alt: b.label, caption: b.extra || undefined });
    case "video":
      return shortcodeFor(b.ref, { caption: b.label || undefined });
    case "youtube":
      return shortcodeFor(b.ref, { creator: b.label, originalUrl: b.extra || undefined });
    case "instagram":
      return shortcodeFor(b.ref, { creator: b.label, originalUrl: b.extra || undefined });
  }
}

export function textBlock(kind: TextBlock["kind"], text = ""): TextBlock {
  return { id: newBlockId(), kind, text };
}

export function mediaBlock(ref: MediaRef, label = "", extra = ""): MediaBlock {
  return { id: newBlockId(), kind: ref.kind, ref, label, extra };
}

/** 편집기가 비어 있지 않게 — 블록이 없으면 빈 본문 블록 하나 */
export function ensureBlocks(blocks: Block[]): Block[] {
  return blocks.length > 0 ? blocks : [textBlock("p")];
}
