import type { Metadata } from "next";
import Link from "next/link";
import { siteName } from "@/lib/config";
import { EXPERT_KINDS, EXPERT_KIND_BLURB, EXPERT_KIND_LABEL } from "@/lib/reservations";

// 상담 파트너 등록은 회원이 내 페이지에서 직접 만든다 (멘토 즉시 공개, 훈련사는 자격 확인 뒤). 이 페이지는 안내와 진입점.
export const metadata: Metadata = {
  title: "상담 파트너 등록 — 훈련사·멘토",
  robots: { index: false, follow: true },
};

export default function ExpertPortalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 상담 파트너</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">훈련사·멘토로 노견 보호자와 만나기</h1>
      <p className="mt-4 text-ink-soft">
        회원 가입 뒤 내 페이지의 &quot;상담 프로필&quot;에서 직접 프로필을 만듭니다. 활동 지역(최대 5곳)을 고르면 그 지역 페이지에, 비우면 온라인 전용으로 보이고, 주간 상담 슬롯을 두면 신청자가 시간을 예약합니다.
        신청 → 확인 → 결제 확인(수동) → 채팅 순서로 이어집니다.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {EXPERT_KINDS.map((k) => (
          <li key={k} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-bold text-ink">{EXPERT_KIND_LABEL[k]}</p>
            <p className="mt-1 text-sm text-ink-soft">{EXPERT_KIND_BLURB[k]}</p>
            <p className="mt-1 text-xs text-ink-faint">{k === "trainer" ? "자격·경력을 적으면 운영자가 확인한 뒤 공개합니다." : "저장하면 바로 공개되고 언제든 비공개로 바꿀 수 있어요."}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/signup?next=%2Fme%2Fexpert" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:opacity-90">
          가입하고 프로필 만들기
        </Link>
        <Link href="/login?next=%2Fme%2Fexpert" className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-sand">
          이미 회원이에요
        </Link>
      </div>
      <p className="mt-8 text-xs text-ink-faint">생활 상담입니다 — 진단·처방·치료를 하지 않으며 병원명·주소·순위·평점을 싣지 않습니다.</p>
    </div>
  );
}
