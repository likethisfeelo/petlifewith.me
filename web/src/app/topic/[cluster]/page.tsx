import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GuideCard } from "@/components/cards";
import { JsonLd } from "@/components/jsonld";
import { TOPIC_PHASE_LABEL } from "@/lib/format";
import { getTopicBySlug, listGuidesForTopic } from "@/lib/queries/guides";
import { buildMeta, itemListLd, robotsMeta } from "@/lib/seo";
import { topicStyle } from "@/lib/topic-style";

export const revalidate = 3600; // REVALIDATE.topic

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ cluster: string }>;
}

const SPOKE_GROUP_LABEL: Record<string, string> = {
  body: "신체 영역별로 살펴보기",
  support: "일상을 받쳐주는 서비스",
  "": "이야기",
};

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

  const { hub, spokesByGroup, all } = await listGuidesForTopic(topic.id);
  const style = topicStyle(topic.slug);
  const groups = [...spokesByGroup.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: topic.name, path: `/topic/${topic.slug}` }]} />

      <header className="mt-6 max-w-3xl">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
          {TOPIC_PHASE_LABEL[topic.phase] ?? topic.phase}
        </span>
        <h1 className={`mt-3 text-3xl font-extrabold tracking-tight ${style.heading}`}>{topic.name}</h1>
        {topic.description && <p className="mt-3 text-ink-soft">{topic.description}</p>}
      </header>

      {hub && (
        <Link
          href={`/guide/${hub.slug}`}
          className={`mt-8 block rounded-2xl border p-6 transition-shadow hover:shadow-md ${style.card}`}
        >
          <p className="text-xs font-semibold text-ink-soft">여기서 시작 — 클러스터 전체 지도</p>
          <h2 className="mt-2 text-xl font-extrabold text-ink">{hub.title}</h2>
          {hub.summary && <p className="mt-2 text-sm text-ink-soft">{hub.summary}</p>}
        </Link>
      )}

      {groups.map(([group, guides]) => (
        <section key={group || "etc"} className="mt-10">
          <h2 className="text-lg font-bold text-ink">{SPOKE_GROUP_LABEL[group] ?? group}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <GuideCard key={g.id} guide={g} showTopic={false} />
            ))}
          </div>
        </section>
      ))}

      {all.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          이 클러스터의 콘텐츠는 준비 중입니다. 발행 전 감수·검수 절차를 거칩니다.
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
