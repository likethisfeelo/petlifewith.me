// ============================================================
// 미디어 참조 — 본문 숏코드·대표 영상(guides.hero_media)·카드 섬네일을 한 형식으로 다룬다. DB 없음 (순수).
//
//  - 본문 숏코드: {{video:키|캡션}} {{image:키|대체|캡션}} {{youtube:ID|창작자|원본}} {{instagram:URL|창작자|원본}} (lib/markdown.ts)
//  - 대표 영상 문자열: "video:<키>" | "youtube:<ID>" | "instagram:<URL>". 비우면 본문 첫 영상이 대표.
//  - 인스타그램은 게시물(/p/)·릴스(/reel/)만 — 스토리·프로필·하이라이트는 임베드하지 않는다.
//  - 유튜브 섬네일은 공식 섬네일 URL(i.ytimg.com)을 그대로 쓴다 — 재호스팅이 아니다.
// ============================================================

export type MediaRef =
  | { kind: "video"; key: string }
  | { kind: "image"; key: string }
  | { kind: "youtube"; id: string }
  | { kind: "instagram"; url: string };

export type VideoRef = Exclude<MediaRef, { kind: "image" }>;

export const YOUTUBE_ID_RE = /^[\w-]{5,20}$/;

/** 유튜브 주소 → 영상 ID. watch?v= · youtu.be/ · shorts/ · embed/ · live/ 를 받는다. */
export function youtubeIdFromUrl(raw: string): string | null {
  const s = raw.trim();
  if (YOUTUBE_ID_RE.test(s) && !/^https?:/i.test(s) && s.length === 11) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
      id = m?.[2] ?? null;
    }
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

/**
 * 인스타그램 주소 → 정규화된 퍼머링크. 게시물(/p/코드/)과 릴스(/reel/코드/, /reels/코드/)만 허용하고
 * 그 밖(스토리·프로필·하이라이트·탐색)은 null.
 */
export function instagramPermalink(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "instagram.com") return null;
  const m = /^\/(?:[\w.]+\/)?(p|reel|reels)\/([\w-]{5,40})\/?$/.exec(u.pathname);
  if (!m) return null;
  const type = m[1] === "p" ? "p" : "reel";
  return `https://www.instagram.com/${type}/${m[2]}/`;
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

/** "video:키" 같은 문자열 → 참조. 형식이 틀리면 null */
export function parseMediaRef(raw: string | null | undefined): VideoRef | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i <= 0) return null;
  const kind = raw.slice(0, i);
  const rest = raw.slice(i + 1).trim();
  if (!rest) return null;
  if (kind === "video") return { kind, key: rest };
  if (kind === "youtube") return YOUTUBE_ID_RE.test(rest) ? { kind, id: rest } : null;
  if (kind === "instagram") {
    const url = instagramPermalink(rest);
    return url ? { kind, url } : null;
  }
  return null;
}

export function serializeMediaRef(ref: MediaRef): string {
  switch (ref.kind) {
    case "video":
    case "image":
      return `${ref.kind}:${ref.key}`;
    case "youtube":
      return `youtube:${ref.id}`;
    case "instagram":
      return `instagram:${ref.url}`;
  }
}

export function sameRef(a: MediaRef | null, b: MediaRef | null): boolean {
  return !!a && !!b && serializeMediaRef(a) === serializeMediaRef(b);
}

const EMBED_LINE_RE = /^\{\{(youtube|instagram|image|video):([^|{}]+)(?:\|([^|{}]*))?(?:\|([^|{}]*))?\}\}\s*$/gm;

export interface BodyEmbed {
  ref: MediaRef;
  /** 캡션·대체텍스트·창작자명 — 목록 라벨용 */
  label: string | null;
  /** 유튜브·인스타그램에 창작자명과 원본 링크가 다 있는가 (없으면 렌더에서 막힌다 — 운영 규칙 3-4) */
  complete: boolean;
}

/** 본문의 숏코드를 순서대로 뽑는다. 형식이 틀린 줄(유튜브 ID·인스타 URL 불량)은 건너뛴다. */
export function extractEmbeds(bodyMd: string): BodyEmbed[] {
  const out: BodyEmbed[] = [];
  for (const m of bodyMd.matchAll(EMBED_LINE_RE)) {
    const kind = m[1]!;
    const ref = m[2]!.trim();
    const second = m[3]?.trim() || null;
    const third = m[4]?.trim() || null;
    if (kind === "video") out.push({ ref: { kind, key: ref }, label: second, complete: true });
    else if (kind === "image") out.push({ ref: { kind, key: ref }, label: second, complete: true });
    else if (kind === "youtube") {
      if (!YOUTUBE_ID_RE.test(ref)) continue;
      out.push({ ref: { kind, id: ref }, label: second, complete: !!second && !!third });
    } else {
      const url = instagramPermalink(ref);
      if (!url) continue;
      out.push({ ref: { kind: "instagram", url }, label: second, complete: !!second && !!third });
    }
  }
  return out;
}

