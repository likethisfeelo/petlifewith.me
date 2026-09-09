import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { getGuideEntityTags } from "@/lib/queries/guides";
import { GuideEditor } from "./guide-editor";
import { TagManager, type ExistingTag, type TagOption } from "./tag-manager";

const { guides, topics, users, items, spots, spotTypes, makers, regions } = schema;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default async function AdminGuideEditPage({ params, searchParams }: Props) {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const { id } = await params;
  const { created } = await searchParams;
  const guideId = Number(id);
  if (!Number.isSafeInteger(guideId)) notFound();

  const db = getDb();
  const found = (
    await db
      .select({ guide: guides, topicSlug: topics.slug, authorName: users.displayName })
      .from(guides)
      .innerJoin(topics, eq(guides.topicId, topics.id))
      .leftJoin(users, eq(guides.authorUserId, users.id))
      .where(eq(guides.id, guideId))
      .limit(1)
  )[0];
  if (!found) notFound();
  const { guide, topicSlug } = found;
  const authorName = guide.authorUserId ? (found.authorName ?? "회원") : null;

  const [tags, itemRows, spotRows, makerRows, typeRows] = await Promise.all([
    getGuideEntityTags(guideId),
    db.select({ id: items.id, name: items.name }).from(items).orderBy(items.name),
    db
      .select({ id: spots.id, name: spots.name, sigunguName: regions.sigunguName })
      .from(spots)
      .innerJoin(regions, eq(spots.regionId, regions.id))
      .orderBy(spots.name)
      .limit(500),
    db.select({ id: makers.id, name: makers.name }).from(makers).orderBy(makers.name),
    db.select({ slug: spotTypes.slug, name: spotTypes.name }).from(spotTypes).where(eq(spotTypes.listed, true)).orderBy(spotTypes.sortOrder),
  ]);

  const existing: ExistingTag[] = [
    ...tags.items.map((t) => ({ kind: "item" as const, refId: t.item.id, label: t.item.name, contextLabel: t.contextLabel })),
    ...tags.spots.map((t) => ({ kind: "spot" as const, refId: t.spot.id, label: t.spot.name, contextLabel: t.contextLabel })),
    ...tags.makers.map((t) => ({ kind: "maker" as const, refId: t.maker.id, label: t.maker.name, contextLabel: t.contextLabel })),
  ];

  const options: Record<"item" | "spot" | "maker", TagOption[]> = {
    item: itemRows.map((r) => ({ id: r.id, label: r.name })),
    spot: spotRows.map((r) => ({ id: r.id, label: `${r.name} (${r.sigunguName})` })),
    maker: makerRows.map((r) => ({ id: r.id, label: r.name })),
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">가이드 편집</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-xs text-ink-faint">/guide/{guide.slug}</span>
          {guide.status === "published" && (
            <Link href={`/guide/${guide.slug}`} className="font-medium text-sea hover:underline">
              공개 페이지 보기 →
            </Link>
          )}
        </div>
      </div>

      {created && (
        <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">
          게시글이 만들어졌습니다. 오른쪽에서 상품·스팟·메이커를 태깅하면 글 하단에 개체 카드가 붙습니다.
        </p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-xl border border-line bg-surface p-4">
          <GuideEditor
            topicSlug={topicSlug}
            authorName={authorName}
            spotTypes={typeRows}
            guide={{
              id: guide.id,
              title: guide.title,
              summary: guide.summary,
              bodyMd: guide.bodyMd,
              role: guide.role,
              spokeGroup: guide.spokeGroup,
              category: guide.category,
              curated: guide.curated,
              curatedOrder: guide.curatedOrder,
              areaOrder: guide.areaOrder,
              bannerSpotTypes: guide.bannerSpotTypes,
              status: guide.status,
              medicalAdjacent: guide.medicalAdjacent,
              vetReviewed: guide.vetReviewed,
              vetReviewerName: guide.vetReviewerName,
              vetReviewedAt: guide.vetReviewedAt,
              heroImageKey: guide.heroImageKey,
              seoTitle: guide.seoTitle,
              seoDescription: guide.seoDescription,
              ogImageKey: guide.ogImageKey,
            }}
          />
        </div>
        <div className="space-y-4">
          <TagManager guideId={guide.id} existing={existing} options={options} />
          <div className="rounded-xl border border-line bg-sand/60 p-4 text-xs leading-relaxed text-ink-soft">
            <p className="font-bold text-ink">발행 규칙 요약</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>의료 인접 편은 감수 완료 전 발행 불가 (DB 게이트)</li>
              <li>임베드는 공식 임베드 숏코드만 — 창작자·원본 링크 누락 시 렌더되지 않음</li>
              <li>이미지 재호스팅 금지 — 히어로 이미지는 직접 촬영분만 업로드</li>
              <li>효과 단정 표현 금지: "~에 효과적" 대신 "~ 목적으로 사용된다"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
