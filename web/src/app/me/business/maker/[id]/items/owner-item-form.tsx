"use client";

// 소유자용 상품 폼 — 등록·수정 공용. 구매 링크는 자사몰·기타만 (쿠팡 제휴 링크는 운영자가 단다).

import { createOwnedItemAction, deleteOwnedItemAction, saveOwnedItemAction, type OwnerActionState } from "@/app/owner-actions";
import { useKeptForm } from "@/app/admin/_components/use-kept-form";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/app/admin/_components/fields";
import { RowsEditor, type RowValue } from "@/app/admin/_components/rows-editor";
import { UploadField } from "@/app/admin/_components/upload-field";

const CATEGORY_OPTIONS = [
  { value: "toy", label: "장난감" },
  { value: "treat", label: "간식" },
  { value: "supplement", label: "보조제" },
  { value: "tool", label: "도구" },
  { value: "gear", label: "용품" },
];

const OFFER_FIELDS = [
  { key: "vendor", label: "구매처", type: "select" as const, span: "col-span-3", options: [{ value: "brand_store", label: "자사몰·스토어" }, { value: "other", label: "기타" }] },
  { key: "url", label: "구매 링크 (http/https)", span: "col-span-6", placeholder: "https://smartstore.naver.com/..." },
  { key: "label", label: "버튼 이름 (선택)", span: "col-span-3", placeholder: "스토어에서 보기" },
];

export interface OwnerItemValues {
  id?: number;
  makerId: number;
  name: string;
  category: string;
  summary: string | null;
  descriptionMd: string | null;
  imageKey: string | null;
  /** 이 상품을 연결한 글 수 — 0 일 때만 삭제할 수 있다 */
  mentionCount?: number;
}

export function OwnerItemForm({ mode, item, offers }: { mode: "create" | "edit"; item: OwnerItemValues; offers: RowValue[] }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<OwnerActionState>(mode === "create" ? createOwnedItemAction : saveOwnedItemAction, {});
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        {item.id !== undefined && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="makerId" value={item.makerId} />
        <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="name" label="상품명" defaultValue={item.name} required />
            <SelectField name="category" label="분류" defaultValue={item.category || "treat"} options={CATEGORY_OPTIONS} />
          </div>
          <TextField name="summary" label="한 줄 소개" defaultValue={item.summary} placeholder="200자 이내" />
          <TextAreaField name="descriptionMd" label="설명 (마크다운)" defaultValue={item.descriptionMd} rows={6} hint="성분·소재·크기 같은 사실 위주로. 효능 단정(치료·예방)은 쓰지 않습니다." />
          <UploadField name="imageKey" label="상품 이미지" defaultKey={item.imageKey} hint="직접 찍은 사진만." />
        </section>
        <RowsEditor
          name="offersJson"
          title="구매 링크"
          hint="자사몰·스마트스토어 등. 쿠팡 파트너스 링크는 운영자가 달고 수수료 고지를 붙입니다."
          fields={OFFER_FIELDS}
          initialRows={offers}
          emptyRow={{ vendor: "brand_store", url: "", label: "" }}
          addLabel="구매 링크 추가"
          emptyHint="구매 링크가 없습니다. 있으면 추가하세요."
        />
        <FormMessage error={state.error} saved={state.saved} />
        <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} pendingLabel={mode === "create" ? "등록 중..." : "저장 중..."} />
      </form>
      {mode === "edit" && item.id !== undefined && (
        <form action={deleteOwnedItemAction} className="mt-6 border-t border-line pt-4">
          <input type="hidden" name="id" value={item.id} />
          {item.mentionCount ? (
            <p className="text-xs text-ink-faint">이 상품은 글 {item.mentionCount}편에 연결되어 있어 삭제할 수 없습니다. 연결을 풀거나 운영자에게 문의하세요.</p>
          ) : (
            <button type="submit" className="text-xs font-medium text-accent-deep hover:underline">
              상품 삭제
            </button>
          )}
        </form>
      )}
    </>
  );
}
