"use client";

// 뉴스 우측 이미지 배너 2칸 — PC 세로형 / 모바일 가로형 이미지, 링크, 광고 표기 (lib/news-banners.ts)
import type { NewsBanner } from "@/lib/news-banners";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "../../_components/fields";
import { UploadField } from "../../_components/upload-field";
import { useKeptForm } from "../../_components/use-kept-form";
import { saveNewsBannersAction, type ActionState } from "../../news-actions";

export function NewsBannersForm({ banners }: { banners: NewsBanner[] }) {
  const { state, pending, onSubmit } = useKeptForm<ActionState>(saveNewsBannersAction, {});
  return (
    <details className="mt-6 rounded-xl border border-line bg-surface p-4" open={banners.some((b) => b.active)}>
      <summary className="cursor-pointer text-sm font-bold text-ink">
        우측 이미지 배너 <span className="ml-1 font-normal text-ink-faint">— /news 목록 오른쪽(PC) · 목록 아래(모바일), 2칸</span>
      </summary>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {banners.map((b, i) => (
            <fieldset key={i} className="space-y-3 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-semibold text-ink">배너 {i + 1}</legend>
              <CheckboxField name={`banner${i}.active`} label="노출" defaultChecked={b.active} />
              <UploadField name={`banner${i}.pcImageKey`} label="PC 이미지 (세로형)" defaultKey={b.pcImageKey} hint="권장 600×1200 (1:2). 칸에 맞춰 잘립니다." />
              <UploadField name={`banner${i}.mobileImageKey`} label="모바일 이미지 (가로형)" defaultKey={b.mobileImageKey} hint="권장 1200×400 (3:1). 비우면 PC 이미지를 씁니다." />
              <TextField name={`banner${i}.href`} label="링크 (선택)" defaultValue={b.href ?? ""} hint="/news/cctv-sign 처럼 사이트 주소, 또는 https://… 외부 주소" />
              <TextField name={`banner${i}.alt`} label="이미지 설명 (대체 텍스트)" defaultValue={b.alt} hint="화면 낭독기·이미지가 안 뜰 때 보이는 글. 배너 문구를 그대로 적으세요." />
              <CheckboxField name={`banner${i}.sponsored`} label="광고·협찬 배너" defaultChecked={b.sponsored} hint="업체가 비용을 낸 배너면 켭니다. 배너에 “광고” 표기가 붙습니다(표시광고법)." />
            </fieldset>
          ))}
        </div>
        <FormMessage error={state.error} saved={state.saved} />
        <SubmitButton pending={pending} label="배너 저장" />
      </form>
    </details>
  );
}
