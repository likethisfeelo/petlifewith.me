"use client";


import Link from "next/link";
import { useKeptForm } from "../../../_components/use-kept-form";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { UploadField } from "../../../_components/upload-field";
import { createDeviceAction, saveDeviceAction, type ActionState } from "../../../directory-actions";
import { DEVICE_CATEGORIES, DEVICE_CATEGORY_LABEL } from "@/lib/devices";

export interface DeviceFormValues {
  id?: number;
  name: string;
  makerName: string | null;
  category: string;
  summaryMd: string | null;
  specsMd: string | null;
  makerUrl?: string | null;
  makerContactUrl?: string | null;
  imageKey?: string | null;
  priceText?: string | null;
  published?: boolean;
  homeUse?: boolean;
  featuredOrder?: number | null;
}

export interface TrialSiteRow {
  spotId: number;
  name: string;
  regionLabel: string | null;
}

const CATEGORY_OPTIONS = DEVICE_CATEGORIES.map((c) => ({ value: c, label: DEVICE_CATEGORY_LABEL[c] }));

export function DeviceEditor({
  mode,
  device,
  regions,
  sites,
  dealers = [],
  trials = [],
}: {
  mode: "create" | "edit";
  device: DeviceFormValues;
  regions: Array<{ id: number; label: string }>;
  sites: RowValue[];
  dealers?: RowValue[];
  trials?: TrialSiteRow[];
}) {
  const action = mode === "create" ? createDeviceAction : saveDeviceAction;
  const { state: state, pending: pending, onSubmit } = useKeptForm<ActionState>(action, {});

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

  const dealerFields = [
    { key: "name", label: "대리점·취급처", span: "col-span-4", placeholder: "○○메디칼" },
    {
      key: "regionId",
      label: "지역",
      type: "select" as const,
      span: "col-span-3",
      options: [{ value: "", label: "선택 안 함" }, ...regions.map((r) => ({ value: String(r.id), label: r.label }))],
    },
    { key: "url", label: "주소 (선택)", span: "col-span-3", placeholder: "https://example.com" },
    { key: "phone", label: "전화 (선택)", span: "col-span-2" },
    { key: "note", label: "메모 (선택)", span: "col-span-12" },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
          <TextField name="makerName" label="제조사 (본사)" defaultValue={device.makerName} />
          <SelectField name="category" label="분류" defaultValue={device.category} options={CATEGORY_OPTIONS} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="makerUrl" label="본사 사이트 (선택)" defaultValue={device.makerUrl ?? ""} placeholder="https://example.com" />
          <TextField name="makerContactUrl" label="본사 문의 링크 (선택)" defaultValue={device.makerContactUrl ?? ""} placeholder="https://example.com/contact" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="priceText" label="가격대 문구 (선택)" defaultValue={device.priceText ?? ""} placeholder="본체 300만원대 · 대여 월 15만원" hint="본사·대리점이 공개한 범위만. 최저가·할인 표현은 쓰지 않습니다." />
          <TextField name="featuredOrder" label="주목 기기 순서 (선택)" type="number" defaultValue={device.featuredOrder != null ? String(device.featuredOrder) : ""} hint="숫자를 넣으면 허브 상단 '주목 기기'에 광고 표기와 함께 고정됩니다. 비우면 일반 노출." />
        </div>
        <UploadField name="imageKey" label="대표 이미지" defaultKey={device.imageKey ?? null} hint="제조사 제공 이미지는 사용 허락을 받은 것만. 출처 불명 이미지는 올리지 않습니다." />
        <div className="flex flex-wrap gap-5">
          <CheckboxField name="published" label="공개 (관리·재활 도구 허브에 노출)" defaultChecked={device.published ?? false} />
          <CheckboxField name="homeUse" label="집에서 쓰는 기기" defaultChecked={device.homeUse ?? false} />
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
        name="dealersJson"
        title="대리점·취급처"
        hint="본사가 알려 준 판매·설치 창구. 가격 비교나 순위가 아니라 연락 창구를 적습니다."
        fields={dealerFields}
        initialRows={dealers}
        emptyRow={{ name: "", regionId: "", url: "", phone: "", note: "" }}
        addLabel="대리점 추가"
        emptyHint="등록된 대리점이 없습니다."
      />

      {mode === "edit" && (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">지역별 체험 가능 업체 {trials.length > 0 ? `${trials.length}곳` : ""}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            스팟(운동·재활 유형) 편집 화면의 &quot;보유 장비&quot;에서 연결합니다. 여기서는 확인만 합니다.
          </p>
          {trials.length === 0 ? (
            <p className="mt-2 text-xs text-ink-faint">연결된 업체가 없습니다.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {trials.map((t) => (
                <li key={t.spotId}>
                  <Link href={`/admin/spots/${t.spotId}`} className="rounded-full bg-sea-soft px-2.5 py-1 text-xs font-medium text-sea hover:bg-sea hover:text-white">
                    {t.name}
                    {t.regionLabel ? ` · ${t.regionLabel}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <RowsEditor
        name="sitesJson"
        title="보유 병원 (무료 노출 전용)"
        hint="직접 확인한 곳만 넣습니다. 병원은 무료·순위 없는 목록으로만 싣고 유료 상단 노출을 붙이지 않습니다. 확인일을 함께 남기세요."
        fields={siteFields}
        initialRows={sites}
        emptyRow={{ facilityName: "", regionId: "", verifiedAt: "", note: "" }}
        addLabel="보유 병원 추가"
        emptyHint="확인한 보유 병원이 없습니다."
      />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
