// 글 상단 카테고리 배너 — 관리자가 지정한 카테고리(guides.banner_categories)를 3열 배너로.
// 클릭하면 그 카테고리 게시판(/topic/[토픽]/[카테고리])으로 간다.
import Link from "next/link";
import type { GuideCategoryDef } from "@app/data";

function Icon({ slug }: { slug: string }) {
  const common = { className: "h-6 w-6", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "daycare": // 집·지붕
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "sitter": // 사람 + 하트
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5S14.5 16.7 14.5 20" />
          <path d="M17.5 13.5c-1.3-1.6-3.5-.4-3.2 1.3.2 1.2 1.6 2.3 3.2 3.6 1.6-1.3 3-2.4 3.2-3.6.3-1.7-1.9-2.9-3.2-1.3Z" />
        </svg>
      );
    case "walk": // 발자국 + 길
      return (
        <svg {...common}>
          <path d="M3 20c4-3 6-8 11-9" />
          <circle cx="16.5" cy="6.5" r="1.4" />
          <circle cx="19.5" cy="8.5" r="1.2" />
          <circle cx="14" cy="9" r="1.2" />
          <path d="M16.2 10.8c-1.7 0-2.7 1.4-2.2 2.6.5 1.1 3.9 1.1 4.4 0 .5-1.2-.5-2.6-2.2-2.6Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
  }
}

export function CategoryBanners({
  topicSlug,
  categories,
  counts,
}: {
  topicSlug: string;
  categories: GuideCategoryDef[];
  /** 카테고리별 발행 글 수 (있으면 표시) */
  counts?: Map<string, number>;
}) {
  if (categories.length === 0) return null;
  return (
    <nav aria-label="관련 카테고리" className="mt-6 grid gap-3 sm:grid-cols-3">
      {categories.map((c) => {
        const n = counts?.get(c.slug) ?? 0;
        return (
          <Link
            key={c.slug}
            href={`/topic/${topicSlug}/${c.slug}`}
            className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:border-accent/50 hover:shadow-md"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
              <Icon slug={c.slug} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink group-hover:underline">
                {c.name}
                {n > 0 && <span className="ml-1.5 text-xs font-medium text-ink-faint">{n}편</span>}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-soft">{c.blurb}</span>
              <span className="mt-1 block text-[11px] font-medium text-accent-deep">글 보기 · 쓰기 →</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
