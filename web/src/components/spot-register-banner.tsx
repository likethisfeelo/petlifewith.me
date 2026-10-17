"use client";

// 지역 스팟 페이지 맨 위 — "내 업체 등록하기" 배너.
// 손님에게는 두 갈래: ① 회원가입 후 등록(추천 — 요청이 계정에 묶여 진행 상황 확인·정보 직접 관리) ② 로그인 없이 바로 등록 요청.
// 회원에게는 한 갈래(바로 등록 — 요청이 이미 계정에 묶인다, app/request-actions.ts).
// 등록 폼(/portal/spot)에 지역·업종을 미리 채워 보낸다 (?region=<regions.id>&type=<spot_types.slug>).
import Link from "next/link";
import { useCurrentMember } from "@/components/member-menu";
import { track } from "@/components/tracker";

export function SpotRegisterBanner({
  regionLabel,
  regionId,
  typeSlug,
  typeName,
  care,
}: {
  /** 화면에 보일 지역 (예: 서울 강남구, 전라남도) */
  regionLabel: string;
  regionId?: number;
  typeSlug?: string;
  typeName?: string;
  /** 펫시터 등 돌봄 유형 — 시설 등록이 아니라 돌봄 파트너 등록으로 */
  care?: boolean;
}) {
  const { loading, member } = useCurrentMember();
  const q = new URLSearchParams();
  if (regionId) q.set("region", String(regionId));
  if (typeSlug && !care) q.set("type", typeSlug);
  const qs = q.toString();
  const target = care ? "/portal/care" : `/portal/spot${qs ? `?${qs}` : ""}#register`;
  const signupHref = `/signup?next=${encodeURIComponent(target)}`;
  const what = typeName ?? "반려동물";
  const onClick = (via: string) => () => track("entity_click", { link_area: "spot_register_banner", method: via });

  return (
    <section aria-labelledby="spot-register-title" className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid gap-4 p-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sea">사장님이신가요?</p>
          <h2 id="spot-register-title" className="mt-1 text-lg font-extrabold tracking-tight text-ink sm:text-xl">
            {care ? `${regionLabel}에서 ${what}로 활동하신다면` : `${regionLabel}에서 ${what} 업체를 운영하신다면`}, 무료로 소개해 드려요
          </h2>
          <p className="mt-1.5 hidden text-sm leading-relaxed text-ink-soft sm:block">
            {care
              ? "활동 지역(시·군·구)으로 노출됩니다. 지역마다 5자리, 등록은 무료예요."
              : "목록에 없는 업체를 등록하거나, 이미 있는 업체 정보를 고칠 수 있어요. 기본 등록·정보 관리는 무료이고 운영자가 확인한 뒤 반영합니다."}
          </p>
        </div>

        {loading ? (
          <div className="h-12 w-56 animate-pulse rounded-full bg-sand" aria-hidden />
        ) : member ? (
          <Link href={target} onClick={onClick("member")} className="inline-flex justify-center rounded-full bg-ink px-6 py-3 text-sm font-bold text-cream hover:opacity-90">
            {care ? "돌봄 파트너 등록하기" : "내 업체 등록하기"} →
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2 lg:w-[26rem]">
            <Link href={signupHref} onClick={onClick("signup")} className="flex flex-col justify-center rounded-xl bg-ink px-3 py-3 text-center text-cream hover:opacity-90 sm:px-4 sm:text-left">
              <span className="block break-keep text-[13px] font-bold sm:text-sm">회원가입 후 등록하기</span>
              <span className="mt-0.5 hidden text-xs text-cream/70 sm:block">추천 · 진행 상황 확인, 정보 직접 관리</span>
            </Link>
            <Link href={target} onClick={onClick("direct")} className="flex flex-col justify-center rounded-xl border border-line bg-cream px-3 py-3 text-center text-ink hover:bg-sand sm:px-4 sm:text-left">
              <span className="block break-keep text-[13px] font-bold sm:text-sm">업체 등록 바로 가기</span>
              <span className="mt-0.5 hidden text-xs text-ink-faint sm:block">로그인 없이 요청만 남기기</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
