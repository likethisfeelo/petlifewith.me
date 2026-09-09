// 펫모임 — 준비 중 안내. 회원이 고른 지역 3곳에서 모임에 참여하거나 직접 만드는 기능은 다음 작업으로 연다.
// 놀이 하단 배너의 "펫모임" 카드가 여기로 온다. 색인하지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { robotsMeta } from "@/lib/seo";

export const metadata: Metadata = {
  title: "펫모임 — 준비 중",
  robots: robotsMeta(false),
};

export default function MeetupComingSoonPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "놀이", path: "/topic/play" }, { name: "펫모임", path: "/meetup" }]} />
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">Coming Soon</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">펫모임 — 준비 중</h1>
      <p className="mt-3 text-ink-soft">
        내 지역 3곳을 골라 두면 그 지역의 모임에 참여하거나 직접 모임을 만들 수 있게 됩니다. 모임마다 작은 게시판이 생겨 약속과 후기를
        나눕니다. 지금은 열기 전이라 아래 놀이 페이지로 돌아가 주세요.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/topic/play" className="font-medium text-sea hover:underline">
          ← 놀이 페이지로
        </Link>
      </p>
    </div>
  );
}
