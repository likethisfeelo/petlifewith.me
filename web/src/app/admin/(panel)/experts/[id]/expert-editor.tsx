"use client";


import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { useKeptForm } from "../../../_components/use-kept-form";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { UploadField } from "../../../_components/upload-field";
import { createExpertAction, saveExpertAction } from "../../../expert-actions";
import type { ActionState } from "../../../actions";
import { RegionMultiPicker } from "@/components/requests/region-picker";
import type { RegionOption } from "@/lib/queries/requests";
import { CONSULT_MODES, CONSULT_MODE_LABEL, EXPERT_KINDS, EXPERT_KIND_LABEL, EXPERT_LIMITS, WEEKDAY_LABEL } from "@/lib/reservations";

export interface ExpertFormValues {
  id?: number;
  kind: string;
  displayName: string;
  slug?: string;
  introMd: string | null;
  credentialsText: string | null;
  credentialsVerifiedAt: string | null;
  topics: string[];
  modes: string[];
  priceText: string | null;
  heroImageKey: string | null;
  userEmail: string;
  contact: string | null;
  status: "draft" | "published";
  sortOrder: number;
  regionIds: number[];
}

const SLOT_FIELDS = [
  { key: "weekday", label: "요일", type: "select" as const, span: "col-span-4", options: WEEKDAY_LABEL.map((l, i) => ({ value: String(i), label: l })) },
  { key: "start", label: "시작 (HH:MM)", span: "col-span-4", placeholder: "20:00" },
  { key: "end", label: "끝 (HH:MM)", span: "col-span-4", placeholder: "21:00" },
];

export function ExpertEditor({ mode, expert, slots, regions }: { mode: "create" | "edit"; expert: ExpertFormValues; slots: RowValue[]; regions: RegionOption[] }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<ActionState>(mode === "create" ? createExpertAction : saveExpertAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {expert.id !== undefined && <input type="hidden" name="id" value={expert.id} />}
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField name="kind" label="종류" defaultValue={expert.kind} options={EXPERT_KINDS.map((k) => ({ value: k, label: EXPERT_KIND_LABEL[k] }))} required />
          <TextField name="displayName" label="활동명" defaultValue={expert.displayName} required />
          {mode === "create" ? <TextField name="slug" label="슬러그 (선택)" defaultValue={expert.slug ?? ""} hint="비우면 활동명으로" /> : <TextField name="sortOrder" label="정렬 (작을수록 위)" type="number" defaultValue={String(expert.sortOrder)} />}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="credentialsText" label="자격·경력 (사실만)" defaultValue={expert.credentialsText} placeholder="반려동물행동지도사 2급 · 훈련 경력 8년" hint="훈련사는 자격 확인 뒤 공개. 병원명·주소는 넣지 않습니다." />
          <TextField name="credentialsVerifiedAt" label="확인 기준일" type="date" defaultValue={expert.credentialsVerifiedAt ?? ""} hint="자격을 확인한 날짜 — 페이지에 함께 표기" />
        </div>
        <TextField name="topics" label="상담 주제 (쉼표로)" defaultValue={expert.topics.join(", ")} placeholder="분리불안, 야간 짖음, 관절 약한 아이 산책" />
        <div>
          <span className="block text-sm font-medium text-ink">상담 방식</span>
          <div className="mt-2 flex flex-wrap gap-4">
            {CONSULT_MODES.map((m) => (
              <CheckboxField key={m} name="modes" value={m} label={CONSULT_MODE_LABEL[m]} defaultChecked={expert.modes.includes(m)} />
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="priceText" label="요금 문구" defaultValue={expert.priceText} placeholder="30분 30,000원 · 첫 상담 무료" hint="결제는 수동 안내 — 금액 계산에 쓰지 않습니다" />
          <TextField name="userEmail" label="회원 계정 이메일 (선택)" defaultValue={expert.userEmail} hint="이 회원이 받은 요청을 확인·결제 확인·채팅합니다. 비우면 운영자가 대신 응대" />
        </div>
        <TextAreaField name="introMd" label="소개 (마크다운)" defaultValue={expert.introMd} rows={6} hint="어떤 고민을 함께 볼 수 있는지. 진단·처방·치료 표현은 쓰지 않습니다." />
        <div>
          <span className="block text-sm font-medium text-ink">활동 지역 (최대 {EXPERT_LIMITS.regions}곳 · 비우면 온라인 전용)</span>
          <div className="mt-2">
            <RegionMultiPicker name="regionIds" options={regions} defaultIds={expert.regionIds} max={EXPERT_LIMITS.regions} />
          </div>
        </div>
        <TextField name="contact" label="관리자 확인용 연락처 (비공개)" defaultValue={expert.contact} />
        <UploadField name="heroImageKey" label="프로필 사진" defaultKey={expert.heroImageKey} />
        {mode === "create" && <TextField name="sortOrder" label="정렬 (작을수록 위)" type="number" defaultValue={String(expert.sortOrder)} />}
        <CheckboxField name="status" value="published" label="공개 (상담 허브에 노출)" defaultChecked={expert.status === "published"} />
      </section>
      <RowsEditor
        name="slotsJson"
        title="주간 상담 슬롯"
        hint="매주 반복되는 시간. 신청자는 앞으로 2주 안의 빈 슬롯을 고릅니다 (서울 시간). 비우면 연락받기만 가능."
        fields={SLOT_FIELDS}
        initialRows={slots}
        emptyRow={{ weekday: "2", start: "", end: "" }}
        addLabel="슬롯 추가"
        emptyHint="슬롯이 없습니다. 연락받기만 받습니다."
      />
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
