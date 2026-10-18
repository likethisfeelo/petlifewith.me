"use client";

// 내 업체 등록 요청 폼 — spot_register. 운영자가 확인한 뒤 /admin/spots/new?from=<요청> 으로 스팟을 만든다.
import Link from "next/link";
import { RegionSelect, selectClass } from "@/components/requests/region-picker";
import { RequestForm, inputClass, labelClass } from "@/components/requests/request-form";
import type { RegionOption, SpotTypeOption } from "@/lib/queries/requests";
import { REQUEST_LIMITS } from "@/lib/requests";
import type { OwnerSearchHit } from "@/lib/queries/spot-register";

export interface RegisterInitial {
  businessName?: string;
  phone?: string;
  regionId?: number | null;
  typeSlug?: string | null;
}

export function SpotRegisterForm({
  types,
  regions,
  initial = {},
  onPickDuplicate,
}: {
  types: SpotTypeOption[];
  regions: RegionOption[];
  /** 찾기 단계에서 넘어온 값 (검색어·지역·업종) — 등록 흐름(register-flow.tsx)이 채운다 */
  initial?: RegisterInitial;
  onPickDuplicate?: (hit: OwnerSearchHit) => void;
}) {
  const prefill = {
    regionId: initial.regionId && regions.some((r) => r.id === initial.regionId) ? initial.regionId : null,
    typeSlug: initial.typeSlug && types.some((t) => t.slug === initial.typeSlug) ? initial.typeSlug : "",
  };

  return (
    <RequestForm
      kind="spot_register"
      submitLabel="등록 요청 보내기"
      doneBody={
        <>
          <p>운영자가 확인한 뒤 업체 페이지를 만들고 남겨 주신 연락처로 알려 드립니다. 기본 등록과 정보 관리는 무료입니다.</p>
          <p className="mt-2">
            <Link href="/spot" className="font-medium underline">
              지역 디렉토리로 돌아가기
            </Link>
          </p>
        </>
      }
      messagePlaceholder="운영시간·요금·주차 등 페이지에 실을 정보나 궁금한 점을 적어 주세요."
      // 연락처만 있으면 접수된다 — 업체 정보는 모두 선택이라 연락받을 분을 맨 위에
      requesterFirst
      onPickDuplicate={onPickDuplicate}
      requesterExtra={(v) => (
        <div>
          <label htmlFor="businessName" className={labelClass}>
            업체명 (선택)
          </label>
          <input id="businessName" name="businessName" minLength={2} maxLength={REQUEST_LIMITS.businessName} defaultValue={v.businessName ?? initial.businessName} placeholder="예: 멍멍스파" className={inputClass} />
        </div>
      )}
    >
      {(v) => (
        <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-bold text-ink">업체 정보 (모두 선택)</legend>
          <div className="rounded-xl bg-sea-soft px-4 py-3.5">
            <p className="text-[15px] font-bold leading-snug text-ink">비워 두셔도 괜찮아요. 상담 후 카카오톡으로 알려 주셔도 됩니다.</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">아래 정보를 미리 적어 주시면 등록이 훨씬 빨리 끝나요.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="typeSlug" className={labelClass}>
                업종
              </label>
              {/* key — React 19 가 액션 뒤 폼을 초기화할 때 select 는 처음 defaultValue 로 돌아가므로, 되돌려 받은 값으로 다시 마운트한다 */}
              <select
                key={`${v.typeSlug ?? ""}|${prefill.typeSlug}`}
                id="typeSlug"
                name="typeSlug"
                defaultValue={v.typeSlug ?? prefill.typeSlug}
                className={`${selectClass} mt-1`}
              >
                <option value="">선택 안 함</option>
                {types.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className={labelClass}>
              지역 (시·군·구)
            </span>
            <div className="mt-1">
              <RegionSelect
                key={`${v.regionId ?? ""}|${prefill.regionId ?? ""}`}
                name="regionId"
                options={regions}
                defaultRegionId={v.regionId ? Number(v.regionId) : prefill.regionId}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="addressRoad" className={labelClass}>
                주소 (도로명, 건물번호까지)
              </label>
              <input id="addressRoad" name="addressRoad" maxLength={REQUEST_LIMITS.short} defaultValue={v.addressRoad} placeholder="층·호수는 적지 않습니다" className={inputClass} />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>
                업체 전화 (페이지에 표시)
              </label>
              <input id="phone" name="phone" maxLength={REQUEST_LIMITS.contact} defaultValue={v.phone ?? initial.phone} placeholder="02-000-0000" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="homepage" className={labelClass}>
                홈페이지
              </label>
              <input id="homepage" name="homepage" type="url" maxLength={REQUEST_LIMITS.url} defaultValue={v.homepage} placeholder="https://" className={inputClass} />
            </div>
            <div>
              <label htmlFor="kakaoUrl" className={labelClass}>
                카카오톡 채널
              </label>
              <input id="kakaoUrl" name="kakaoUrl" type="url" maxLength={REQUEST_LIMITS.url} defaultValue={v.kakaoUrl} placeholder="http://pf.kakao.com/_xxxxx" className={inputClass} />
            </div>
            <div>
              <label htmlFor="instagramUrl" className={labelClass}>
                인스타그램
              </label>
              <input id="instagramUrl" name="instagramUrl" type="url" maxLength={REQUEST_LIMITS.url} defaultValue={v.instagramUrl} placeholder="https://instagram.com/..." className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="intro" className={labelClass}>
              소개
            </label>
            <textarea id="intro" name="intro" rows={4} maxLength={REQUEST_LIMITS.intro} defaultValue={v.intro} placeholder="어떤 곳인지, 반려동물과 어떻게 이용하는지. 순위·추천 표현은 싣지 않습니다." className={inputClass} />
          </div>
        </fieldset>
      )}
    </RequestForm>
  );
}
