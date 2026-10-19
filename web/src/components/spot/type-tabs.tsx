// 유형 탭 — 스팟 목록 위(크게)와 지도 위(칩)에 같은 줄을 둔다. 탭은 진짜 링크(시군구 x 유형 SEO 페이지)
import Link from "next/link";

export interface TypeTab {
  key: string;
  label: string;
  count: number;
  href: string;
  icon?: string;
  active: boolean;
}

export function TypeTabs({ tabs, variant = "bar" }: { tabs: TypeTab[]; variant?: "bar" | "map" }) {
  if (tabs.length <= 1) return null;
  if (variant === "map") {
    return (
      <nav aria-label="지도 유형" className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={t.active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold shadow-md ring-1 ring-black/5 ${t.active ? "bg-ink text-cream" : "bg-surface text-ink hover:bg-sand"}`}
          >
            {t.icon && <span aria-hidden className="mr-1">{t.icon}</span>}
            {t.label} <span className="font-medium opacity-60">{t.count.toLocaleString("ko-KR")}</span>
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="유형 고르기" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-sm font-bold transition-colors ${
            t.active ? "border-ink bg-ink text-cream" : "border-line bg-surface text-ink hover:border-sea hover:text-sea"
          }`}
        >
          {t.icon && <span aria-hidden className="text-base">{t.icon}</span>}
          {t.label}
          <span className={`rounded-full px-2 py-0.5 text-xs ${t.active ? "bg-cream/20" : "bg-sand text-ink-soft"}`}>{t.count.toLocaleString("ko-KR")}</span>
        </Link>
      ))}
    </nav>
  );
}
