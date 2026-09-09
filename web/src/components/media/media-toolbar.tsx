"use client";

// 본문 편집 툴바 — 사진·영상 업로드, 유튜브·인스타그램 링크를 숏코드로 본문(마크다운)에 끼워 넣는다.
// 관리자 편집기와 회원 글쓰기가 같이 쓴다. 외부 영상은 창작자명과 원본 링크가 있어야 렌더된다 (운영 규칙 3-4).
import { useRef, useState, type RefObject } from "react";
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, formatBytes } from "@/lib/media";
import { instagramPermalink, shortcodeFor, youtubeIdFromUrl } from "@/lib/media-ref";
import type { UploadPolicy } from "@/lib/settings";
import { formatSeconds } from "@/lib/video-tools";
import { useMediaUploader } from "./use-media-uploader";

type LinkKind = "youtube" | "instagram";

/** 커서 위치에 한 줄(앞뒤 빈 줄 포함)로 끼워 넣은 새 본문과 커서 위치 */
export function insertBlock(value: string, selectionStart: number, block: string): { value: string; cursor: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionStart);
  const pre = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const post = after.length === 0 || after.startsWith("\n\n") ? "\n" : after.startsWith("\n") ? "\n" : "\n\n";
  const inserted = `${pre}${block}${post}`;
  return { value: before + inserted + after, cursor: before.length + inserted.length };
}

export function MediaToolbar({
  policy,
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  policy: UploadPolicy;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const uploader = useMediaUploader(policy);
  const [link, setLink] = useState<{ kind: LinkKind; url: string; creator: string; error: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const insert = (block: string) => {
    const ta = textareaRef.current;
    const at = ta ? ta.selectionStart : value.length;
    const next = insertBlock(value, at, block);
    onChange(next.value);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(next.cursor, next.cursor);
      }
    });
  };

  const onFiles = async (files: FileList | null, expect: "image" | "video") => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploader.upload(file);
        if (uploaded.kind !== expect) continue;
        const base = file.name.replace(/\.[^.]+$/, "");
        insert(uploaded.kind === "image" ? shortcodeFor({ kind: "image", key: uploaded.objectKey }, { alt: base }) : shortcodeFor({ kind: "video", key: uploaded.objectKey }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "업로드 실패";
      if (msg !== "취소") setError(msg);
    } finally {
      setBusy(false);
      if (imageRef.current) imageRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const submitLink = () => {
    if (!link) return;
    const creator = link.creator.trim();
    if (!creator) return setLink({ ...link, error: "창작자(채널·계정) 이름을 적어 주세요. 출처 표기 없이는 게시할 수 없습니다." });
    if (link.kind === "youtube") {
      const id = youtubeIdFromUrl(link.url);
      if (!id) return setLink({ ...link, error: "유튜브 영상 주소가 아닙니다. watch?v=… 또는 youtu.be/… 주소를 넣어 주세요." });
      insert(shortcodeFor({ kind: "youtube", id }, { creator, originalUrl: link.url.trim() }));
    } else {
      const url = instagramPermalink(link.url);
      if (!url) return setLink({ ...link, error: "인스타그램 게시물(/p/) 또는 릴스(/reel/) 주소만 넣을 수 있습니다. 스토리는 안 됩니다." });
      insert(shortcodeFor({ kind: "instagram", url }, { creator, originalUrl: url }));
    }
    setLink(null);
  };

  const btn = "rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand disabled:opacity-50";
  const off = disabled || busy;

  return (
    <div className="rounded-lg border border-line bg-cream/60 p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className={`${btn} cursor-pointer ${off ? "pointer-events-none opacity-50" : ""}`}>
          📷 사진
          <input ref={imageRef} type="file" accept={IMAGE_MIME_TYPES.join(",")} multiple className="hidden" disabled={off} onChange={(e) => onFiles(e.target.files, "image")} />
        </label>
        <label className={`${btn} cursor-pointer ${off ? "pointer-events-none opacity-50" : ""}`}>
          🎬 영상
          <input ref={videoRef} type="file" accept={VIDEO_MIME_TYPES.join(",")} className="hidden" disabled={off} onChange={(e) => onFiles(e.target.files, "video")} />
        </label>
        <button type="button" className={btn} disabled={off} onClick={() => setLink({ kind: "youtube", url: "", creator: "", error: null })}>
          ▶ 유튜브 링크
        </button>
        <button type="button" className={btn} disabled={off} onClick={() => setLink({ kind: "instagram", url: "", creator: "", error: null })}>
          ◎ 인스타그램 링크
        </button>
        <span className="ml-auto text-[11px] text-ink-faint">
          이미지 {formatBytes(policy.maxImageBytes)} · 영상 {formatBytes(policy.maxVideoBytes)}
          {policy.maxVideoSeconds > 0 ? ` · ${formatSeconds(policy.maxVideoSeconds)} 이내(자르기 제공)` : ""}
        </span>
      </div>
      {(uploader.status || busy) && <p className="mt-2 text-xs text-sea">{uploader.status ?? "처리 중…"}</p>}
      {error && <p className="mt-2 text-xs text-accent-deep">{error}</p>}

      {link && (
        <div className="mt-2 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            type="url"
            value={link.url}
            onChange={(e) => setLink({ ...link, url: e.target.value, error: null })}
            placeholder={link.kind === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://www.instagram.com/reel/…"}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
            aria-label={link.kind === "youtube" ? "유튜브 주소" : "인스타그램 주소"}
          />
          <input
            type="text"
            value={link.creator}
            onChange={(e) => setLink({ ...link, creator: e.target.value, error: null })}
            placeholder={link.kind === "youtube" ? "채널(창작자) 이름" : "계정(창작자) 이름"}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
            aria-label="창작자 이름"
          />
          <button type="button" onClick={submitLink} className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            넣기
          </button>
          <button type="button" onClick={() => setLink(null)} className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft hover:bg-sand">
            닫기
          </button>
          {link.error && <p className="text-xs text-accent-deep sm:col-span-4">{link.error}</p>}
          {!link.error && (
            <p className="text-[11px] text-ink-faint sm:col-span-4">
              {link.kind === "youtube" ? "공식 플레이어로 임베드됩니다. 원본 링크와 채널명이 함께 표시됩니다." : "게시물·릴스만 임베드됩니다 (스토리 불가). 계정명과 원본 링크가 함께 표시됩니다."}
            </p>
          )}
        </div>
      )}
      {uploader.dialog}
    </div>
  );
}
