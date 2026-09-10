"use client";

// 내 상담 프로필 — 멘토는 저장 즉시 공개(본인이 끌 수 있음), 훈련사는 자격 확인 뒤 운영자가 공개.
import { useActionState, useState } from "react";
import { saveMyExpertAction, type ExpertSelfState } from "@/app/expert-self-actions";
import { CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/app/admin/_components/fields";
import { RowsEditor, type RowValue } from "@/app/admin/_components/rows-editor";
import { UploadField } from "@/app/admin/_components/upload-field";
import { RegionMultiPicker } from "@/components/requests/region-picker";
import type { RegionOption } from "@/lib/queries/requests";
import { CONSULT_MODES, CONSULT_MODE_LABEL, EXPERT_KINDS, EXPERT_KIND_BLURB, EXPERT_KIND_LABEL, EXPERT_LIMITS, WEEKDAY_LABEL, selfPublishes, type ExpertKind } from "@/lib/reservations";

export interface MyExpertValues {
  kind: ExpertKind;
  displayName: string;
  introMd: string | null;
  credentialsText: string | null;
  topics: string[];
  modes: string[];
  priceText: string | null;
  heroImageKey: string | null;
  contact: string | null;
  status: "draft" | "published";
  regionIds: number[];
}

const SLOT_FIELDS = [
  { key: "weekday", label: "요일", type: "select" as const, span: "col-span-4", options: WEEKDAY_LABEL.map((l, i) => ({ value: String(i), label: l })) },
  { key: "start", label: "시작 (HH:MM)", span: "col-span-4", placeholder: "20:00" },
  { key: "end", label: "끝 (HH:MM)", span: "col-span-4", placeholder: "21:00" },
];

export function MyExpertForm({ initial, regions, slots, isNew }: { initial: MyExpertValues; regions: RegionOption[]; slots: RowValue[]; isNew: boolean }) {
  const [state, formAction, pending] = useActionState<ExpertSelfState, FormData>(saveMyExpertAction, {});
  const [kind, setKind] = useState<ExpertKind>(initial.kind);
  return (
    <form action={formAction} className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div>
          <span className="block text-sm font-medium text-ink">어떤 프로필인가요</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {EXPERT_KINDS.map((k) => (
              <label key={k} className={`flex cursor-pointer gap-2 rounded-xl border p-3 text-sm ${kind === k ? "border-ink bg-sand" : "border-line bg-cream/40"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="mt-0.5" />
                <span>
                  <span className="font-bold text-ink">{EXPERT_KIND_LABEL[k]}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">{EXPERT_KIND_BLURB[k]}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-faint">{selfPublishes(k) ? "저장하면 바로 공개 (언제든 비공개로)" : "자격·경력 확인 뒤 운영자가 공개"}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="displayName" label="활동명 (페이지에 표시)" defaultValue={initial.displayName} required placeholder="예: 몽이 언니 · 행동교정 김훈련" />
          <TextField name="credentialsText" label={kind === "trainer" ? "자격·경력 (필수, 사실만)" : "경험 한 줄 (선택)"} defaultValue={initial.credentialsText} placeholder={kind === "trainer" ? "반려동물행동지도사 2급 · 경력 8년" : "16살 노견을 3년 돌봤어요"} required={kind === "trainer"} />
        </div>
        <TextAreaField name="introMd" label="소개" defaultValue={initial.introMd} rows={6} hint="어떤 고민을 함께 볼 수 있는지 (20자 이상). 진단·처방·치료 표현, 전화번호·주소는 넣지 않습니다." />
        <TextField name="topics" label="상담 주제 (쉼표로)" defaultValue={initial.topics.join(", ")} placeholder="분리불안, 야간 짖음, 노견 산책" />
        <div>
          <span className="block text-sm font-medium text-ink">상담 방식</span>
          <div className="mt-2 flex flex-wrap gap-4">
            {CONSULT_MODES.map((m) => (
              <CheckboxField key={m} name="modes" value={m} label={CONSULT_MODE_LABEL[m]} defaultChecked={initial.modes.includes(m)} />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="priceText" label="요금 문구" defaultValue={initial.priceText} placeholder="30분 20,000원 · 첫 상담 무료" hint="결제는 확인 뒤 안내 — 결제 확인이 되면 채팅이 열립니다" />
          <TextField name="contact" label="운영자 확인용 연락처 (비공개)" defaultValue={initial.contact} placeholder="010-0000-0000" />
        </div>
        <div>
          <span className="block text-sm font-medium text-ink">활동 지역 (최대 {EXPERT_LIMITS.regions}곳 · 비우면 온라인 전용)</span>
          <div className="mt-2">
            <RegionMultiPicker name="regionIds" options={regions} defaultIds={initial.regionIds} max={EXPERT_LIMITS.regions} />
          </div>
        </div>
        <UploadField name="heroImageKey" label="프로필 사진 (선택)" defaultKey={initial.heroImageKey} />
        {selfPublishes(kind) && <CheckboxField name="visible" label="공개 — 온라인 상담 허브와 지역 페이지에 보입니다" defaultChecked={isNew ? true : initial.status === "published"} />}
      </section>
      <RowsEditor
        name="slotsJson"
        title="주간 상담 슬롯"
        hint="매주 반복되는 시간(서울 기준). 신청자는 앞으로 2주 안의 빈 슬롯을 고릅니다. 비우면 연락받기만 받습니다."
        fields={SLOT_FIELDS}
        initialRows={slots}
        emptyRow={{ weekday: "2", start: "", end: "" }}
        addLabel="슬롯 추가"
        emptyHint="슬롯이 없습니다. 연락받기만 받습니다."
      />
      {state.error && <p className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-accent-deep">{state.error}</p>}
      {state.notice && <p className="rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">{state.notice}</p>}
      <SubmitButton pending={pending} label={isNew ? "프로필 만들기" : "저장"} />
    </form>
  );
}
