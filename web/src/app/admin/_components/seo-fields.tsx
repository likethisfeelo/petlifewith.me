"use client";

// 페이지별 SEO 설정 — 전 에디터가 공유하는 접이식 섹션.
// 비워두면 제목·요약·대표 이미지에서 자동 생성된다. 오버라이드는 선택.
import { useState } from "react";
import { inputClass } from "./fields";
import { UploadField } from "./upload-field";

export interface SeoDefaults {
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageKey?: string | null;
}

export function SeoFields({ defaults, autoHint }: { defaults: SeoDefaults; autoHint?: string }) {
  const [title, setTitle] = useState(defaults.seoTitle ?? "");
  const [desc, setDesc] = useState(defaults.seoDescription ?? "");
  const hasAny = Boolean(defaults.seoTitle || defaults.seoDescription || defaults.ogImageKey);

  return (
    <details className="rounded-xl border border-line bg-surface p-4" open={hasAny}>
      <summary className="cursor-pointer text-sm font-bold text-ink">
        검색·공유 설정 (SEO / OG) <span className="ml-1 font-normal text-ink-faint">— 선택</span>
      </summary>
      <p className="mt-2 text-xs text-ink-faint">
        {autoHint ?? "비워두면 제목·요약·대표 이미지로 자동 생성됩니다. 검색결과·카카오톡/SNS 공유 미리보기를 따로 다듬고 싶을 때만 채우세요."}
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="seoTitle">
            검색·공유 제목 <span className={`ml-1 text-xs font-normal ${title.length > 60 ? "text-accent-deep" : "text-ink-faint"}`}>{title.length}/60자 권장</span>
          </label>
          <input id="seoTitle" name="seoTitle" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="비우면 페이지 제목 사용" />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink" htmlFor="seoDescription">
            검색·공유 설명 <span className={`ml-1 text-xs font-normal ${desc.length > 155 ? "text-accent-deep" : "text-ink-faint"}`}>{desc.length}/155자 권장</span>
          </label>
          <textarea id="seoDescription" name="seoDescription" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} placeholder="비우면 요약 사용" />
        </div>

        <UploadField
          name="ogImageKey"
          label="공유(OG) 이미지"
          defaultKey={defaults.ogImageKey}
          hint="1200×630 권장. 비우면 대표 이미지 → 사이트 기본 이미지 순으로 폴백합니다. 직접 촬영·제작한 이미지만 올리세요."
        />
      </div>
    </details>
  );
}
