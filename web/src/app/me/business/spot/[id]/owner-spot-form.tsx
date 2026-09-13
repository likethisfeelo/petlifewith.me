"use client";

// 소유자용 업체 편집 폼 — 관리자 편집기의 부분집합. 이름·유형·지역·주소는 손대지 않는다 (요청으로).

import { saveOwnedSpotAction, type OwnerActionState } from "@/app/owner-actions";
import { useKeptForm } from "@/app/admin/_components/use-kept-form";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/app/admin/_components/fields";
import { RowsEditor, type RowValue } from "@/app/admin/_components/rows-editor";
import { UploadField } from "@/app/admin/_components/upload-field";
import { SPOT_LINK_KINDS } from "@/lib/links";

const STATUS_OPTIONS = [
  { value: "operating", label: "영업 중" },
  { value: "suspended", label: "휴업" },
  { value: "closed", label: "폐업" },
];

const LINK_FIELDS = [
  { key: "kind", label: "종류", type: "select" as const, span: "col-span-3", options: SPOT_LINK_KINDS.map((k) => ({ value: k.kind, label: k.label })) },
  { key: "url", label: "주소 (http/https)", span: "col-span-6", placeholder: "https://example.com" },
  { key: "label", label: "표시 이름 (선택)", span: "col-span-3", placeholder: "비우면 종류 이름" },
];

export interface OwnerSpotValues {
  id: number;
  status: string;
  phone: string | null;
  hoursText: string | null;
  priceText: string | null;
  parkingText: string | null;
  descriptionMd: string | null;
  heroImageKey: string | null;
  isCare: boolean;
}

export function OwnerSpotForm({ spot, links }: { spot: OwnerSpotValues; links: RowValue[] }) {
  const { state: state, pending: pending, onSubmit } = useKeptForm<OwnerActionState>(saveOwnedSpotAction, {});
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="id" value={spot.id} />
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField name="status" label="영업 상태" defaultValue={spot.status === "unknown" ? "operating" : spot.status} options={STATUS_OPTIONS} />
          <TextField name="phone" label={spot.isCare ? "연락 전화 (선택)" : "전화"} defaultValue={spot.phone} placeholder="02-000-0000" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="hoursText" label={spot.isCare ? "활동 시간" : "운영시간"} defaultValue={spot.hoursText} placeholder="매일 10:00–22:00" />
          <TextField name="priceText" label="요금" defaultValue={spot.priceText} placeholder="30분 15,000원" />
          {!spot.isCare && <TextField name="parkingText" label="주차" defaultValue={spot.parkingText} placeholder="건물 뒤 2대" />}
        </div>
        <TextAreaField name="descriptionMd" label="소개 (마크다운)" defaultValue={spot.descriptionMd} rows={6} hint="어떤 곳인지, 반려동물과 어떻게 이용하는지. 순위·추천 표현, 전화번호·집 주소는 넣지 않습니다." />
        <UploadField name="heroImageKey" label="대표 이미지" defaultKey={spot.heroImageKey} hint="직접 찍은 사진만. 페이지 상단과 공유 미리보기에 쓰입니다." />
      </section>
      <RowsEditor
        name="linksJson"
        title="연락·외부 링크"
        hint="홈페이지·카카오톡 채널·예약·인스타그램 등 있는 것만. 방문자의 예약·문의는 이 채널로 갑니다."
        fields={LINK_FIELDS}
        initialRows={links}
        emptyRow={{ kind: "kakao", url: "", label: "" }}
        addLabel="링크 추가"
        emptyHint="등록된 링크가 없습니다. 카카오톡 채널이나 홈페이지를 추가하세요."
      />
      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} />
    </form>
  );
}
