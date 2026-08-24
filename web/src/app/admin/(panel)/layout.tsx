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
  { href: "/admin/curations", label: "큐레이션" },
  { href: "/admin/claims", label: "클레임" },
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
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-ink-faint hover:text-ink">
            로그아웃
          </button>
        </form>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
