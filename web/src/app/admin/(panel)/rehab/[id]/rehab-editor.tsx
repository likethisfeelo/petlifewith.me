"use client";

import { useActionState } from "react";
import { REHAB_MODALITIES } from "@app/data";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { createRehabSiteAction, deleteRehabSiteAction, saveRehabSiteAction, type ActionState } from "../../../directory-actions";

export interface RehabFormValues {
  id?: number;
  externalRef: string | null;
  name: string;
  regionId: number | null;
  address: string | null;
  phone: string | null;
  status: string;
  modalities: string[];
  sourceLabel: string | null;
  evidenceNote: string | null;
  internalLevel: string | null;
  internalNote: string | null;
  verifiedAt: string | null;
  published: boolean;
}

const STATUS_OPTIONS = [
  { value: "operating", label: "영업 중" },
  { value: "unknown", label: "확인 필요" },
  { value: "suspended", label: "휴업" },
  { value: "closed", label: "폐업 (공개 목록에서 제외)" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "미기록" },
  { value: "A", label: "A — 공식 지도·대학 등 1차 출처로 확인" },
  { value: "B", label: "B — 병원·체인 웹 안내로 확인" },
  { value: "C", label: "C — 상호 표기만 (확인 전)" },
];

export function RehabEditor({ mode, site, regions }: { mode: "create" | "edit"; site: RehabFormValues; regions: Array<{ id: number; label: string }> }) {
  const action = mode === "create" ? createRehabSiteAction : saveRehabSiteAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {site.id !== undefined && <input type="hidden" name="id" value={site.id} />}

      {/* 주어는 치료법 — 병원을 평가하지 않는다 (claude.md 6-2) */}
      <p className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-xs leading-relaxed text-sage-deep">
        <strong>서술 규칙</strong> — 이 목록은 &quot;치료법을 어디서 받을 수 있는가&quot;의 사실 목록입니다. 공개
        근거에는 시행·보유·등재 사실만 적고, 평가·추천·순위·비용 비교를 쓰지 않습니다. 확인 수준과 내부 메모는
        관리 화면 전용입니다. 담당 수의사 개인명은 어디에도 적지 않습니다.
      </p>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="병원명" defaultValue={site.name} required />
          <SelectField
            name="regionId"
            label="지역 (시군구)"
            required
            defaultValue={site.regionId ?? ""}
            placeholder="선택"
            options={regions.map((r) => ({ value: r.id, label: r.label }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="address" label="소재지 (동 단위까지만)" defaultValue={site.address} placeholder="서울특별시 강동구 길동" hint="상세 주소(번지·건물·호수)는 넣지 않습니다." />
          <TextField name="phone" label="전화" defaultValue={site.phone} placeholder="02-000-0000" />
          <SelectField name="status" label="영업 상태" defaultValue={site.status} options={STATUS_OPTIONS} />
        </div>
        {mode === "create" && (
          <TextField name="externalRef" label="외부키 (선택)" defaultValue={site.externalRef} placeholder="rehab:0124" hint="CSV 재적재와 맞물리는 키. 비우면 관리자 단독 등록으로 남습니다." />
        )}
        {mode === "edit" && site.externalRef && (
          <p className="text-xs text-ink-faint">외부키 {site.externalRef} — CSV 재적재 시 이 키로 갱신됩니다 (&quot;#&quot; 셀은 여기서 채운 값 유지).</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-medium text-ink">
          치료법 <span className="text-accent">*</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {REHAB_MODALITIES.map((m) => (
            <CheckboxField key={m.slug} name={`modality:${m.slug}`} label={m.name} defaultChecked={site.modalities.includes(m.slug)} hint={m.basis} />
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextField
          name="sourceLabel"
          label="근거 출처 (공개)"
          defaultValue={site.sourceLabel}
          placeholder="CVA 공식 지도 · 병원 공식 안내(웹)"
          hint="게시하려면 필수. 어디에서 확인했는지를 짧게."
        />
        <TextAreaField
          name="evidenceNote"
          label="근거 (공개 — 사실만)"
          defaultValue={site.evidenceNote}
          rows={2}
          placeholder="예: CVA 공식 지도 등재 / 수중런닝머신 보유 (병원 안내)"
          hint="시행·보유·등재 사실만. '추천·최고·잘하는' 같은 평가 표현은 저장이 거부됩니다."
        />
        <TextField name="verifiedAt" label="확인 기준일" type="date" defaultValue={site.verifiedAt} hint="공개 페이지에 기준일로 표기됩니다." />
      </section>

      <section className="space-y-4 rounded-xl border border-dashed border-line bg-sand/50 p-4">
        <p className="text-xs font-semibold text-ink-soft">관리 전용 — 공개 페이지에 렌더되지 않습니다</p>
        <SelectField name="internalLevel" label="확인 수준" defaultValue={site.internalLevel ?? ""} options={LEVEL_OPTIONS} />
        <TextAreaField name="internalNote" label="내부 메모" defaultValue={site.internalNote} rows={3} placeholder="원천 문구, 확인 전화 기록 등" />
      </section>

      <CheckboxField name="published" label="공개 페이지에 게시" defaultChecked={site.published} hint="폐업 상태는 게시를 켜도 목록에서 빠집니다." />

      <FormMessage error={state.error} saved={state.saved} />
      <div className="flex items-center gap-4">
        <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
        {mode === "edit" && site.id !== undefined && (
          <button
            type="submit"
            formAction={deleteRehabSiteAction}
            formNoValidate
            className="text-xs text-ink-faint hover:text-accent-deep"
          >
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
