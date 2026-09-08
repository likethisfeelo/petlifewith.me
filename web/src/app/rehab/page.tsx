import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MedicalNotice, RehabListNote } from "@/components/notices";
import { ModalityGrid, RehabSiteList, SidoJump } from "@/components/rehab-list";
import { contactEmail } from "@/lib/config";
import { formatNumber } from "@/lib/format";
import { countRehabSitesByModality, latestRehabVerifiedAt, listRehabSites } from "@/lib/queries/rehab";
import { buildMeta, shouldIndexRegionPage } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.spotDirectory

// 치료법이 주어다 (claude.md 6-2). 병원 디렉토리·순위·추천·평점·광고를 만들지 않는다.
export async function generateMetadata(): Promise<Metadata> {
  const sites = await listRehabSites();
  return buildMeta({
    title: "재활·한방·특수치료 — 어디서 받을 수 있나",
    description:
      "침치료(CVA)·한방재활·수중런닝머신·체외충격파·고압산소·도수치료를 시행한다고 공개된 동물병원을 치료법 기준, 지역별 가나다순으로 정리했습니다. 광고·순위·평점 없음.",
    path: "/rehab",
    indexable: shouldIndexRegionPage(sites.length),
    ads: false, // 무료 노출 전용 (claude.md 6-2)
  });
}

export default async function RehabHubPage() {
  const [sites, counts, latest] = await Promise.all([listRehabSites(), countRehabSitesByModality(), latestRehabVerifiedAt()]);
  const email = contactEmail();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs
        crumbs={[
          { name: "홈", path: "/" },
          { name: "스팟", path: "/spot" },
          { name: "재활·한방·특수치료", path: "/rehab" },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          재활·한방·특수치료 — <span className="text-sage-deep">어디서 받을 수 있나</span>
        </h1>
        <p className="mt-3 text-ink-soft">
          침치료·한방재활·수중런닝머신 같은 치료법은 어느 동물병원에나 있는 것이 아닙니다. 치료법을 기준으로,
          시행한다고 공개된 곳을 지역별 가나다순으로 모았습니다. 공공데이터에 없는 정보라 직접 확인해 채웁니다.
        </p>
        <RehabListNote />
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-extrabold text-ink">치료법으로 찾기</h2>
        <p className="mt-1 text-sm text-ink-soft">무엇이며 어떤 목적으로 쓰이는지까지만 적습니다. 효과는 진료에서 판단할 일입니다.</p>
        <div className="mt-4">
          <ModalityGrid counts={counts} />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink">
            시행처 <span className="text-sm font-medium text-ink-faint">{formatNumber(sites.length)}곳 · 지역별 가나다순</span>
          </h2>
        </div>
        <div className="mt-3">
          <SidoJump sites={sites} />
        </div>
        <div className="mt-5">
          <RehabSiteList sites={sites} />
        </div>
      </section>

      <div className="mt-10">
        <MedicalNotice />
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        출처: 직접 확인 자료 — CVA 공식 지도, 병원·대학·체인이 공개한 진료 안내, 상호 표기{latest ? ` · 기준일 ${latest}` : ""}.
        치료 시행 여부는 바뀔 수 있으니 방문 전 병원에 확인하세요.
        {email ? (
          <>
            {" "}
            잘못된 정보는{" "}
            <a className="underline hover:text-ink" href={`mailto:${email}`}>
              {email}
            </a>
            로 알려주세요.
          </>
        ) : null}
      </p>
    </div>
  );
}
