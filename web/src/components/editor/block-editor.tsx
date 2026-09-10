"use client";

// 블록 편집기 — 본문을 블록(본문·제목·소제목·사진·영상·유튜브·인스타그램)으로 보여 주고 마크다운으로 저장한다.
//  - 사진·영상은 버튼이나 끌어다 놓기(드래그 앤 드롭)로 올리고, 올라간 것은 숏코드가 아니라 섬네일로 보인다.
//  - 영상은 길이 상한 안으로 자르는 대화상자를 거친다 (components/media/use-media-uploader.tsx).
//  - 유튜브·인스타그램은 주소 + 창작자명을 받아 카드로 넣는다 (게시물·릴스만, 스토리 불가).
//  - "마크다운" 버튼으로 원문을 직접 고칠 수 있다 (같은 값을 오간다 — lib/blocks.ts).
// 값은 hidden input(name, 기본 bodyMd)으로 폼에 실린다. 관리자 편집기·회원 글쓰기 공용.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assetUrl } from "@/lib/assets";
import { ensureBlocks, mediaBlock, parseBlocks, serializeBlocks, textBlock, type Block, type MediaBlock, type TextBlock } from "@/lib/blocks";
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, formatBytes, mediaKindOf } from "@/lib/media";
import { instagramPermalink, youtubeIdFromUrl, youtubeThumbUrl } from "@/lib/media-ref";
import type { UploadPolicy } from "@/lib/settings";
import { formatSeconds } from "@/lib/video-tools";
import { useMediaUploader } from "@/components/media/use-media-uploader";

type LinkKind = "youtube" | "instagram";
type BlockPatch = { kind?: Block["kind"]; text?: string; label?: string; extra?: string };
type BlockRow_Update = (id: string, patch: BlockPatch) => void;
type InsertKind = "p" | "h2" | "h3" | "image" | "video" | LinkKind;

const KIND_LABEL: Record<TextBlock["kind"], string> = { p: "본문", h2: "제목", h3: "소제목" };

