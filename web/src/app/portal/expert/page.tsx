import type { Metadata } from "next";
import Link from "next/link";
import { siteName } from "@/lib/config";
import { ExpertPartnerForm } from "./expert-partner-form";

export const metadata: Metadata = {
  title: "상담 전문가 등록 — 훈련사·수의사·수의 테크니션·멘토",
  robots: { index: false, follow: true },
};

export default function ExpertPortalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold text-sea">{siteName()} 전문가 페이지</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">노견 생활 상담 전문가 등록</h1>
      <p className="mt-4 text-ink-soft">
        훈련사·수의사·수의 테크니션·선배 보호자(멘토)가 온라인으로 노견 보호자의 일상 고민을 함께 봅니다. 신청자가 상담 시간을 예약하거나 연락받기를 신청하면, 확인·결제 확인 뒤 서비스 안 채팅으로 이어집니다.
        수의사·수의 테크니션 상담은 <strong className="text-ink">생활 상담</strong>으로 한정되며 진단·처방·치료를 하지 않습니다. 프로필에는 병원명·주소를 싣지 않고 순위·평점도 두지 않습니다.
      </p>
      <ExpertPartnerForm />
      <p className="mt-8 text-xs text-ink-faint">
        <Link href="/consult" className="underline">
          온라인 상담 허브로
        </Link>
      </p>
    </div>
  );
}
