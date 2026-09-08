import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REHAB_MODALITIES, getRehabModality } from "@app/data";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MedicalNotice, RehabListNote } from "@/components/notices";
import { RehabSiteList, SidoJump } from "@/components/rehab-list";
import { formatNumber } from "@/lib/format";
import { countRehabSitesByModality, latestRehabVerifiedAt, listRehabSites } from "@/lib/queries/rehab";
import { buildMeta, robotsMeta, shouldIndexRegionPage } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ modality: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modality } = await params;
  const def = getRehabModality(decodeURIComponent(modality));
  if (!def) return { robots: robotsMeta(false) };
  const sites = await listRehabSites(def.slug);
  return buildMeta({
    title: `${def.name} — 시행 동물병원 지역별 목록`,
    description: `${def.description} 시행한다고 공개된 곳을 지역별 가나다순으로 정리했습니다. 광고·순위·평점 없음.`,
    path: `/rehab/${def.slug}`,
    indexable: shouldIndexRegionPage(sites.length),
    ads: false,
  });
}

export default async function RehabModalityPage({ params }: Props) {
  const { modality } = await params;
  const def = getRehabModality(decodeURIComponent(modality));
  if (!def) notFound();

  const [sites, counts, latest] = await Promise.all([listRehabSites(def.slug), countRehabSitesByModality(), latestRehabVerifiedAt()]);
  const others = REHAB_MODALITIES.filter((m) => m.slug !== def.slug);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: "재활·한방·특수치료", path: "/rehab" },
          { name: def.name, path: `/rehab/${def.slug}` },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          <span className="text-sage-deep">{def.name}</span> — 어디서 받을 수 있나
        </h1>
        {/* 주어는 치료법. 원리·목적까지만 서술하고 효과를 단정하지 않는다 (claude.md 6-2) */}
        <p className="mt-3 text-ink-soft">{def.description}</p>
        <p className="mt-2 text-sm text-ink-faint">이 목록의 확인 기준: {def.basis}.</p>
        <RehabListNote />
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-ink">
          시행처 <span className="text-sm font-medium text-ink-faint">{formatNumber(sites.length)}곳 · 지역별 가나다순</span>
        </h2>
        <div className="mt-3">
          <SidoJump sites={sites} />
        </div>
        <div className="mt-5">
          <RehabSiteList sites={sites} current={def.slug} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold text-ink">다른 치료법</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {others.map((m) => (
            <Link
              key={m.slug}
              href={`/rehab/${m.slug}`}
              className="rounded-full bg-sage-soft px-3 py-1 text-sm font-medium text-sage-deep hover:bg-sage hover:text-white"
            >
              {m.short} <span className="opacity-70">{counts.get(m.slug) ?? 0}</span>
            </Link>
          ))}
          <Link href="/rehab" className="rounded-full border border-line px-3 py-1 text-sm text-ink-soft hover:bg-sand hover:text-ink">
            전체 보기
          </Link>
        </div>
      </section>

      <div className="mt-10">
        <MedicalNotice />
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        출처: 직접 확인 자료 — CVA 공식 지도, 병원·대학·체인이 공개한 진료 안내, 상호 표기{latest ? ` · 기준일 ${latest}` : ""}.
        치료 시행 여부는 바뀔 수 있으니 방문 전 병원에 확인하세요.
      </p>
    </div>
  );
}
