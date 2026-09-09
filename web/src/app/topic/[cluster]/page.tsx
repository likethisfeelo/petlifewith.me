import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoriesForTopic } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { CareEntryBanner, PlayEntryBanner } from "@/components/care/care-entry-banner";
import { JsonLd } from "@/components/jsonld";
import { MedicalNotice } from "@/components/notices";
import { PlayFeed } from "@/components/play-feed";
import { SeniorBodyMap, type MapPost } from "@/components/senior-body-map";
import { MEMBER_BOARD_KIND, memberBoardName } from "@/lib/boards";
import { TOPIC_PHASE_LABEL } from "@/lib/format";
import { getTopicBySlug, listGuidesForTopic } from "@/lib/queries/guides";
import { buildMeta, itemListLd, robotsMeta } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

/** 토픽 상단 큐레이션 그리드에 띄우는 최신 글 수 — 넘치면 "전체 글보기"로 간다 */
const LATEST_ON_TOPIC = 9;
/** 놀이 첫 화면: 큐레이션 카드 수 / 일반 게시판 카드 수 */
const PLAY_CURATED = 3;
const PLAY_BOARD = 6;

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ cluster: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cluster } = await params;
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) return { robots: robotsMeta(false) };
  const { all } = await listGuidesForTopic(topic.id);
  return buildMeta({
    title: `${topic.name} — 토픽 허브`,
    description: topic.description,
    path: `/topic/${topic.slug}`,
    indexable: all.length > 0,
  });
}

