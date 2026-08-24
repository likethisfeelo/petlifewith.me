import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { listPublishedCurations } from "@/lib/queries/curations";
import { canonicalUrl, robotsMeta } from "@/lib/seo";
import { formatDate } from "@/lib/format";

export const revalidate = 86400; // REVALIDATE.curation

export function generateMetadata(): Metadata {
  return {
    title: "크리에이터 큐레이션",
    description:
      "잘 만든 영상과 게시물을 테마로 묶고, 우리 언어로 쓴 맥락을 더합니다. 모든 항목에 창작자와 원본 링크를 표기합니다.",
    alternates: { canonical: canonicalUrl("/curation") },
    robots: robotsMeta(true),
  };
}

export default async function CurationIndexPage() {
  const curations = await listPublishedCurations();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "큐레이션", path: "/curation" }]} />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-plum">크리에이터 큐레이션</h1>
        <p className="mt-3 text-ink-soft">
          흩어져 있는 좋은 콘텐츠를 <strong>테마 단위</strong>로 묶습니다. 공식 임베드와 링크만 사용하고, 창작자명과
          원본 링크를 해당 위치에 표기하며, 임베드를 빼도 읽을 가치가 있도록 우리 언어로 맥락을 씁니다.
        </p>
      </header>

      <section className="mt-8">
        {curations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            첫 큐레이션을 준비 중입니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {curations.map((c) => (
              <Link
                key={c.id}
                href={`/curation/${c.themeSlug}`}
                className="group rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
              >
                <span className="rounded-full bg-plum-soft px-2 py-0.5 text-xs font-medium text-plum">테마</span>
                <h2 className="mt-2 text-lg font-bold text-ink group-hover:underline">{c.title}</h2>
                <p className="mt-2 text-xs text-ink-faint">{formatDate(c.publishedAt)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
