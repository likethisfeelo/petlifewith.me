"use client";

// 브라우저 영상 도구 — 길이 재기, 구간 자르기(재인코딩 없이 복사), 포스터(첫 화면) 잡기.
// 자르기는 mediabunny(순수 TS, WebCodecs 불필요한 복사 모드)로 브라우저 안에서 끝낸다 — 서버는 파일을 만지지 않는다.
// 키프레임 경계 때문에 잘린 결과가 요청 구간보다 몇 초 길 수 있다 (boundaryPolicy 'expand').

export interface VideoProbe {
  durationSec: number;
  width: number;
  height: number;
}

function withObjectUrl<T>(file: Blob, fn: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file);
  return fn(url).finally(() => URL.revokeObjectURL(url));
}

/** 메타데이터만 읽어 길이·크기를 잰다. 브라우저가 못 여는 코덱이면 실패한다. */
export function probeVideo(file: Blob): Promise<VideoProbe> {
  return withObjectUrl(
    file,
    (url) =>
      new Promise<VideoProbe>((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.onloadedmetadata = () => {
          const durationSec = Number.isFinite(v.duration) ? v.duration : 0;
          resolve({ durationSec, width: v.videoWidth, height: v.videoHeight });
        };
        v.onerror = () => reject(new Error("영상을 열 수 없습니다. mp4(H.264) 또는 webm 파일인지 확인해 주세요."));
        v.src = url;
      }),
  );
}

/** 지정 시점의 프레임을 JPEG 로 잡는다. 실패하면 null (카드는 브라우저 첫 프레임으로 대신한다). */
export function captureVideoPoster(file: Blob, atSec = 0.5, maxWidth = 1280): Promise<Blob | null> {
  return withObjectUrl(
    file,
    (url) =>
      new Promise<Blob | null>((resolve) => {
        const v = document.createElement("video");
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        const fail = () => resolve(null);
        const timer = setTimeout(fail, 15000);
        v.onerror = () => {
          clearTimeout(timer);
          fail();
        };
        v.onloadedmetadata = () => {
          const t = Math.min(Math.max(atSec, 0), Math.max(v.duration - 0.1, 0));
          v.currentTime = t;
        };
        v.onseeked = () => {
          try {
            const scale = Math.min(1, maxWidth / Math.max(v.videoWidth, 1));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) return fail();
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
              (blob) => {
                clearTimeout(timer);
                resolve(blob);
              },
              "image/jpeg",
              0.85,
            );
          } catch {
            clearTimeout(timer);
            fail();
          }
        };
        v.src = url;
      }),
  );
}

/** [startSec, endSec) 구간만 남긴 새 파일. 코덱은 그대로 복사한다 (재인코딩 없음). */
export async function trimVideo(
  file: File,
  startSec: number,
  endSec: number,
  onProgress?: (fraction: number) => void,
): Promise<File> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const isWebm = file.type === "video/webm" || /\.webm$/i.test(file.name);
  const format = isWebm ? new mb.WebMOutputFormat() : new mb.Mp4OutputFormat();
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format, target });
  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: { start: Math.max(0, startSec), end: Math.max(startSec + 0.5, endSec) },
    // 복사 우선 — 키프레임 경계까지 넓혀서라도 요청 구간을 다 담는다
    copy: { mode: "preferred", boundaryPolicy: "expand" },
    showWarnings: false,
  });
  if (!conversion.isValid) {
    const reasons = conversion.discardedTracks.map((t) => t.reason).join(", ");
    throw new Error(`이 영상은 브라우저에서 자를 수 없습니다 (${reasons || "지원하지 않는 형식"}). 다른 도구로 잘라 다시 올려 주세요.`);
  }
  if (onProgress) conversion.onProgress = (p) => onProgress(Math.max(0, Math.min(1, p)));
  await conversion.execute();
  const buffer = target.buffer;
  if (!buffer) throw new Error("자른 결과를 만들지 못했습니다.");
  const base = file.name.replace(/\.[^.]+$/, "") || "video";
  return new File([buffer], `${base}-cut.${format.fileExtension.replace(/^\./, "")}`, { type: format.mimeType });
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
