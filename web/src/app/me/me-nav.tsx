"use client";

// 회원 대시보드 탭 — 데스크톱은 세로 목록, 모바일은 가로 스크롤 칩.
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface MeNavItem {
  href: string;
  label: string;
  badge?: number;
}

export function MeNav({ items }: { items: MeNavItem[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/me" ? pathname === "/me" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="내 페이지" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 whitespace-nowrap lg:flex-col lg:gap-0.5">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={active(it.href) ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors lg:rounded-xl ${
                active(it.href) ? "bg-ink text-cream" : "text-ink-soft hover:bg-sand hover:text-ink"
              }`}
            >
              {it.label}
              {it.badge ? <span className={`rounded-full px-1.5 text-[10px] font-bold ${active(it.href) ? "bg-cream/20 text-cream" : "bg-accent-soft text-accent-deep"}`}>{it.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
