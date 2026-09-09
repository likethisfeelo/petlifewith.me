"use client";

// 대표 영상 고르기 — 본문에 든 영상(업로드·유튜브·인스타그램) 가운데 하나. "자동"은 본문 첫 영상.
// 값은 guides.hero_media 문자열("video:키" 등) 로 저장된다 (lib/media-ref.ts).
import { useEffect, useState } from "react";
import { serializeMediaRef, videoEmbeds } from "@/lib/media-ref";

const KIND_LABEL: Record<string, string> = { video: "업로드 영상", youtube: "유튜브", instagram: "인스타그램" };

export function HeroMediaSelect({ body, defaultValue, name = "heroMedia", className }: { body: string; defaultValue: string | null; name?: string; className?: string }) {
  const options = videoEmbeds(body).map((e, i) => ({
    value: serializeMediaRef(e.ref),
    label: `${i + 1}. ${KIND_LABEL[e.ref.kind] ?? e.ref.kind}${e.label ? ` · ${e.label}` : ""}`,
  }));
  const [value, setValue] = useState(defaultValue ?? "");
  // 본문에서 그 영상이 사라지면 자동으로 돌아간다
  useEffect(() => {
    if (value && !options.some((o) => o.value === value)) setValue("");
  }, [value, options]);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-ink" htmlFor={name}>
        대표 영상 <span className="font-normal text-ink-faint">— 목록 카드에 섬네일·미리보기로 뜨는 영상</span>
      </label>
      <select id={name} name={name} value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink">
        <option value="">{options.length > 0 ? "자동 — 본문의 첫 영상" : "본문에 영상이 없습니다 (사진이 있으면 사진이 섬네일)"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
