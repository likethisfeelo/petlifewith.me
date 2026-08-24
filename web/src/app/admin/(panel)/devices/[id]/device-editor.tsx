"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { createDeviceAction, saveDeviceAction, type ActionState } from "../../../directory-actions";

export interface DeviceFormValues {
  id?: number;
  name: string;
  makerName: string | null;
  category: string;
  summaryMd: string | null;
  specsMd: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "laser", label: "레이저" },
  { value: "stethoscope", label: "청진기" },
  { value: "imaging", label: "영상" },
  { value: "monitor", label: "모니터링" },
  { value: "rehab_equipment", label: "재활 장비" },
  { value: "other", label: "기타" },
];

export function DeviceEditor({
  mode,
  device,
  regions,
  sites,
}: {
  mode: "create" | "edit";
  device: DeviceFormValues;
  regions: Array<{ id: number; label: string }>;
  sites: RowValue[];
}) {
  const action = mode === "create" ? createDeviceAction : saveDeviceAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  const siteFields = [
    { key: "facilityName", label: "보유처 이름", span: "col-span-4", placeholder: "○○ 동물병원" },
    {
      key: "regionId",
      label: "지역",
      type: "select" as const,
      span: "col-span-3",
      options: [{ value: "", label: "선택 안 함" }, ...regions.map((r) => ({ value: String(r.id), label: r.label }))],
    },
    { key: "verifiedAt", label: "확인일", type: "date" as const, span: "col-span-2" },
    { key: "note", label: "메모 (선택)", span: "col-span-3" },
  ];

  return (
    <form action={formAction} className="space-y-5">
      {device.id !== undefined && <input type="hidden" name="id" value={device.id} />}

      {/* 주어를 병원이 아니라 기기로 둔다 (claude.md 6-2) */}
      <p className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-xs leading-relaxed text-sage-deep">
        <strong>서술 규칙</strong> — 주어는 병원이 아니라 기기입니다. 원리와 스펙은 사실대로 쓰되 효과를 단정하지
        않습니다. &quot;관절염에 효과적&quot;은 의료 광고이고, &quot;○○ 목적으로 사용된다&quot;까지가 정보입니다.
        보유처 목록은 무료 노출 전용이며 순위·추천·비교를 만들지 않습니다.
      </p>

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="기기명" defaultValue={device.name} required />
          {mode === "create" && <TextField name="slug" label="슬러그 (선택)" />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="makerName" label="제조사" defaultValue={device.makerName} />
          <SelectField name="category" label="분류" defaultValue={device.category} options={CATEGORY_OPTIONS} />
        </div>
        <TextAreaField
          name="summaryMd"
          label="원리 설명 (마크다운)"
          defaultValue={device.summaryMd}
          rows={6}
          mono
          hint="어떤 원리로 동작하며 어떤 목적으로 쓰이는지."
        />
        <TextAreaField
          name="specsMd"
          label="스펙 (마크다운)"
          defaultValue={device.specsMd}
          rows={5}
          mono
          hint="출력, 조사 시간, 표재성/심부용 구분 등 사실 정보."
        />
      </section>

      <RowsEditor
        name="sitesJson"
        title="보유처 (무료 노출 전용)"
        hint="직접 확인한 곳만 넣습니다. 공공데이터에 없는 정보라 그 자체가 자산입니다. 확인일을 함께 남기세요."
        fields={siteFields}
        initialRows={sites}
        emptyRow={{ facilityName: "", regionId: "", verifiedAt: "", note: "" }}
        addLabel="보유처 추가"
        emptyHint="확인한 보유처가 없습니다."
      />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
