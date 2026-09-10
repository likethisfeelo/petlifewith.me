import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/jsonld";
import { FactBadge } from "@/components/notices";
import { ITEM_CATEGORY_LABEL, MAKER_CATEGORY_LABEL, idSlugPath, parseIdSlug } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { guidesMentioningMaker } from "@/lib/queries/guides";
import { getMakerProfile } from "@/lib/queries/makers";
import { ContactRow } from "@/components/contact/contact-row";
import { ReactionButtons } from "@/components/reactions/reaction-buttons";
import { buildMeta, itemListLd, robotsMeta } from "@/lib/seo";
import { assetUrl } from "@/lib/assets";

export const revalidate = 21600; // REVALIDATE.maker

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ idSlug: string }>;
}

const LINK_KIND_LABEL: Record<string, string> = {
  website: "홈페이지",
  instagram: "인스타그램",
  smartstore: "스토어",
  funding: "펀딩",
  etc: "링크",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  const profile = id ? await getMakerProfile(id) : null;
  if (!profile || profile.maker.status !== "published") return { robots: robotsMeta(false) };
  const { maker } = profile;
  return buildMeta({
    title: maker.seoTitle ?? `${maker.name} — ${MAKER_CATEGORY_LABEL[maker.category] ?? maker.category} 메이커`,
    description: maker.seoDescription ?? maker.storyMd?.split("\n")[0],
    path: idSlugPath("maker", maker.id, maker.slug),
    // 스토리가 없으면 얇은 프로필 — 색인하지 않는다
    indexable: Boolean(maker.storyMd && maker.storyMd.trim().length > 0),
    ogImageUrl: assetUrl(maker.ogImageKey ?? maker.heroImageKey),
  });
}

export default async function MakerPage({ params }: Props) {
  const { idSlug } = await params;
  const id = parseIdSlug(idSlug);
  if (!id) notFound();
  const profile = await getMakerProfile(id);
  if (!profile || profile.maker.status !== "published") notFound();

  const { maker, regionLabel, links, items, feedLicense } = profile;
  const mentions = await guidesMentioningMaker(maker.id);
  const story = maker.storyMd ? renderMarkdown(maker.storyMd) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "메이커", path: "/maker" },
          { name: maker.name, path: idSlugPath("maker", maker.id, maker.slug) },
        ]}
      />

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-honey-soft px-2.5 py-1 font-medium text-honey">
            {MAKER_CATEGORY_LABEL[maker.category] ?? maker.category}
          </span>
          {/* 개인정보 원칙: 지역은 시군구까지만, 대표자 개인명·상세주소는 표시하지 않는다 (claude.md 5-6) */}
          {regionLabel && <span className="text-ink-soft">{regionLabel}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{maker.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {maker.badgeFeedRegistered && (
            <FactBadge
              label="사료제조업 등록 확인"
              verifiedAt={maker.badgeVerifiedAt ?? feedLicense?.referenceDate}
              note={maker.badgeNote}
            />
          )}
          {maker.badgeIngredientRegistered && (
            <FactBadge label="성분등록 확인" verifiedAt={maker.badgeVerifiedAt} note={maker.badgeNote} />
          )}
        </div>
        {(maker.badgeFeedRegistered || maker.badgeIngredientRegistered) && (
          <p className="mt-2 text-xs text-ink-faint">
            배지는 평가·인증이 아니라 공적 등록 데이터에 근거한 사실 확인 표기입니다.
          </p>
        )}
        {assetUrl(maker.heroImageKey) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(maker.heroImageKey)} alt={maker.name} className="mt-4 w-full rounded-2xl bg-sand" decoding="async" />
        )}
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ContactRow makerId={maker.id} links={links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? LINK_KIND_LABEL[l.kind] ?? l.kind }))} compact />
        <span className={links.length > 0 ? "ml-auto" : ""}>
          <ReactionButtons target="maker" id={maker.id} kinds={["save"]} nextPath={idSlugPath("maker", maker.id, maker.slug)} size="sm" />
        </span>
      </div>

      {story && (
        <div className="guide-prose prose prose-neutral mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: story.html }} />
      )}

      {items.length > 0 && (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-lg font-bold text-ink">만드는 것들</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((it) => (
              <Link
                key={it.id}
                href={idSlugPath("item", it.id, it.slug)}
                className="group rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-md"
              >
                <p className="text-xs text-ink-faint">{ITEM_CATEGORY_LABEL[it.category] ?? it.category}</p>
                <p className="mt-1 font-bold text-ink group-hover:underline">{it.name}</p>
                {it.summary && <p className="mt-1 text-sm text-ink-soft">{it.summary}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mentions.length > 0 && (
        <section className="mt-10 border-t border-line pt-8">
          <h2 className="text-lg font-bold text-ink">이 브랜드가 등장한 이야기</h2>
          <ul className="mt-4 space-y-3">
            {mentions.map((g) => (
              <li key={g.id} className="rounded-xl border border-line bg-surface p-4">
                <Link href={`/guide/${g.slug}`} className="font-bold text-ink hover:underline">
                  {g.title}
                </Link>
                {g.summary && <p className="mt-1 text-sm text-ink-soft">{g.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm">
        <h2 className="font-bold text-ink">이 브랜드를 운영하시나요?</h2>
        <p className="mt-1 text-ink-soft">프로필 정보 관리와 제휴·협업 문의를 무료로 요청할 수 있습니다.</p>
        <Link
          href={`/claim/maker/${maker.id}`}
          className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90"
        >
          정보 관리 요청 (무료)
        </Link>
      </section>

      {mentions.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${maker.name} 이(가) 언급된 글`,
            items: mentions.map((g) => ({ name: g.title, path: `/guide/${g.slug}` })),
          })}
        />
      )}
    </div>
  );
}
