import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "../actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/guides", label: "게시글" },
  { href: "/admin/spots", label: "스팟" },
  { href: "/admin/makers", label: "메이커" },
  { href: "/admin/items", label: "상품" },
  { href: "/admin/devices", label: "기기" },
  { href: "/admin/rehab", label: "재활·한방" },
  { href: "/admin/care", label: "돌봄 파트너" },
  { href: "/admin/requests", label: "요청함" },
  { href: "/admin/reservations", label: "예약·상담" },
  { href: "/admin/experts", label: "전문가" },
  { href: "/admin/meetups", label: "펫모임" },
  { href: "/admin/curations", label: "큐레이션" },
  { href: "/admin/media", label: "미디어" },
  { href: "/admin/members", label: "회원" },
  { href: "/admin/comments", label: "댓글" },
  { href: "/admin/settings", label: "설정" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
        <nav className="flex items-center gap-1 text-sm font-medium">
          <span className="mr-2 rounded bg-ink px-2 py-0.5 text-xs font-bold text-cream">ADMIN</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-sand hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint" title="ADMIN_TOKEN 의 계정 라벨">
            {session.sub}
          </span>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-ink-faint hover:text-ink">
              로그아웃
            </button>
          </form>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
