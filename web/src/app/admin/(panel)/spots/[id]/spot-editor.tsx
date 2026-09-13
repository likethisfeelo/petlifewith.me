"use client";

import {useState} from "react";
import { useKeptForm } from "../../../_components/use-kept-form";
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
import { SPOT_LINK_KINDS } from "@/lib/links";
import { createSpotAction, saveSpotAction, type ActionState } from "../../../directory-actions";
import { ServiceAreasEditor, type AreaOption, type ServiceAreaRow } from "./service-areas-editor";

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
  heroImageKey?: string | null;
  isHospital?: boolean;
  seo?: SeoDefaults;
}

export interface DeviceOption {
  id: number;
  label: string;
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
  careTypeIds = [],
  areaOptions = [],
  serviceAreas = [],
  rehabTypeId,
  deviceOptions = [],
  spotDeviceIds = [],
  fromRequestId,
}: {
  mode: "create" | "edit";
  spot: SpotFormValues;
  types: SpotOption[];
  regions?: SpotOption[];
  links: RowValue[];
  /** 돌봄 파트너 유형(펫시터·펫산책)의 id — 고르면 서비스 지역 편집기가 나타난다 */
  careTypeIds?: number[];
  areaOptions?: AreaOption[];
  serviceAreas?: ServiceAreaRow[];
  /** 운동·재활 유형의 id — 고르면 보유 장비·병원 여부가 나타난다 */
  rehabTypeId?: number;
  deviceOptions?: DeviceOption[];
  spotDeviceIds?: number[];
  /** 요청함에서 넘어온 등록 — 등록되면 그 요청에 스팟을 연결한다 */
  fromRequestId?: number;
}) {
  const action = mode === "create" ? createSpotAction : saveSpotAction;
  const { state: state, pending: pending, onSubmit } = useKeptForm<ActionState>(action, {});
  const [typeId, setTypeId] = useState<number | "">(spot.typeId);
  const isCare = typeId !== "" && careTypeIds.includes(typeId);
  const isRehab = typeId !== "" && rehabTypeId !== undefined && typeId === rehabTypeId;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {spot.id !== undefined && <input type="hidden" name="id" value={spot.id} />}
      {fromRequestId !== undefined && <input type="hidden" name="fromRequestId" value={fromRequestId} />}

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
            value={typeId}
            onChange={(v) => setTypeId(v ? Number(v) : "")}
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
          hint={
            isCare
              ? "돌봄 파트너는 주소를 비워 두세요 — 개인 사업자의 주거지가 공개됩니다. 아래 서비스 지역(시군구)으로만 노출됩니다."
              : "층·호수 등 상세주소는 넣지 않습니다. 1인 사업장은 주거지와 같은 경우가 많습니다."
          }
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

        <UploadField
          name="heroImageKey"
          label="대표 이미지"
          defaultKey={spot.heroImageKey}
          hint="직접 촬영한 사진만. 페이지 상단과 공유 미리보기에 쓰입니다."
        />
      </section>

      {isCare && (
        <ServiceAreasEditor name="serviceAreasJson" options={areaOptions} initialRows={serviceAreas} homeRegionId={spot.regionId} />
      )}

      {isRehab && (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <h2 className="text-sm font-bold text-ink">보유 장비 (운동·재활)</h2>
            <p className="mt-1 text-xs text-ink-soft">
              직접 확인한 장비만 고릅니다. 고른 기기의 페이지에 &quot;지역별 체험 가능 업체&quot;로 함께 실립니다. 장비를 하나도 고르지 않으면 유료 상단 노출을 켤 수 없습니다.
            </p>
          </div>
          {deviceOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-4 text-xs text-ink-faint">등록된 기기가 없습니다. 먼저 기기를 등록하세요 (관리자 &gt; 기기).</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {deviceOptions.map((d) => (
                <CheckboxField key={d.id} name="deviceIds" value={String(d.id)} label={d.label} defaultChecked={spotDeviceIds.includes(d.id)} />
              ))}
            </div>
          )}
          <CheckboxField
            name="isHospital"
            label="동물병원입니다 (유료 상단 노출 제외)"
            defaultChecked={spot.isHospital ?? false}
          />
          <p className="text-xs text-ink-faint">병원은 장비 보유처로 무료 노출만 합니다 — 유료 상단 노출·순위·추천은 붙이지 않습니다 (claude.md 6-2).</p>
        </section>
      )}

      <SeoFields defaults={spot.seo ?? {}} />

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
