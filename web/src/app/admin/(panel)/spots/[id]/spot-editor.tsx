"use client";

import { useActionState } from "react";
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "../../../_components/fields";
import { RowsEditor, type RowValue } from "../../../_components/rows-editor";
import { SPOT_LINK_KINDS } from "@/lib/links";
import { createSpotAction, saveSpotAction, type ActionState } from "../../../directory-actions";

export interface SpotFormValues {
  id?: number;
  name: string;
  slug?: string;
  typeId: number | "";
  regionId?: number | "";
  status: string;
  addressRoad: string | null;
  phone: string | null;
  hoursText: string | null;
  priceText: string | null;
  parkingText: string | null;
  descriptionMd: string | null;
}

export interface SpotOption {
  id: number;
  label: string;
}

const STATUS_OPTIONS = [
  { value: "operating", label: "영업 중" },
  { value: "suspended", label: "휴업" },
  { value: "closed", label: "폐업" },
  { value: "unknown", label: "확인 필요" },
];

const LINK_FIELDS = [
  {
    key: "kind",
    label: "종류",
    type: "select" as const,
    span: "col-span-3",
    options: SPOT_LINK_KINDS.map((k) => ({ value: k.kind, label: k.label })),
  },
  { key: "url", label: "주소 (http/https)", span: "col-span-6", placeholder: "https://example.com" },
  { key: "label", label: "표시 이름 (선택)", span: "col-span-3", placeholder: "비우면 종류 이름" },
];

export function SpotEditor({
  mode,
  spot,
  types,
  regions,
  links,
}: {
  mode: "create" | "edit";
  spot: SpotFormValues;
  types: SpotOption[];
  regions?: SpotOption[];
  links: RowValue[];
}) {
  const action = mode === "create" ? createSpotAction : saveSpotAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {spot.id !== undefined && <input type="hidden" name="id" value={spot.id} />}

      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="name" label="업체명" defaultValue={spot.name} required />
          {mode === "create" && (
            <TextField
              name="slug"
              label="슬러그 (선택)"
              defaultValue={spot.slug ?? ""}
              hint="비우면 업체명으로 자동 생성됩니다. URL 은 /place/[id]-[슬러그]."
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            name="typeId"
            label="유형"
            required
            defaultValue={spot.typeId}
            placeholder="선택하세요"
            options={types.map((t) => ({ value: t.id, label: t.label }))}
          />
          {/* 지역은 등록 시점에만 정한다 — 바뀌면 URL 과 지역 집계가 함께 흔들린다 */}
          {mode === "create" && (
            <SelectField
              name="regionId"
              label="지역 (시군구)"
              required
              defaultValue={spot.regionId ?? ""}
              placeholder="선택하세요"
              options={(regions ?? []).map((r) => ({ value: r.id, label: r.label }))}
            />
          )}
          <SelectField name="status" label="영업 상태" defaultValue={spot.status} options={STATUS_OPTIONS} />
          <TextField name="phone" label="전화" defaultValue={spot.phone} />
        </div>

        {mode === "create" && (
          <TextField
            name="dataReferenceDate"
            label="정보 확인 기준일"
            type="date"
            hint="직접 확인한 날짜. 페이지에 기준일로 표기됩니다."
          />
        )}

        <TextField
          name="addressRoad"
          label="주소 (도로명 + 건물번호까지)"
          defaultValue={spot.addressRoad}
          hint="층·호수 등 상세주소는 넣지 않습니다. 1인 사업장은 주거지와 같은 경우가 많습니다."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField name="hoursText" label="운영시간" defaultValue={spot.hoursText} placeholder="매일 10:00–22:00" />
          <TextField name="priceText" label="요금" defaultValue={spot.priceText} placeholder="30분 15,000원" />
          <TextField name="parkingText" label="주차" defaultValue={spot.parkingText} placeholder="건물 뒤 2대" />
        </div>

        <TextAreaField
          name="descriptionMd"
          label="소개 (마크다운)"
          defaultValue={spot.descriptionMd}
          rows={6}
          mono
          hint="직접 확인한 사실 위주로. 순위·추천 표현은 쓰지 않습니다."
        />
      </section>

      <RowsEditor
        name="linksJson"
        title="외부 링크"
        hint="홈페이지·카카오톡·예약 등 있는 것만 골라 넣으세요. 전부 채울 필요 없습니다. 링크도 정보 항목으로 세어 색인 여부에 반영됩니다."
        fields={LINK_FIELDS}
        initialRows={links}
        emptyRow={{ kind: "website", url: "", label: "" }}
        addLabel="링크 추가"
        emptyHint="등록된 링크가 없습니다. 카카오톡 채널이나 홈페이지가 있으면 추가하세요."
      />

      <FormMessage error={state.error} saved={state.saved} />
      <SubmitButton pending={pending} label={mode === "create" ? "등록" : "저장"} pendingLabel={mode === "create" ? "등록 중..." : "저장 중..."} />
    </form>
  );
}
