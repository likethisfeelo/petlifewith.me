"use client";

// 돌봄 파트너(펫시터·시간제 시터·도그워커) 등록 요청 폼 — care_partner.
// 주소는 받지 않는다 — 개인 사업자의 주거지가 공개된다 (claude.md 5-6). 활동 지역(시군구)만 받는다.
import Link from "next/link";
import { CARE_PERSON_LABEL, CARE_TYPE_SLUGS, type CareTypeSlug } from "@app/data";
import { RegionMultiPicker } from "@/components/requests/region-picker";
import { Req, RequestForm, inputClass, labelClass } from "@/components/requests/request-form";
import type { RegionOption } from "@/lib/queries/requests";
import { REQUEST_LIMITS } from "@/lib/requests";

const CARE_DESC: Record<CareTypeSlug, string> = {
  "pet-sitter": "보호자 집으로 가서 돌봐요",
  "hourly-sitter": "내 집에서 시간 단위로 맡아요",
  "dog-walk": "산책을 대신 나가요",
};

export function CarePartnerForm({ regions, defaultType, defaultRegionId }: { regions: RegionOption[]; defaultType: CareTypeSlug | null; defaultRegionId: number | null }) {
  return (
    <RequestForm
      kind="care_partner"
      submitLabel="등록 요청 보내기"
      requesterLabel="이름"
      doneBody={
        <>
          <p>운영자가 확인한 뒤 활동 지역 자리에 올리고 남겨 주신 연락처로 알려 드립니다. 지역별 자리는 무료입니다.</p>
          <p className="mt-2">
            <Link href="/spot/type/pet-sitter" className="font-medium underline">
              돌봄 파트너 디렉토리 보기
            </Link>
          </p>
        </>
      }
      messagePlaceholder="경력, 가능한 동물·크기, 자격 등 확인에 도움이 되는 내용을 적어 주세요."
    >
      {(v) => {
        const type = (v.typeSlug as CareTypeSlug | undefined) ?? defaultType;
        const regionIds = v.regionIds ? v.regionIds.split(",").map(Number).filter((n) => n > 0) : defaultRegionId ? [defaultRegionId] : [];
        return (
          <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <legend className="px-1 text-sm font-bold text-ink">활동 정보</legend>
            <div>
              <span className={labelClass}>
                어떤 일을 하시나요
                <Req />
              </span>
              <div className="mt-1 grid gap-2 sm:grid-cols-3">
                {CARE_TYPE_SLUGS.map((slug) => (
                  <label key={slug} className="flex cursor-pointer gap-2 rounded-xl border border-line bg-cream/40 p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-sand">
                    <input type="radio" name="typeSlug" value={slug} required defaultChecked={type === slug} className="mt-0.5" />
                    <span>
                      <span className="font-bold text-ink">{CARE_PERSON_LABEL[slug]}</span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{CARE_DESC[slug]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="displayName" className={labelClass}>
                활동명 (페이지에 표시되는 이름)
                <Req />
              </label>
              <input id="displayName" name="displayName" required minLength={2} maxLength={REQUEST_LIMITS.businessName} defaultValue={v.displayName} placeholder="예: 몽이네 펫시터" className={inputClass} />
              <p className="mt-1 text-xs text-ink-faint">본명 대신 활동명을 써도 됩니다. 주소는 받지 않고 활동 지역만 노출됩니다.</p>
            </div>
            <div>
              <span className={labelClass}>
                활동 지역 (최대 {REQUEST_LIMITS.areas}곳)
                <Req />
              </span>
              <div className="mt-1">
                <RegionMultiPicker name="regionIds" options={regions} defaultIds={regionIds} max={REQUEST_LIMITS.areas} />
              </div>
            </div>
            <div>
              <label htmlFor="intro" className={labelClass}>
                소개
                <Req />
              </label>
              <textarea id="intro" name="intro" required minLength={10} rows={4} maxLength={REQUEST_LIMITS.intro} defaultValue={v.intro} placeholder="어떤 방식으로 돌보는지, 어떤 아이와 잘 맞는지 (10자 이상)" className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="priceText" className={labelClass}>
                  요금
                </label>
                <input id="priceText" name="priceText" maxLength={REQUEST_LIMITS.short} defaultValue={v.priceText} placeholder="1시간 20,000원" className={inputClass} />
              </div>
              <div>
                <label htmlFor="hoursText" className={labelClass}>
                  활동 시간
                </label>
                <input id="hoursText" name="hoursText" maxLength={REQUEST_LIMITS.short} defaultValue={v.hoursText} placeholder="평일 저녁·주말" className={inputClass} />
              </div>
              <div>
                <label htmlFor="kakaoUrl" className={labelClass}>
                  카카오톡 채널
                </label>
                <input id="kakaoUrl" name="kakaoUrl" type="url" maxLength={REQUEST_LIMITS.url} defaultValue={v.kakaoUrl} placeholder="http://pf.kakao.com/_xxxxx" className={inputClass} />
              </div>
            </div>
          </fieldset>
        );
      }}
    </RequestForm>
  );
}
