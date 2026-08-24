import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { listSigunguSummaries } from "@/lib/queries/spots";
import { canonicalUrl, robotsMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ sido: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sido } = await params;
  const rows = await listSigunguSummaries(decodeURIComponent(sido));
  if (rows.length === 0) return { robots: robotsMeta(false) };
  const sidoName = rows[0]!.region.sidoName;
  const total = rows.reduce((a, r) => a + r.spotCount, 0);
  return {
    title: `${sidoName} 반려동물 스팟`,
    description: `${sidoName}의 스파·셀프목욕·수영장·놀이터·재활 시설 ${total}곳을 시군구별로 정리했습니다.`,
    alternates: { canonical: canonicalUrl(`/spot/${sido}`) },
    robots: robotsMeta(total > 0),
  };
}

export default async function SidoPage({ params }: Props) {
  const { sido } = await params;
  const rows = await listSigunguSummaries(decodeURIComponent(sido));
  if (rows.length === 0) notFound();
  const sidoName = rows[0]!.region.sidoName;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: sidoName, path: `/spot/${sido}` },
        ]}
      />

      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-sea">{sidoName}</h1>
      <p className="mt-2 text-ink-soft">시군구를 선택하세요. 숫자는 영업 중으로 확인된 스팟 수입니다.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(({ region, spotCount }) => (
          <Link
            key={region.id}
            href={`/spot/${region.sidoSlug}/${region.sigunguSlug}`}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-shadow hover:shadow-md ${
              spotCount > 0 ? "border-line bg-surface" : "border-dashed border-line bg-transparent"
            }`}
          >
            <span className={spotCount > 0 ? "font-semibold text-ink" : "text-ink-faint"}>{region.sigunguName}</span>
            <span className="text-sm text-ink-faint">{spotCount > 0 ? spotCount : "-"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
