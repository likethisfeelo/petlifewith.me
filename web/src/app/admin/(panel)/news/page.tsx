import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { GUIDE_STATUS_LABEL, formatDate } from "@/lib/format";
import { builtinTool, newsCategoryLabel } from "@/lib/tools";
import { AdminPageHeader } from "../../_components/fields";
import { insertStarterNewsAction } from "../../news-actions";
import { STARTER_NEWS } from "@/lib/tools/starter-news";
import { getNewsBanners, getPetsegwonStats } from "@/lib/queries/settings";
import { industryName, industryList } from "@/lib/petsegwon/stats";
import { PetsegwonStatsForm } from "./petsegwon-stats-form";
import { NewsBannersForm } from "./news-banners-form";

const { newsPosts } = schema;

export default async function AdminNewsPage({ searchParams }: { searchParams: Promise<{ starter?: string }> }) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { starter } = await searchParams;
  const rows = await getDb()
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      category: newsPosts.category,
      status: newsPosts.status,
      toolKey: newsPosts.toolKey,
      hasHtml: sql<boolean>`${newsPosts.toolHtml} is not null`, // 목록에선 HTML 본문을 읽지 않는다
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .orderBy(desc(newsPosts.updatedAt));
  const [banners, petStats] = await Promise.all([getNewsBanners(), getPetsegwonStats()]);
  const slugs = new Set(rows.map((r) => r.slug));
  const missingStarter = STARTER_NEWS.some((p) => !slugs.has(p.slug));

  return (
    <div>
      <AdminPageHeader
        title={`뉴스 ${rows.length}개`}
        description="관리자만 쓰는 블로그형 글입니다. 글에 도구(내장 도구 또는 HTML)를 붙일 수 있고, 도구 메뉴는 따로 두지 않습니다."
        right={
          <Link href="/admin/news/new" className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
            + 뉴스 쓰기
          </Link>
        }
      />

      {starter && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          처음 쓰는 글(CCTV 점검표·안내판 만들기·펫세권 분석) 중 없던 글을 작성 중 상태로 넣었습니다. 내용을 확인하고 발행하세요.
        </p>
      )}
      {missingStarter && (
        <form action={insertStarterNewsAction} className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          <span className="text-ink-soft">아직 없는 처음 쓰는 글({STARTER_NEWS.filter((p) => !slugs.has(p.slug)).map((p) => p.title.split(" — ")[0]).join(", ")})을 작성 중 상태로 넣을 수 있습니다.</span>
          <button type="submit" className="rounded-full border border-ink px-3 py-1.5 text-xs font-medium text-ink hover:bg-sand">
            처음 쓰는 글 넣기
          </button>
        </form>
      )}

      <NewsBannersForm banners={banners} />
      <PetsegwonStatsForm
        info={{
          source: petStats.meta.source,
          generatedAt: petStats.meta.generated_at,
          referenceDate: petStats.meta.baseline_reference_date,
          sigungu: petStats.sigungu.length,
          industries: industryList(petStats).map((k) => industryName(petStats, k)),
        }}
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-faint">
              <th className="px-4 py-2.5 font-medium">제목</th>
              <th className="px-4 py-2.5 font-medium">분류</th>
              <th className="px-4 py-2.5 font-medium">도구</th>
              <th className="px-4 py-2.5 font-medium">상태</th>
              <th className="px-4 py-2.5 font-medium">발행일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-faint">
                  아직 글이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-sand/50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/news/${r.id}`} className="font-medium text-ink hover:underline">
                    {r.title}
                  </Link>
                  {r.status === "published" && (
                    <Link href={`/news/${r.slug}`} className="ml-2 text-xs text-sea hover:underline">
                      보기 ↗
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{newsCategoryLabel(r.category)}</td>
                <td className="px-4 py-2.5 text-xs text-ink-soft">{r.toolKey ? (builtinTool(r.toolKey)?.label ?? r.toolKey) : r.hasHtml ? "HTML" : "—"}</td>
                <td className="px-4 py-2.5 text-ink-soft">{GUIDE_STATUS_LABEL[r.status]}</td>
                <td className="px-4 py-2.5 text-xs text-ink-faint">{formatDate(r.publishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
