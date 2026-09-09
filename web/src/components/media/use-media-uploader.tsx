"use client";

// 업로드 훅 — 파일을 받아 (영상이면) 자르기 대화상자를 거친 뒤 올린다. 관리자 편집기·회원 글쓰기·미디어 라이브러리가 같이 쓴다.
//  - 영상 길이 상한(설정 member_media.maxVideoSeconds, 기본 3분)을 넘으면 반드시 잘라야 올릴 수 있다.
//  - 상한 안이라도 구간을 골라 자를 수 있다. 자르기는 브라우저 안에서 코덱 복사로 끝난다 (lib/video-tools.ts).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatBytes, mediaKindOf } from "@/lib/media";
import { uploadMediaFile, type UploadedMedia } from "@/lib/media-upload";
import type { UploadPolicy } from "@/lib/settings";
import { formatSeconds, probeVideo, trimVideo, type VideoProbe } from "@/lib/video-tools";

interface PendingVideo {
  file: File;
  probe: VideoProbe;
  resolve: (file: File) => void;
  reject: (err: Error) => void;
}

export interface MediaUploader {
  /** 파일 하나를 올린다 (영상은 자르기 대화상자를 거친다). 취소하면 Error("취소") */
  upload: (file: File) => Promise<UploadedMedia>;
  /** 진행 안내 한 줄 (null 이면 대기 중) */
  status: string | null;
  /** 자르기 대화상자 — 폼 어딘가에 한 번 렌더한다 */
  dialog: ReactNode;
}

export function useMediaUploader(policy: UploadPolicy): MediaUploader {
  const [pending, setPending] = useState<PendingVideo | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<UploadedMedia> => {
      const kind = mediaKindOf(file.type);
      if (!kind) throw new Error(`지원하지 않는 형식입니다: ${file.type || file.name}`);
      if (kind === "image") {
        if (file.size > policy.maxImageBytes) throw new Error(`이미지가 너무 큽니다 (${formatBytes(file.size)}). 최대 ${formatBytes(policy.maxImageBytes)}.`);
        setStatus(`${file.name} 올리는 중…`);
        try {
          return await uploadMediaFile(file);
        } finally {
          setStatus(null);
        }
      }
      setStatus("영상 길이 확인 중…");
      let probe: VideoProbe;
      try {
        probe = await probeVideo(file);
      } finally {
        setStatus(null);
      }
      const decided = await new Promise<File>((resolve, reject) => setPending({ file, probe, resolve, reject }));
      if (decided.size > policy.maxVideoBytes) {
        throw new Error(`영상이 너무 큽니다 (${formatBytes(decided.size)}). 최대 ${formatBytes(policy.maxVideoBytes)} — 구간을 더 짧게 잘라 주세요.`);
      }
      try {
        return await uploadMediaFile(decided, {
          onStage: (stage) => setStatus(stage === "poster" ? "첫 화면 잡는 중…" : stage === "upload" ? `${decided.name} 올리는 중…` : "등록 중…"),
        });
      } finally {
        setStatus(null);
      }
    },
    [policy],
  );

  const dialog = pending ? (
    <VideoTrimDialog
      file={pending.file}
      probe={pending.probe}
      maxSeconds={policy.maxVideoSeconds}
      onDone={(f) => {
        pending.resolve(f);
        setPending(null);
      }}
      onCancel={() => {
        pending.reject(new Error("취소"));
        setPending(null);
      }}
    />
  ) : null;

  return useMemo(() => ({ upload, status, dialog }), [upload, status, dialog]);
}

function VideoTrimDialog({
  file,
  probe,
  maxSeconds,
  onDone,
  onCancel,
}: {
  file: File;
  probe: VideoProbe;
  maxSeconds: number;
  onDone: (file: File) => void;
  onCancel: () => void;
}) {
  const duration = Math.max(probe.durationSec, 0.5);
  const limit = maxSeconds > 0 ? maxSeconds : Infinity;
  const mustTrim = duration > limit + 0.5;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(duration, limit));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const length = Math.max(0, end - start);
  const tooLong = length > limit + 0.01;
  const untouched = start <= 0.01 && end >= duration - 0.01;

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v && Number.isFinite(t)) v.currentTime = Math.min(Math.max(t, 0), duration);
  };
  const changeStart = (t: number) => {
    const s = Math.min(Math.max(0, t), duration - 0.5);
    setStart(s);
    // 시작을 옮기면 끝도 상한 안으로 따라온다
    setEnd((e) => Math.min(duration, Math.max(s + 0.5, Math.min(e, s + limit))));
    seekTo(s);
  };
  const changeEnd = (t: number) => {
    const e = Math.min(Math.max(start + 0.5, t), duration);
    setEnd(e);
    seekTo(e);
  };

  const submit = async () => {
    setError(null);
    if (tooLong) return;
    if (untouched && !mustTrim) return onDone(file);
    setBusy("자르는 중… 0%");
    try {
      const cut = await trimVideo(file, start, end, (p) => setBusy(`자르는 중… ${Math.round(p * 100)}%`));
      onDone(cut);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자르기에 실패했습니다.");
      setBusy(null);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="영상 구간 자르기" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-5 shadow-xl">
        <h2 className="text-base font-bold text-ink">영상 구간 자르기</h2>
        <p className="mt-1 text-xs text-ink-soft">
          {file.name} · {formatSeconds(duration)} · {formatBytes(file.size)}
          {maxSeconds > 0 && (
            <>
              {" "}· 올릴 수 있는 길이 <strong className="text-ink">{formatSeconds(maxSeconds)}</strong> 이내
            </>
          )}
        </p>
        {mustTrim && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-deep">영상이 {formatSeconds(maxSeconds)}보다 깁니다. 구간을 골라 잘라야 올릴 수 있습니다.</p>}
        <video ref={videoRef} src={url} controls muted playsInline preload="metadata" className="mt-3 max-h-64 w-full rounded-lg bg-ink" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-soft">
            시작 <span className="font-semibold text-ink">{formatSeconds(start)}</span>
            <input type="range" min={0} max={Math.max(0, duration - 0.5)} step={0.5} value={start} onChange={(e) => changeStart(Number(e.target.value))} className="mt-1 w-full" aria-label="시작 시점" />
          </label>
          <label className="text-xs text-ink-soft">
            끝 <span className="font-semibold text-ink">{formatSeconds(end)}</span>
            <input type="range" min={0.5} max={duration} step={0.5} value={end} onChange={(e) => changeEnd(Number(e.target.value))} className="mt-1 w-full" aria-label="끝 시점" />
          </label>
        </div>
        <p className={`mt-2 text-xs ${tooLong ? "text-accent-deep" : "text-ink-faint"}`}>
          선택 구간 {formatSeconds(length)}
          {tooLong ? ` — ${formatSeconds(maxSeconds)} 이내로 줄여 주세요` : ""}
          {!tooLong && !untouched ? " · 이 구간만 남기고 잘라 올립니다 (재인코딩 없이 복사 — 키프레임 때문에 몇 초 길어질 수 있음)" : ""}
        </p>
        {error && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent-deep">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={!!busy} className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft hover:bg-sand disabled:opacity-50">
            취소
          </button>
          <button type="button" onClick={submit} disabled={!!busy || tooLong} className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream hover:opacity-90 disabled:opacity-50">
            {busy ?? (untouched && !mustTrim ? "이대로 올리기" : "잘라서 올리기")}
          </button>
        </div>
      </div>
    </div>
  );
}
