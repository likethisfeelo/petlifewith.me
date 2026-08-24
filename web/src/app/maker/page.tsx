import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MakerCard } from "@/components/cards";
import { listPublishedMakers } from "@/lib/queries/makers";
import { canonicalUrl, robotsMeta } from "@/lib/seo";

export const revalidate = 21600; // REVALIDATE.maker

export function generateMetadata(): Metadata {
  return {
    title: "메이커 — 간식·장난감·용품을 직접 만드는 브랜드",
    description:
      "검색 상위에 안 잡히는 작은 브랜드일수록 가치가 큽니다. 직접 제조하는 곳만, 등록 확인 배지와 함께 소개합니다.",
    alternates: { canonical: canonicalUrl("/maker") },
    robots: robotsMeta(true),
  };
}

export default async function MakerIndexPage() {
  const makers = await listPublishedMakers(60);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "메이커", path: "/maker" }]} />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-honey">메이커 — 만드는 곳</h1>
        <p className="mt-3 text-ink-soft">
          단순 사입·리브랜딩은 다루지 않습니다. 제조 주체가 분명하고, 성분·소재를 공개하고, 만든 이유에 실체가
          있는 브랜드를 직접 발굴해 소개합니다. 간식 브랜드의 <strong>사료제조업 등록·성분등록 확인</strong>은
          공적 데이터에 근거한 사실 표기입니다.
        </p>
      </header>

      <section className="mt-8">
        {makers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            1차 발굴 목록을 준비 중입니다. 선정 기준을 통과한 브랜드부터 올라옵니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {makers.map(({ maker, regionLabel }) => (
              <MakerCard key={maker.id} maker={maker} regionLabel={regionLabel} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 rounded-2xl border border-line bg-sand/60 p-6 text-sm text-ink-soft">
        <h2 className="font-bold text-ink">브랜드를 만들고 계신가요?</h2>
        <p className="mt-1">
          메이커 디렉토리는 광고 지면이 아니라 제휴·협업의 입구입니다. 소개를 원하시면 브랜드 페이지의 정보
          관리 요청으로, 신규 등록 문의는 사이트 하단 연락처로 알려주세요.
        </p>
      </section>
    </div>
  );
}
