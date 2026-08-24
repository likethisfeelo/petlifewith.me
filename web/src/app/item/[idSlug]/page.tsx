import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/jsonld";
import { AffiliateDisclosure } from "@/components/notices";
import { ITEM_CATEGORY_LABEL, OFFER_VENDOR_LABEL, formatDate, idSlugPath, parseIdSlug } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { guidesMentioningItem } from "@/lib/queries/guides";
import { getItemDetail } from "@/lib/queries/items";
import { canonicalUrl, itemListLd, robotsMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.item

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ idSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  const detail = id ? await getItemDetail(id) : null;
  if (!detail) return { robots: robotsMeta(false) };
  const mentions = await guidesMentioningItem(detail.item.id);
  return {
    title: `${detail.item.name} — 언급된 글 ${mentions.length}개`,
    description: detail.item.summary ?? undefined,
    alternates: { canonical: canonicalUrl(idSlugPath("item", detail.item.id, detail.item.slug)) },
    // 역참조가 본질 — 언급한 발행 글이 없으면 얇은 페이지라 색인하지 않는다
    robots: robotsMeta(mentions.length > 0),
  };
}

export default async function ItemPage({ params }: Props) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (!id) notFound();
  const detail = await getItemDetail(id);
  if (!detail) notFound();

  const { item, maker, offers, hasAffiliateOffers } = detail;
  const mentions = await guidesMentioningItem(item.id);
  const description = item.descriptionMd ? renderMarkdown(item.descriptionMd) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "상품", path: idSlugPath("item", item.id, item.slug) },
          { name: item.name, path: idSlugPath("item", item.id, item.slug) },
        ]}
      />

      <header className="mt-6">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-deep">
          {ITEM_CATEGORY_LABEL[item.category] ?? item.category}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{item.name}</h1>
        {item.summary && <p className="mt-2 text-ink-soft">{item.summary}</p>}
        {maker && (
          <p className="mt-2 text-sm text-ink-soft">
            만든 곳:{" "}
            <Link href={idSlugPath("maker", maker.id, maker.slug)} className="font-medium text-honey hover:underline">
              {maker.name}
            </Link>
          </p>
        )}
      </header>

      {hasAffiliateOffers && (
        <div className="mt-6">
          <AffiliateDisclosure />
        </div>
      )}

      {offers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {offers.map((o) => (
            <a
              key={o.id}
              href={o.url}
              target="_blank"
              rel={o.isAffiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
              className="rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-sm font-medium text-accent-deep transition-colors hover:bg-accent hover:text-white"
            >
              {o.label ?? OFFER_VENDOR_LABEL[o.vendor] ?? "구매처"}에서 보기 ↗
            </a>
          ))}
        </div>
      )}

      {description && (
        <div className="guide-prose prose prose-neutral mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: description.html }} />
      )}

      {/* 역방향 페이지의 본질 — 태깅이 쌓이면 자동 생성 (claude.md 5-4) */}
      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-lg font-bold text-ink">
          이 상품이 언급된 글 <span className="text-accent-deep">{mentions.length}</span>개
        </h2>
        {mentions.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">아직 이 상품을 다룬 글이 없습니다.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {mentions.map(({ guide, contextLabel }) => (
              <li key={guide.id} className="rounded-xl border border-line bg-surface p-4">
                <Link href={`/guide/${guide.slug}`} className="font-bold text-ink hover:underline">
                  {guide.title}
                </Link>
                {contextLabel && <p className="mt-1 text-xs text-accent-deep">{contextLabel}</p>}
                {guide.summary && <p className="mt-1 text-sm text-ink-soft">{guide.summary}</p>}
                <p className="mt-1 text-xs text-ink-faint">{formatDate(guide.publishedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {mentions.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${item.name} 이(가) 언급된 글`,
            items: mentions.map(({ guide }) => ({ name: guide.title, path: `/guide/${guide.slug}` })),
          })}
        />
      )}
    </div>
  );
}
