"use client";

// 소유자용 브랜드 편집 — 소개·대표 이미지·링크. 이름·분류·공개 여부는 운영자가.

import { saveOwnedMakerAction, type OwnerActionState } from "@/app/owner-actions";
import { useKeptForm } from "@/app/admin/_components/use-kept-form";
import { FormMessage, SubmitButton, TextAreaField } from "@/app/admin/_components/fields";
import { RowsEditor, type RowValue } from "@/app/admin/_components/rows-editor";
import { UploadField } from "@/app/admin/_components/upload-field";
import { MAKER_LINK_KINDS } from "@/lib/links";

const LINK_FIELDS = [
  { key: "kind", label: "종류", type: "select" as const, span: "col-span-3", options: MAKER_LINK_KINDS.map((k) => ({ value: k.kind, label: k.label })) },
  { key: "url", label: "주소 (http/https)", span: "col-span-6", placeholder: "https://example.com" },
  { key: "label", label: "표시 이름 (선택)", span: "col-span-3", placeholder: "비우면 종류 이름" },
];

export function OwnerMakerForm({ maker, links }: { maker: { id: number; storyMd: string | null; heroImageKey: string | null }; links: RowValue[] }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<OwnerActionState>(saveOwnedMakerAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={maker.id} />
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <TextAreaField name="storyMd" label="브랜드 소개 (마크다운)" defaultValue={maker.storyMd} rows={8} hint="만든 이유와 과정, 성분·소재를 어떻게 고르는지. 대표자 개인명·상세 주소는 넣지 않습니다." />
        <UploadField name="heroImageKey" label="대표 이미지" defaultKey={maker.heroImageKey} hint="직접 찍은 사진만." />
      </section>
      <RowsEditor
        name="linksJson"
        title="구매·연락 링크"
        hint="자사몰·스마트스토어·카카오톡·인스타그램 등 있는 것만. 방문자의 구매·문의는 이 채널로 갑니다."
        fields={LINK_FIELDS}
        initialRows={links}
        emptyRow={{ kind: "website", url: "", label: "" }}
        addLabel="링크 추가"
        emptyHint="등록된 링크가 없습니다."
      />
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} />
    </form>
  );
}
