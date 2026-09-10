// 회원 대시보드 셸 — 로그인 필수. 좌측(모바일은 상단) 탭 + 페이지.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/member";
import { listOwnedMakers, listOwnedSpots } from "@/lib/queries/owner";
import { countNewForMember } from "@/lib/queries/requests";
import { MeNav, type MeNavItem } from "./me-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 페이지",
  robots: { index: false, follow: false },
};

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  if (!member) redirect("/login?next=%2Fme");
  const [spots, makers, openRequests] = await Promise.all([listOwnedSpots(member.id), listOwnedMakers(member.id), countNewForMember(member.id)]);
  const businessCount = spots.length + makers.length;
  const items: MeNavItem[] = [
    { href: "/me", label: "개요" },
    { href: "/me/posts", label: "내 글" },
    { href: "/me/business", label: "내 업체·브랜드", badge: businessCount || undefined },
    { href: "/me/saved", label: "저장" },
    { href: "/me/requests", label: "신청·연락 내역", badge: openRequests || undefined },
    { href: "/me/meetups", label: "모임·내 지역" },
    { href: "/me/settings", label: "설정" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{member.displayName}</h1>
        <p className="text-xs text-ink-faint">{member.email}</p>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
        <MeNav items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
