"use client";

import { useActionState } from "react";
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { SeoFields, type SeoDefaults } from "../../../_components/seo-fields";
import { UploadField } from "../../../_components/upload-field";
import { MAKER_LINK_KINDS } from "@/lib/links";
import { createMakerAction, saveMakerAction, type ActionState } from "../../../directory-actions";

export interface MakerFormValues {
  id?: number;
  name: string;
  slug?: string;
  category: string;
  regionId: number | "";
  storyMd: string | null;
  badgeFeedRegistered: boolean;
  badgeIngredientRegistered: boolean;
  badgeVerifiedAt: string | null;
  badgeNote: string | null;
  selectionMemo: string | null;
  status: string;
  heroImageKey?: string | null;
  seo?: SeoDefaults;
}

const CATEGORY_OPTIONS = [
  { value: "treats", label: "간식" },
  { value: "toys", label: "장난감" },
  { value: "goods", label: "용품" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "작성 중 (비공개)" },
  { value: "published", label: "공개" },
];

const LINK_FIELDS = [
  {
    key: "kind",
    label: "종류",
    type: "select" as const,
    span: "col-span-3",
    options: MAKER_LINK_KINDS.map((k) => ({ value: k.kind, label: k.label })),
  },
  { key: "url", label: "주소 (http/https)", span: "col-span-6", placeholder: "https://smartstore.naver.com/..." },
  { key: "label", label: "표시 이름 (선택)", span: "col-span-3" },
];

export function MakerEditor({
  mode,
  maker,
  regions,
  links,
}: {
  mode: "create" | "edit";
  maker: MakerFormValues;
  regions: Array<{ id: number; label: string }>;
  links: RowValue[];
}) {
  const action = mode === "create" ? createMakerAction : saveMakerAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {maker.id !== undefined && <input type="hidden" name="id" value={maker.id} />}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="브랜드명" defaultValue={maker.name} required />
          {mode === "create" && (
            <TextField name="slug" label="슬러그 (선택)" hint="비우면 브랜드명으로 자동 생성됩니다." />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField name="category" label="분류" defaultValue={maker.category} options={CATEGORY_OPTIONS} />
          <SelectField
            name="regionId"
            label="지역 (시군구, 선택)"
            defaultValue={maker.regionId}
            placeholder="선택 안 함"
            options={regions.map((r) => ({ value: r.id, label: r.label }))}
            hint="상세 주소와 대표자명은 표시하지 않습니다."
          />
          <SelectField name="status" label="공개 상태" defaultValue={maker.status} options={STATUS_OPTIONS} />
        </div>

        <TextAreaField
          name="storyMd"
          label="브랜드 소개 (마크다운)"
          defaultValue={maker.storyMd}
          rows={10}
          mono
          hint="만든 이유와 과정에 실체가 있는지가 선정 기준입니다. 소개가 비어 있으면 공개해도 색인되지 않습니다."
        />

        <UploadField
          name="heroImageKey"
          label="대표 이미지"
          defaultKey={maker.heroImageKey}
          hint="브랜드 제공 이미지는 사용 허락을 받은 것만 올립니다."
        />
      </section>

      <SeoFields defaults={maker.seo ?? {}} />

      {/* 배지는 평가가 아니라 공적 데이터에 근거한 사실 진술이다 (claude.md 7) */}
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-ink">등록 확인 배지</h2>
        <p className="text-xs text-ink-faint">
          &quot;인증&quot;이 아니라 사실 확인 표기입니다. 켜려면 확인 기준일이 반드시 필요합니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxField
            name="badgeFeedRegistered"
            label="사료제조업 등록 확인"
            defaultChecked={maker.badgeFeedRegistered}
          />
          <CheckboxField
            name="badgeIngredientRegistered"
            label="성분등록 확인"
            defaultChecked={maker.badgeIngredientRegistered}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="badgeVerifiedAt" label="확인 기준일" type="date" defaultValue={maker.badgeVerifiedAt} />
          <TextField
            name="badgeNote"
            label="확인 항목 메모"
            defaultValue={maker.badgeNote}
            hint="배지 툴팁에 노출됩니다."
          />
        </div>
      </section>

      <RowsEditor
        name="linksJson"
        title="판매 채널·링크"
        hint="자사몰·스마트스토어·카카오톡 등 있는 것만 넣으세요."
        fields={LINK_FIELDS}
        initialRows={links}
        emptyRow={{ kind: "website", url: "", label: "" }}
        addLabel="링크 추가"
      />

      <section className="rounded-xl border border-line bg-surface p-4">
        <TextAreaField
          name="selectionMemo"
          label="선정 기준 검증 메모 (내부용 · 공개되지 않음)"
          defaultValue={maker.selectionMemo}
          rows={4}
          hint="직접 제조 여부, 성분·소재 공개 여부, 고객 대응 이력 등 확인한 내용."
        />
      </section>

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