export function BlockEditor({
  name = "bodyMd",
  defaultValue,
  policy,
  onChange,
  disabled = false,
}: {
  name?: string;
  defaultValue: string;
  policy: UploadPolicy;
  /** 마크다운이 바뀔 때 (대표 영상 목록·글자 수 표시용) */
  onChange?: (md: string) => void;
  disabled?: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(() => ensureBlocks(parseBlocks(defaultValue)));
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ kind: LinkKind; at: number; url: string; creator: string; error: string | null } | null>(null);
  const [pendingAt, setPendingAt] = useState<number | null>(null);
  const uploader = useMediaUploader(policy);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const md = useMemo(() => (raw ? rawText : serializeBlocks(blocks)), [raw, rawText, blocks]);
  useEffect(() => {
    onChange?.(md);
  }, [md, onChange]);

  const update = useCallback((id: string, patch: BlockPatch) => {
    setBlocks((cur) => cur.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }, []);
  const remove = (id: string) => setBlocks((cur) => ensureBlocks(cur.filter((b) => b.id !== id)));
  const move = (id: string, dir: -1 | 1) =>
    setBlocks((cur) => {
      const i = cur.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const insertBlocks = (at: number, items: Block[]) => {
    setBlocks((cur) => {
      const next = [...cur];
      // 빈 본문 블록 하나뿐이면 그 자리에 넣는다
      if (next.length === 1 && next[0]!.kind === "p" && !next[0]!.text.trim() && items.some((b) => b.kind !== "p")) return items;
      next.splice(Math.min(Math.max(at, 0), next.length), 0, ...items);
      return next;
    });
    const first = items[0];
    if (first && (first.kind === "p" || first.kind === "h2" || first.kind === "h3")) setFocusId(first.id);
  };

  const uploadFiles = async (files: File[], at: number) => {
    setError(null);
    let index = at;
    for (const file of files) {
      const kind = mediaKindOf(file.type);
      if (!kind) {
        setError(`${file.name}: 지원하지 않는 형식입니다 (jpg/png/webp/gif/avif, mp4/webm).`);
        continue;
      }
      try {
        const up = await uploader.upload(file);
        const base = file.name.replace(/\.[^.]+$/, "");
        const block = up.kind === "image" ? mediaBlock({ kind: "image", key: up.objectKey }, base) : mediaBlock({ kind: "video", key: up.objectKey });
        insertBlocks(index, [block]);
        index += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "업로드 실패";
        if (msg !== "취소") setError(msg);
      }
    }
  };

  const onInsert = (kind: InsertKind, at: number) => {
    if (kind === "p" || kind === "h2" || kind === "h3") return insertBlocks(at, [textBlock(kind)]);
    if (kind === "image" || kind === "video") {
      setPendingAt(at);
      (kind === "image" ? imageRef : videoRef).current?.click();
      return;
    }
    setLink({ kind, at, url: "", creator: "", error: null });
  };

  const submitLink = () => {
    if (!link) return;
    const creator = link.creator.trim();
    if (!creator) return setLink({ ...link, error: "창작자(채널·계정) 이름을 적어 주세요. 출처 표기 없이는 게시할 수 없습니다." });
    if (link.kind === "youtube") {
      const id = youtubeIdFromUrl(link.url);
      if (!id) return setLink({ ...link, error: "유튜브 영상 주소가 아닙니다. watch?v=… 또는 youtu.be/… 주소를 넣어 주세요." });
      insertBlocks(link.at, [mediaBlock({ kind: "youtube", id }, creator, link.url.trim())]);
    } else {
      const url = instagramPermalink(link.url);
      if (!url) return setLink({ ...link, error: "인스타그램 게시물(/p/) 또는 릴스(/reel/) 주소만 넣을 수 있습니다. 스토리는 안 됩니다." });
      insertBlocks(link.at, [mediaBlock({ kind: "instagram", url }, creator, url)]);
    }
    setLink(null);
  };

  const toggleRaw = () => {
    if (raw) {
      setBlocks(ensureBlocks(parseBlocks(rawText)));
      setRaw(false);
    } else {
      setRawText(serializeBlocks(blocks));
      setRaw(true);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void uploadFiles(files, blocks.length);
  };

  return (
    <div
      className={`relative rounded-xl border ${dragging ? "border-sea bg-sea-soft/40" : "border-line bg-cream/40"} p-3`}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <input type="hidden" name={name} value={md} />
      <input ref={imageRef} type="file" accept={IMAGE_MIME_TYPES.join(",")} multiple className="hidden" disabled={disabled} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadFiles(files, pendingAt ?? blocks.length); }} />
      <input ref={videoRef} type="file" accept={VIDEO_MIME_TYPES.join(",")} className="hidden" disabled={disabled} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadFiles(files, pendingAt ?? blocks.length); }} />

      {/* 상단 툴바 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton onClick={() => onInsert("image", blocks.length)} disabled={disabled}>📷 사진</ToolButton>
        <ToolButton onClick={() => onInsert("video", blocks.length)} disabled={disabled}>🎬 영상</ToolButton>
        <ToolButton onClick={() => onInsert("youtube", blocks.length)} disabled={disabled}>▶ 유튜브</ToolButton>
        <ToolButton onClick={() => onInsert("instagram", blocks.length)} disabled={disabled}>◎ 인스타그램</ToolButton>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />
        <ToolButton onClick={() => onInsert("h2", blocks.length)} disabled={disabled || raw}>제목</ToolButton>
        <ToolButton onClick={() => onInsert("h3", blocks.length)} disabled={disabled || raw}>소제목</ToolButton>
        <ToolButton onClick={() => onInsert("p", blocks.length)} disabled={disabled || raw}>본문</ToolButton>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-ink-faint">
          <span className="hidden sm:inline">
            사진 {formatBytes(policy.maxImageBytes)} · 영상 {formatBytes(policy.maxVideoBytes)}
            {policy.maxVideoSeconds > 0 ? ` · ${formatSeconds(policy.maxVideoSeconds)} 이내` : ""}
          </span>
          <button type="button" onClick={toggleRaw} disabled={disabled} className={`rounded-full border px-2.5 py-1 font-medium ${raw ? "border-ink bg-ink text-cream" : "border-line bg-surface text-ink-soft hover:bg-sand"}`}>
            {raw ? "블록으로 보기" : "마크다운"}
          </button>
        </span>
      </div>
      {(uploader.status || error) && <p className={`mt-2 text-xs ${error ? "text-accent-deep" : "text-sea"}`}>{error ?? uploader.status}</p>}

      {link && (
        <div className="mt-3 grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input type="url" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value, error: null })} placeholder={link.kind === "youtube" ? "https://www.youtube.com/watch?v=…" : "https://www.instagram.com/reel/…"} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink" aria-label={link.kind === "youtube" ? "유튜브 주소" : "인스타그램 주소"} />
          <input type="text" value={link.creator} onChange={(e) => setLink({ ...link, creator: e.target.value, error: null })} placeholder={link.kind === "youtube" ? "채널(창작자) 이름" : "계정(창작자) 이름"} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink" aria-label="창작자 이름" />
          <button type="button" onClick={submitLink} className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">넣기</button>
          <button type="button" onClick={() => setLink(null)} className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft hover:bg-sand">닫기</button>
          <p className={`text-[11px] sm:col-span-4 ${link.error ? "text-accent-deep" : "text-ink-faint"}`}>
            {link.error ?? (link.kind === "youtube" ? "공식 플레이어로 임베드됩니다. 원본 링크와 채널명이 함께 표시됩니다." : "게시물·릴스만 임베드됩니다 (스토리 불가). 계정명과 원본 링크가 함께 표시됩니다.")}
          </p>
        </div>
      )}

      {raw ? (
        <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={Math.max(16, rawText.split("\n").length + 2)} disabled={disabled} aria-label="마크다운 원문" className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-ink" />
      ) : (
        <ol className="mt-3 space-y-2" aria-label="본문 블록">
          {blocks.map((b, i) => (
            <li key={b.id}>
              <BlockRow block={b} index={i} count={blocks.length} disabled={disabled} focus={focusId === b.id} onFocused={() => setFocusId(null)} onUpdate={update} onRemove={remove} onMove={move} />
              <InsertRow onInsert={(kind) => onInsert(kind, i + 1)} disabled={disabled} />
            </li>
          ))}
        </ol>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-sea bg-sea-soft/70 text-sm font-semibold text-sea">
          여기에 놓으면 사진·영상이 올라갑니다
        </div>
      )}
      {!raw && <p className="mt-2 text-[11px] text-ink-faint">사진·영상 파일을 이 영역에 끌어다 놓아도 됩니다. 본문 블록 안에서는 **굵게**, [링크](주소), - 목록 같은 마크다운을 쓸 수 있습니다.</p>}
      {uploader.dialog}
    </div>
  );
}

function ToolButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand disabled:opacity-50">
      {children}
    </button>
  );
}

function InsertRow({ onInsert, disabled }: { onInsert: (kind: InsertKind) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const pick = (kind: InsertKind) => {
    setOpen(false);
    onInsert(kind);
  };
  return (
    <div className="group relative flex h-4 items-center justify-center">
      {open ? (
        <div className="absolute z-10 flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 shadow-md">
          {(["p", "h2", "h3", "image", "video", "youtube", "instagram"] as InsertKind[]).map((k) => (
            <button key={k} type="button" onClick={() => pick(k)} className="rounded-full px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:bg-sand hover:text-ink">
              {{ p: "본문", h2: "제목", h3: "소제목", image: "사진", video: "영상", youtube: "유튜브", instagram: "인스타그램" }[k]}
            </button>
          ))}
          <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="px-1 text-[11px] text-ink-faint hover:text-ink">×</button>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} aria-label="여기에 블록 추가" className="h-4 w-full text-[11px] text-transparent transition-colors hover:text-ink-faint focus:text-ink-faint">
          ＋ 여기에 추가
        </button>
      )}
    </div>
  );
}

function BlockRow({
  block,
  index,
  count,
  disabled,
  focus,
  onFocused,
  onUpdate,
  onRemove,
  onMove,
}: {
  block: Block;
  index: number;
  count: number;
  disabled: boolean;
  focus: boolean;
  onFocused: () => void;
  onUpdate: BlockRow_Update;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const controls = (
    <div className="flex items-center gap-0.5 text-[11px] text-ink-faint">
      <button type="button" disabled={disabled || index === 0} onClick={() => onMove(block.id, -1)} aria-label="위로" className="rounded px-1.5 py-0.5 hover:bg-sand hover:text-ink disabled:opacity-30">↑</button>
      <button type="button" disabled={disabled || index === count - 1} onClick={() => onMove(block.id, 1)} aria-label="아래로" className="rounded px-1.5 py-0.5 hover:bg-sand hover:text-ink disabled:opacity-30">↓</button>
      <button type="button" disabled={disabled} onClick={() => onRemove(block.id)} aria-label="블록 삭제" className="rounded px-1.5 py-0.5 hover:bg-accent-soft hover:text-accent-deep">삭제</button>
    </div>
  );

  if (block.kind === "p" || block.kind === "h2" || block.kind === "h3") {
    return <TextBlockRow block={block} disabled={disabled} focus={focus} onFocused={onFocused} onUpdate={onUpdate} controls={controls} />;
  }
  return <MediaBlockRow block={block as MediaBlock} disabled={disabled} onUpdate={onUpdate} controls={controls} />;
}

function TextBlockRow({ block, disabled, focus, onFocused, onUpdate, controls }: { block: TextBlock; disabled: boolean; focus: boolean; onFocused: () => void; onUpdate: BlockRow_Update; controls: ReactNode }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focus && ref.current) {
      ref.current.focus();
      onFocused();
    }
  }, [focus, onFocused]);
  const wrap = (before: string, after: string, placeholder: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = block.text.slice(s, e) || placeholder;
    const next = block.text.slice(0, s) + before + sel + after + block.text.slice(e);
    onUpdate(block.id, { text: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const rows = block.kind === "p" ? Math.min(20, Math.max(3, block.text.split("\n").length + 1)) : 1;
  const cls =
    block.kind === "h2"
      ? "text-xl font-extrabold tracking-tight text-ink"
      : block.kind === "h3"
        ? "text-lg font-bold text-ink"
        : "text-sm leading-relaxed text-ink";
  return (
    <div className="group/block rounded-lg border border-transparent bg-surface px-3 py-2 focus-within:border-line hover:border-line">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
        {/* 블록 종류 — 넓은 화면은 버튼을 옆으로, 모바일은 드롭다운 */}
        <div role="group" aria-label="블록 종류" className="hidden items-center gap-0.5 rounded-full border border-line bg-cream p-0.5 sm:flex">
          {(Object.keys(KIND_LABEL) as TextBlock["kind"][]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              aria-pressed={k === block.kind}
              onClick={() => onUpdate(block.id, { kind: k })}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${k === block.kind ? "bg-ink text-cream" : "text-ink-soft hover:bg-sand hover:text-ink"}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <select value={block.kind} disabled={disabled} onChange={(e) => onUpdate(block.id, { kind: e.target.value as TextBlock["kind"] })} aria-label="블록 종류 (모바일)" className="rounded border border-line bg-cream px-1.5 py-0.5 text-[11px] text-ink-soft sm:hidden">
          {(Object.keys(KIND_LABEL) as TextBlock["kind"][]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
        {block.kind === "p" && (
          <>
            <button type="button" disabled={disabled} onClick={() => wrap("**", "**", "굵게")} className="rounded px-1.5 py-0.5 font-bold text-ink-soft hover:bg-sand hover:text-ink">B</button>
            <button type="button" disabled={disabled} onClick={() => { const url = window.prompt("링크 주소 (https://…)"); if (url) wrap("[", `](${url.trim()})`, "링크 텍스트"); }} className="rounded px-1.5 py-0.5 text-ink-soft underline hover:bg-sand hover:text-ink">링크</button>
          </>
        )}
        <span className="ml-auto opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100">{controls}</span>
      </div>
      <textarea
        ref={ref}
        value={block.text}
        disabled={disabled}
        rows={rows}
        onChange={(e) => onUpdate(block.id, { text: block.kind === "p" ? e.target.value : e.target.value.replace(/\n/g, " ") })}
        placeholder={block.kind === "p" ? "내용을 쓰세요…" : block.kind === "h2" ? "제목" : "소제목"}
        aria-label={KIND_LABEL[block.kind]}
        className={`w-full resize-y bg-transparent outline-none placeholder:text-ink-faint ${cls}`}
      />
    </div>
  );
}

function MediaBlockRow({ block, disabled, onUpdate, controls }: { block: MediaBlock; disabled: boolean; onUpdate: BlockRow_Update; controls: ReactNode }) {
  const ref = block.ref;
  const src = ref.kind === "image" || ref.kind === "video" ? assetUrl(ref.key) : ref.kind === "youtube" ? youtubeThumbUrl(ref.id) : null;
  const title = { image: "사진", video: "영상", youtube: "유튜브", instagram: "인스타그램" }[block.kind];
  const input = "w-full rounded border border-line bg-cream px-2 py-1 text-xs outline-none focus:border-ink";
  return (
    <div className="group/block rounded-lg border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="rounded-full bg-sand px-2 py-0.5 font-semibold text-ink-soft">{title}</span>
        {ref.kind === "instagram" && <span className="truncate text-ink-faint">{ref.url}</span>}
        <span className="ml-auto opacity-0 group-focus-within/block:opacity-100 group-hover/block:opacity-100">{controls}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-sand">
          {ref.kind === "video" && src ? (
            <video src={src} muted playsInline controls preload="metadata" className="h-full w-full object-cover" />
          ) : src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="px-2 text-center text-[11px] text-ink-faint">{ref.kind === "instagram" ? "인스타그램 게시물·릴스 (본문에서 공식 임베드로 보입니다)" : "미리보기 없음"}</span>
          )}
        </div>
        <div className="space-y-2">
          {block.kind === "image" && (
            <>
              <label className="block text-[11px] text-ink-faint">대체 텍스트 <input value={block.label} disabled={disabled} onChange={(e) => onUpdate(block.id, { label: e.target.value })} placeholder="사진 설명 (보이지 않는 사람을 위해)" className={input} /></label>
              <label className="block text-[11px] text-ink-faint">캡션 (선택) <input value={block.extra} disabled={disabled} onChange={(e) => onUpdate(block.id, { extra: e.target.value })} className={input} /></label>
            </>
          )}
          {block.kind === "video" && (
            <label className="block text-[11px] text-ink-faint">캡션 (선택) <input value={block.label} disabled={disabled} onChange={(e) => onUpdate(block.id, { label: e.target.value })} className={input} /></label>
          )}
          {(block.kind === "youtube" || block.kind === "instagram") && (
            <>
              <label className="block text-[11px] text-ink-faint">창작자 이름 <input value={block.label} disabled={disabled} onChange={(e) => onUpdate(block.id, { label: e.target.value })} className={input} /></label>
              <label className="block text-[11px] text-ink-faint">원본 링크 <input value={block.extra} disabled={disabled} onChange={(e) => onUpdate(block.id, { extra: e.target.value })} className={input} /></label>
            </>
          )}
          <p className="break-all text-[10px] text-ink-faint">{ref.kind === "image" || ref.kind === "video" ? ref.key : ref.kind === "youtube" ? `youtube:${ref.id}` : ref.url}</p>
        </div>
      </div>
    </div>
  );
}
