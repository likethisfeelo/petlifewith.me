"use client";

// 미디어 라이브러리 — 업로드(영상은 길이 상한 안으로 자르기) + 숏코드 복사.
import { useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";
import { formatBytes } from "@/lib/media";
import type { UploadPolicy } from "@/lib/settings";
import { formatSeconds } from "@/lib/video-tools";
import { useMediaUploader } from "@/components/media/use-media-uploader";
import { deleteMediaAction } from "../../media-actions";

export interface MediaRow {
  id: number;
  objectKey: string;
  kind: "image" | "video";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  posterKey: string | null;
  durationSec: number | null;
  uploaderName: string | null;
}

export function MediaManager({ assets, policy }: { assets: MediaRow[]; policy: UploadPolicy }) {
  const uploader = useMediaUploader(policy);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const logs: string[] = [];
    for (const file of Array.from(files)) {
      try {
        await uploader.upload(file);
        logs.push(`업로드 완료: ${file.name}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "알 수 없는 오류";
        logs.push(msg === "취소" ? `취소: ${file.name}` : `실패: ${file.name} — ${msg}`);
      }
    }
    setMessages(logs);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    // 서버 컴포넌트 목록 갱신
    window.location.reload();
  };

  const copyShortcode = async (asset: MediaRow) => {
    const code = asset.kind === "image" ? `{{image:${asset.objectKey}|대체텍스트|캡션(선택)}}` : `{{video:${asset.objectKey}|캡션(선택)}}`;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(asset.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt("복사가 막혀 있습니다. 직접 복사하세요:", code);
    }
  };

  return (
    <div>
      <div className="rounded-xl border border-dashed border-line bg-surface p-5 text-center">
        <label className="inline-block cursor-pointer rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
          {busy ? "업로드 중..." : "파일 선택 (이미지·영상, 여러 개 가능)"}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        <p className="mt-2 text-xs text-ink-faint">
          이미지 최대 {formatBytes(policy.maxImageBytes)} · 영상(mp4/webm) 최대 {formatBytes(policy.maxVideoBytes)}
          {policy.maxVideoSeconds > 0 ? ` · ${formatSeconds(policy.maxVideoSeconds)} 이내 (길면 자르기 창이 뜹니다)` : ""}
        </p>
        {uploader.status && <p className="mt-2 text-xs text-sea">{uploader.status}</p>}
      </div>
      {uploader.dialog}

      {messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {messages.map((m, i) => (
            <li key={i} className={m.startsWith("실패") ? "text-accent-deep" : "text-sage-deep"}>{m}</li>
          ))}
        </ul>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            업로드된 미디어가 없습니다.
          </p>
        )}
        {assets.map((a) => {
          const url = assetUrl(a.objectKey);
          return (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-sand">
                {url && a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={a.originalName ?? a.objectKey} className="h-full w-full object-cover" loading="lazy" />
                ) : url && a.kind === "video" && assetUrl(a.posterKey) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(a.posterKey)} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : url && a.kind === "video" ? (
                  <video src={url} className="h-full w-full object-cover" preload="metadata" muted />
                ) : (
                  <span className="px-3 text-center text-[11px] text-ink-faint">미리보기 불가 — NEXT_PUBLIC_ASSET_BASE_URL 미설정</span>
                )}
              </div>
              <p className="mt-2 truncate text-xs font-medium text-ink" title={a.originalName ?? a.objectKey}>
                {a.originalName ?? a.objectKey}
              </p>
              <p className="text-[11px] text-ink-faint">
                {a.kind === "image" ? "이미지" : "영상"} · {formatBytes(a.sizeBytes)}
                {a.width && a.height ? ` · ${a.width}×${a.height}` : ""}
                {a.durationSec ? ` · ${formatSeconds(a.durationSec)}` : ""}
                {a.kind === "video" ? (a.posterKey ? " · 포스터 있음" : " · 포스터 없음") : ""}
                {a.uploaderName ? ` · 회원 ${a.uploaderName}` : ""}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyShortcode(a)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-sand"
                >
                  {copied === a.id ? "복사됨!" : "본문 숏코드 복사"}
                </button>
                <form
                  action={deleteMediaAction}
                  onSubmit={(e) => {
                    if (!confirm("삭제하면 이 파일을 쓰는 본문·OG 이미지가 깨집니다. 삭제할까요?")) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-xs text-accent-deep hover:underline">삭제</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