export default async function TopicPage({ params }: Props) {
  const { cluster } = await params;
  const topic = await getTopicBySlug(decodeURIComponent(cluster));
  if (!topic) notFound();

  const { hub, curated, challenge, byCategory, all } = await listGuidesForTopic(topic.id);
  const style = topicStyle(topic.slug);
  const categories = categoriesForTopic(topic.slug);
  const categoryName = (slug: string | null) => categories.find((c) => c.slug === slug)?.name ?? null;
  // 정렬은 쿼리가 끝냈다 (lib/guide-order.ts): 큐레이션은 지정 순번 → 최신순.
  const isSenior = topic.slug === "senior-life";
  // 놀이: 위에 큐레이션 콘텐츠 3편, 그 아래 일반 게시판(회원 글) 6편 — 둘 다 영상 카드(섬네일 + 호버 미리보기).
  // 하단에는 같이 가는 곳·사람과 함께 배너. 큐레이션·일반 게시판 전체 페이지는 그대로 있다.
  const isPlay = topic.slug === "play";
  const postsByCategory: Record<string, MapPost[]> = {};
  for (const [slug, list] of byCategory) {
    postsByCategory[slug] = list.map((i) => ({ slug: i.guide.slug, title: i.guide.title, summary: i.guide.summary, authorName: i.authorName }));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: topic.name, path: `/topic/${topic.slug}` }]} />

      <header className="mt-6 max-w-3xl">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
          {TOPIC_PHASE_LABEL[topic.phase] ?? topic.phase}
        </span>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
          {isPlay ? "Long Live Petlifewithme · Play Feed" : "Long Live Petlifewithme · Curated Content"}
        </p>
        <h1 className={`mt-1 text-3xl font-extrabold tracking-tight ${style.heading}`}>{topic.name}</h1>
        <p className="mt-3 text-ink-soft">{topic.description}</p>
      </header>

      {isPlay && (
        <>
          {/* 큐레이션 콘텐츠 — 운영진이 발행하거나 골라 올린 글, 3편 */}
          <section className="mt-8" aria-labelledby="play-curated-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="play-curated-heading" className="text-xl font-extrabold tracking-tight text-ink">
                큐레이션 콘텐츠 <span className="text-sm font-medium text-ink-faint">운영진이 고른 글 · 마우스를 올리면 미리 보입니다</span>
              </h2>
              <Link href={`/topic/${topic.slug}/curated`} className="text-sm font-medium text-sea hover:underline">
                큐레이션 전체 보기 →
              </Link>
            </div>
            <div className="mt-4">
              {curated.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 글이 없습니다.</p>
              ) : (
                <PlayFeed posts={curated.slice(0, PLAY_CURATED)} />
              )}
            </div>
          </section>

          {/* 일반 게시판 — 회원이 올린 글, 6편 */}
          <section className="mt-10" aria-labelledby="play-board-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="play-board-heading" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xl font-extrabold tracking-tight text-ink">
                <span className="rounded-md bg-ink px-2 py-0.5 text-sm font-bold text-cream">{MEMBER_BOARD_KIND}</span>
                <span>{memberBoardName(topic.slug, topic.name)}</span>
                <span className="text-sm font-medium text-ink-faint">회원이 올린 영상·글 {challenge.length}편</span>
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Link href={`/write?topic=${encodeURIComponent(topic.slug)}`} className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-cream hover:opacity-90">
                  + 영상·글 올리기
                </Link>
                <Link href={`/topic/${topic.slug}/challenge`} className="font-medium text-sea hover:underline">
                  게시판 전체 보기 →
                </Link>
              </div>
            </div>
            <div className="mt-4">
              {challenge.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 회원 글이 없습니다. 첫 영상을 올려 주세요.</p>
              ) : (
                <PlayFeed posts={challenge.slice(0, PLAY_BOARD)} />
              )}
            </div>
          </section>
        </>
      )}

      {/* 큐레이션 콘텐츠 — 운영진이 발행하거나 골라 올린 글. 지정 순번 → 최신순, 넘치는 글은 전체 목록으로 (LATEST_ON_TOPIC) */}
      {!isPlay && (
      <section className="mt-8" aria-labelledby="curated-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p id="curated-heading" className="text-xs text-ink-faint">
            운영진이 고른 글 · 순서는 운영진이 정하고, 새 글이 위로 옵니다
          </p>
          <Link href={`/topic/${topic.slug}/curated`} className="text-sm font-medium text-sea hover:underline">
            큐레이션 전체 보기 →
          </Link>
        </div>
        {curated.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            아직 글이 없습니다. 발행 전 감수·검수 절차를 거칩니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {curated.slice(0, LATEST_ON_TOPIC).map((i) => (
              <GuideCard
                key={i.guide.id}
                guide={i.guide}
                showTopic={false}
                categoryName={categoryName(i.guide.category)}
                authorName={i.authorName}
                thumbnail
              />
            ))}
          </div>
        )}
      </section>
      )}

      {/* 신체 지도 — 노견생활 전용. 카테고리 정의는 data/src/guides/categories.ts */}
      {isSenior && categories.length > 0 && (
        <section className="mt-12">
          <h2 className={`text-2xl font-extrabold tracking-tight ${style.heading}`}>신체 영역별로 살펴보기</h2>
          <p className="mt-2 max-w-3xl text-ink-soft">
            몸의 변화는 영역별로 신호가 다릅니다. 강아지 그림에서 지금 눈에 밟히는 부위를 올려 보고, 눌러 관찰 포인트와 관련 글을 여세요.
          </p>
          <SeniorBodyMap areas={categories} postsByCategory={postsByCategory} topicSlug={topic.slug} />
        </section>
      )}

      {isSenior && categories.length > 0 && (
        <nav aria-label="부위별 게시판" className="mt-5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-ink-faint">부위별 게시판 (질문·댓글):</span>
          {categories.map((c) => (
            <Link key={c.slug} href={`/topic/${topic.slug}/${c.slug}`} className="rounded-full border border-line px-2.5 py-1 text-ink-soft hover:bg-sand hover:text-ink">
              {c.name}
              {byCategory.get(c.slug)?.length ? <span className="ml-1 text-ink-faint">{byCategory.get(c.slug)!.length}</span> : null}
            </Link>
          ))}
        </nav>
      )}

      {hub && (
        <Link
          href={`/guide/${hub.slug}`}
          className={`mt-8 block rounded-2xl border p-5 transition-shadow hover:shadow-md ${style.card}`}
        >
          <p className="text-xs font-semibold text-ink-soft">여기서 시작 — 클러스터 전체 지도</p>
          <h2 className="mt-1.5 text-lg font-extrabold text-ink">{hub.title}</h2>
          {hub.summary && <p className="mt-1.5 text-sm text-ink-soft">{hub.summary}</p>}
        </Link>
      )}


      {/* 페이지 하단 디렉토리 입구 — 노견생활: 돌봄 서비스 / 놀이: 같이 가는 곳·사람과 함께 (게시판 아님) */}
      {isSenior && (
        <div className="mt-12">
          <CareEntryBanner />
        </div>
      )}
      {isPlay && (
        <div className="mt-12">
          <PlayEntryBanner />
        </div>
      )}

      {isSenior && (
        <div className="mt-10">
          <MedicalNotice />
        </div>
      )}

      {all.length > 0 && (
        <JsonLd
          data={itemListLd({
            name: `${topic.name} 콘텐츠`,
            items: all.map((g) => ({ name: g.title, path: `/guide/${g.slug}` })),
          })}
        />
      )}
    </div>
  );
}
