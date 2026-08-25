"use client";

// 단일 이미지 업로드 필드 — 대표 이미지·OG 이미지용.
// 파일을 고르면 presign→PUT→등록까지 마치고 hidden input 에 오브젝트 키를 채운다.
// 폼 저장과 무관하게 업로드 자체는 즉시 일어난다 (자산은 미디어 라이브러리에도 보인다).
import { useRef, useState } from "react";
import { assetUrl } from "@/lib/assets";
import { uploadMediaFile } from "@/lib/media-upload";

export function UploadField({
  name,
  label,
  defaultKey,
  hint,
}: {
  name: string;
  label: string;
  defaultKey?: string | null;
  hint?: string;
}) {
  const [objectKey, setObjectKey] = useState(defaultKey ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewUrl = assetUrl(objectKey || null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await uploadMediaFile(file);
      if (uploaded.kind !== "image") {
        setError("이 필드에는 이미지만 넣을 수 있습니다.");
      } else {
        setObjectKey(uploaded.objectKey);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="block text-sm font-medium text-ink">{label}</span>
      <input type="hidden" name={name} value={objectKey} />

      <div className="mt-1 flex items-start gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-20 w-32 rounded-lg border border-line bg-sand object-cover" />
        ) : objectKey ? (
          <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-line px-2 text-center text-[10px] text-ink-faint">
            미리보기 불가 — NEXT_PUBLIC_ASSET_BASE_URL 미설정
          </div>
        ) : (
          <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-line text-xs text-ink-faint">
            없음
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="inline-block cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand">
            {uploading ? "업로드 중..." : objectKey ? "이미지 바꾸기" : "이미지 업로드"}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
          {objectKey && (
            <button type="button" onClick={() => setObjectKey("")} className="text-left text-xs text-accent-deep hover:underline">
              제거
            </button>
          )}
          {objectKey && <p className="max-w-56 break-all text-[10px] text-ink-faint">{objectKey}</p>}
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-accent-deep">{error}</p>}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
