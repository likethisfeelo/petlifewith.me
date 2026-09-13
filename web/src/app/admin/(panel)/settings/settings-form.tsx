"use client";

// 회원 미디어·승인 설정 폼 — 0 은 "제한 없음". 용량은 MB, 길이는 분 단위로 보여 준다.

import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/media";
import { useKeptForm } from "../../_components/use-kept-form";
import type { MemberMediaSettings } from "@/lib/settings";
import { saveMemberMediaSettingsAction } from "../../settings-actions";
import type { ActionState } from "../../actions";
import { CheckboxField, FormMessage, SubmitButton, TextField } from "../../_components/fields";

const mb = (bytes: number) => (bytes > 0 ? String(Math.round((bytes / (1024 * 1024)) * 10) / 10) : "0");

export function SettingsForm({ current }: { current: MemberMediaSettings }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<ActionState>(saveMemberMediaSettingsAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">회원 글 미디어 한도 <span className="font-normal text-ink-faint">— 0 은 제한 없음 (처음 값)</span></h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="maxImagesPerPost" label="글당 사진 수" type="number" defaultValue={String(current.maxImagesPerPost)} hint="0 = 제한 없음" />
          <TextField name="maxVideosPerPost" label="글당 영상 수" type="number" defaultValue={String(current.maxVideosPerPost)} hint="0 = 제한 없음" />
          <TextField name="maxImageMb" label="사진 한 장 최대 (MB)" type="number" defaultValue={mb(current.maxImageBytes)} hint={`0 = 시스템 상한 ${mb(MAX_IMAGE_BYTES)}MB`} />
          <TextField name="maxVideoMb" label="영상 한 편 최대 (MB)" type="number" defaultValue={mb(current.maxVideoBytes)} hint={`0 = 시스템 상한 ${mb(MAX_VIDEO_BYTES)}MB`} />
          <TextField
            name="maxVideoSeconds"
            label="영상 최대 길이 (초)"
            type="number"
            defaultValue={String(current.maxVideoSeconds)}
            hint="180 = 3분. 업로드 전에 브라우저에서 이 길이 안으로 자릅니다. 관리자 업로드에도 적용. 0 = 제한 없음"
          />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">회원 글 공개</h2>
        <div className="mt-3">
          <CheckboxField name="requireApproval" label="승인 대기 — 관리자가 승인해야 공개된다" defaultChecked={current.requireApproval} />
        </div>
        <p className="mt-2 text-xs text-ink-faint">끄면 회원 글이 저장 즉시 공개됩니다. 기준에 어긋난 글은 게시글 관리에서 보관으로 내리면 됩니다.</p>
      </section>

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} />
    </form>
  );
}
