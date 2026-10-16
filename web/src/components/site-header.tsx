import Link from "next/link";
import { siteName, siteTagline } from "@/lib/config";
import { TOPIC_TAGLINES } from "@/lib/tagline";
import { MemberMenu } from "./member-menu";
import { SiteTagline } from "./site-tagline";

const NAV = [
  { href: "/topic/senior-life", label: "노견생활" },
  { href: "/topic/play", label: "놀이" },
  { href: "/consult", label: "온라인 상담" },
  { href: "/spot", label: "스팟" },
  { href: "/maker", label: "메이커" },
  { href: "/curation", label: "큐레이션" },
  { href: "/news", label: "뉴스" },
];

/** 토픽별 태그라인 — env 로 덮어쓴 경우 모두 같은 문구가 된다 */
export function taglinesByTopic(): Record<string, string> {
  return Object.fromEntries(Object.keys(TOPIC_TAGLINES).map((slug) => [slug, siteTagline(slug)]));
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-extrabold tracking-tight text-ink">
          {siteName()}
          <SiteTagline fallback={siteTagline()} byTopic={taglinesByTopic()} className="ml-2 hidden text-xs font-medium text-ink-faint xl:inline" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <nav className="-mx-1 flex items-center gap-1 overflow-x-auto text-sm font-medium text-ink-soft">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors hover:bg-sand hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-1 shrink-0 border-l border-line pl-2">
            <MemberMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