/** 본문의 영상만 (업로드·유튜브·인스타그램) — 대표 영상 후보 */
export function videoEmbeds(bodyMd: string): BodyEmbed[] {
  return extractEmbeds(bodyMd).filter((e) => e.ref.kind !== "image");
}

/** 대표 영상: 지정값이 본문에 있으면 그것, 아니면 본문 첫 영상 */
export function resolveHeroVideo(heroMedia: string | null | undefined, bodyMd: string): VideoRef | null {
  const videos = videoEmbeds(bodyMd).map((e) => e.ref as VideoRef);
  const chosen = parseMediaRef(heroMedia);
  if (chosen && videos.some((v) => sameRef(v, chosen))) return chosen;
  return videos[0] ?? null;
}

export interface CardMedia {
  /** 호버 재생·배지용 대표 영상 (없으면 이미지 카드) */
  video: VideoRef | null;
  /** 섬네일 오브젝트 키 (업로드 이미지) — 대표 이미지 → 영상 포스터 → 본문 첫 이미지 */
  thumbKey: string | null;
  /** 섬네일 절대 URL (유튜브 공식 섬네일) — thumbKey 가 없을 때 */
  thumbUrl: string | null;
}

/**
 * 카드에 쓸 미디어. 섬네일 우선순위: 대표 이미지 → 업로드 영상 포스터 → 유튜브 섬네일 → 본문 첫 이미지 → 없음(자리표시).
 * posterByKey: 업로드 영상 키 → 포스터 이미지 키 (media_assets.poster_key)
 */
export function pickCardMedia(
  guide: { heroMedia: string | null; heroImageKey: string | null; bodyMd: string },
  posterByKey: Record<string, string | null | undefined> = {},
): CardMedia {
  const video = resolveHeroVideo(guide.heroMedia, guide.bodyMd);
  let thumbKey: string | null = guide.heroImageKey || null;
  let thumbUrl: string | null = null;
  if (!thumbKey && video?.kind === "video") thumbKey = posterByKey[video.key] || null;
  if (!thumbKey && video?.kind === "youtube") thumbUrl = youtubeThumbUrl(video.id);
  if (!thumbKey && !thumbUrl) {
    const firstImage = extractEmbeds(guide.bodyMd).find((e) => e.ref.kind === "image");
    if (firstImage && firstImage.ref.kind === "image") thumbKey = firstImage.ref.key;
  }
  return { video, thumbKey, thumbUrl };
}

/** 본문에 든 업로드 자산 키 (이미지·영상) — 소유·존재 검사용 */
export function uploadedKeysIn(bodyMd: string): { images: string[]; videos: string[] } {
  const images: string[] = [];
  const videos: string[] = [];
  for (const e of extractEmbeds(bodyMd)) {
    if (e.ref.kind === "image") images.push(e.ref.key);
    else if (e.ref.kind === "video") videos.push(e.ref.key);
  }
  return { images: [...new Set(images)], videos: [...new Set(videos)] };
}

/** 숏코드 한 줄 만들기 — 편집기 툴바가 쓴다 */
export function shortcodeFor(ref: MediaRef, opts: { caption?: string; alt?: string; creator?: string; originalUrl?: string } = {}): string {
  const clean = (s: string | undefined) => (s ?? "").replace(/[|{}\n]/g, " ").trim();
  switch (ref.kind) {
    case "image":
      return `{{image:${ref.key}|${clean(opts.alt) || "사진"}${opts.caption ? `|${clean(opts.caption)}` : ""}}}`;
    case "video":
      return `{{video:${ref.key}${opts.caption ? `|${clean(opts.caption)}` : ""}}}`;
    case "youtube":
      return `{{youtube:${ref.id}|${clean(opts.creator)}|${clean(opts.originalUrl) || `https://www.youtube.com/watch?v=${ref.id}`}}}`;
    case "instagram":
      return `{{instagram:${ref.url}|${clean(opts.creator)}|${clean(opts.originalUrl) || ref.url}}}`;
  }
}
