"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { createItemAction, saveItemAction, type ActionState } from "../../../directory-actions";

export interface ItemFormValues {
  id?: number;
  name: string;
  category: string;
  makerId: number | "";
  summary: string | null;
  descriptionMd: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "toy", label: "장난감" },
  { value: "treat", label: "간식" },
  { value: "supplement", label: "보조제" },
  { value: "tool", label: "도구" },
  { value: "gear", label: "용품" },
];

// 쿠팡 파트너스는 제휴 링크다. 저장 시 제휴 플래그가 자동으로 켜지고,
// 그 링크가 렌더되는 페이지에는 수수료 고지가 자동 노출된다 (claude.md 6-4).
const OFFER_FIELDS = [
  {
    key: "vendor",
    label: "구매처",
    type: "select" as const,
    span: "col-span-2",
    options: [
      { value: "coupang", label: "쿠팡" },
      { value: "brand_store", label: "자사몰·스토어" },
      { value: "other", label: "기타" },
    ],
  },
  { key: "url", label: "구매 링크 (http/https)", span: "col-span-5", placeholder: "https://link.coupang.com/..." },
  { key: "label", label: "버튼 표시 이름 (선택)", span: "col-span-3", placeholder: "쿠팡에서 보기" },
  { key: "isAffiliate", label: "제휴 링크", type: "checkbox" as const, span: "col-span-2" },
];

export function ItemEditor({
  mode,
  item,
  makers,
  offers,
}: {
  mode: "create" | "edit";
  item: ItemFormValues;
  makers: Array<{ id: number; label: string }>;
  offers: RowValue[];
}) {
  const action = mode === "create" ? createItemAction : saveItemAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {item.id !== undefined && <input type="hidden" name="id" value={item.id} />}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="상품명" defaultValue={item.name} required />
          {mode === "create" && <TextField name="slug" label="슬러그 (선택)" hint="비우면 상품명으로 자동 생성됩니다." />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="category" label="분류" defaultValue={item.category} options={CATEGORY_OPTIONS} />
          <SelectField
            name="makerId"
            label="만든 곳 (선택)"
            defaultValue={item.makerId}
            placeholder="선택 안 함"
            options={makers.map((m) => ({ value: m.id, label: m.label }))}
          />
        </div>

        <TextField
          name="summary"
          label="한 줄 요약"
          defaultValue={item.summary}
          hint="글 안의 상품 카드와 목록에 노출됩니다."
        />

        <TextAreaField name="descriptionMd" label="설명 (마크다운)" defaultValue={item.descriptionMd} rows={8} mono />
      </section>

      <RowsEditor
        name="offersJson"
        title="구매 링크"
        hint="쿠팡을 고르면 제휴 링크로 저장되고, 이 상품이 노출되는 페이지에 수수료 고지가 자동으로 붙습니다."
        fields={OFFER_FIELDS}
        initialRows={offers}
        emptyRow={{ vendor: "coupang", url: "", label: "", isAffiliate: true }}
        addLabel="구매 링크 추가"
        emptyHint="구매 링크가 없습니다. 쿠팡 파트너스 링크나 자사몰 주소를 넣으세요."
      />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} />
    </form>
  );
}
