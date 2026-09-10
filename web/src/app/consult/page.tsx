// 노견 생활 상담 허브 — 훈련사·멘토를 지역별로(도그워커와 같은 지도 셸) + 온라인 전용. 순위·평점 없음, 순서는 운영자 정렬.
// 멘토는 회원 누구나 프로필을 만든다(/me/expert). 색인은 문구 검토 뒤 켠다.
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RegionMapShell } from "@/components/region-map-shell";
import { StartChatButton } from "@/components/reservation/start-chat-button";
import { assetUrl } from "@/lib/assets";
import { getCurrentMember } from "@/lib/member";
import { countPublishedExpertsByKind, countPublishedExpertsByRegion, listPublishedExperts, listPublishedExpertsInRegion, type ExpertCard } from "@/lib/queries/experts";
import { listRegionTiles } from "@/lib/queries/spots";
import { CONSULT_MODE_LABEL, EXPERT_KINDS, EXPERT_KIND_BLURB, EXPERT_KIND_LABEL, isExpertKind, type ConsultMode } from "@/lib/reservations";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "노견 생활 상담 — 훈련사·멘토를 지역별로",
  description: "노견과 사는 일상의 고민을 훈련사와 선배 보호자(멘토)에게 지역별 또는 온라인으로 상담합니다. 진단·처방이 아닌 생활 상담입니다.",
  robots: robotsMeta(false),
};

function ExpertItem({ e }: { e: ExpertCard }) {
  const path = `/consult/${encodeURIComponent(e.slug)}`;
  return (
    <li className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-sea/60">
      <div className="flex gap-3">
        <Link href={path} aria-label={e.displayName} className="shrink-0">
          {assetUrl(e.heroImageKey) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={assetUrl(e.heroImageKey)} alt="" className="h-14 w-14 rounded-xl bg-sand object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-sea-soft text-lg font-bold text-sea">{e.displayName.slice(0, 1)}</span>
          )}
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{EXPERT_KIND_LABEL[e.kind]}</span>
            {e.modes.map((m) => (
              <span key={m} className="text-ink-faint">
                {CONSULT_MODE_LABEL[m as ConsultMode] ?? m}
              </span>
            ))}
            {e.hasSlots && <span className="text-ink-faint">시간 예약</span>}
          </div>
          <Link href={path} className="mt-1 block text-base font-bold text-ink hover:underline">
            {e.displayName}
          </Link>
          {e.credentialsText && <span className="mt-0.5 block text-xs text-ink-soft">{e.credentialsText}</span>}
          <span className="mt-1 block text-xs text-ink-faint">{e.regionLabels.length > 0 ? e.regionLabels.join(" · ") : "온라인 전용"}</span>
          {e.topics.length > 0 && <span className="mt-1 block text-xs text-ink-faint">{e.topics.slice(0, 4).join(" · ")}</span>}
          <span className="mt-1 block text-xs font-medium text-ink">{e.priceText ?? "요금은 신청 후 안내"}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StartChatButton expertId={e.id} nextPath={path} label="바로 채팅" className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-deep" />
        <Link href={path} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-sand">
          시간 예약·자세히
        </Link>
      </div>
    </li>
  );
}

export default async function ConsultHubPage({ searchParams }: { searchParams: Promise<{ kind?: string; region?: string }> }) {
  const { kind: kindParam, region: regionParam } = await searchParams;
  const kind = isExpertKind(kindParam) ? kindParam : null;
  const regionId = Number(regionParam);
  const [regions, countsByRegion, countsByKind, member] = await Promise.all([listRegionTiles(), countPublishedExpertsByRegion(kind), countPublishedExpertsByKind(), getCurrentMember()]);
  const selected = Number.isSafeInteger(regionId) && regionId > 0 ? (regions.find((r) => r.id === regionId) ?? null) : null;
  const [inRegion, all] = await Promise.all([selected ? listPublishedExpertsInRegion(selected.id, kind) : Promise.resolve([]), selected ? Promise.resolve([]) : listPublishedExperts(kind)]);
  const local = all.filter((e) => e.regionLabels.length > 0);
  const online = all.filter((e) => e.regionLabels.length === 0);
  const prefix = kind ? `/consult?kind=${kind}&region=` : "/consult?region=";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "노견생활", path: "/topic/senior-life" }, { name: "상담", path: "/consult" }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">노견 생활 상담</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            나이 든 아이와 사는 일상의 고민을 훈련사와 선배 보호자(멘토)에게 묻습니다. 지도에서 구·시·군을 누르면 그 지역에서 활동하는 분들이 보이고, 온라인 전용은 아래에 따로 있어요.
            <span className="font-medium text-ink">바로 채팅</span>은 회원이면 결제 없이 지금 열 수 있고(시범 운영), 시간을 정한 상담이나 유료 상담은 예약 요청 → 결제 확인 → 예약 채팅 순서로 진행됩니다.
            진단·처방이 아닌 생활 상담이며, 순위·평점 없이 운영자가 확인한 순서로만 보입니다.
          </p>
        </div>
        <Link href={member ? "/me/expert" : "/login?next=%2Fme%2Fexpert"} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream hover:opacity-90">
          멘토로 참여하기
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5 text-xs">
        <Link href={selected ? `/consult?region=${selected.id}` : "/consult"} className={`rounded-full px-3 py-1.5 font-medium ${!kind ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
          전체
        </Link>
        {EXPERT_KINDS.map((k) => (
          <Link key={k} href={selected ? `/consult?kind=${k}&region=${selected.id}` : `/consult?kind=${k}`} className={`rounded-full px-3 py-1.5 font-medium ${kind === k ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`} title={EXPERT_KIND_BLURB[k]}>
            {EXPERT_KIND_LABEL[k]} {countsByKind[k] ? countsByKind[k] : ""}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <RegionMapShell regions={regions} countsByRegion={countsByRegion} selectedSido={selected?.sidoSlug ?? null} selectedRegionId={selected?.id ?? null} hrefPrefix={prefix} noun={kind ? EXPERT_KIND_LABEL[kind] : "상담 파트너"} unit="명">
          {selected ? (
            <section>
              <h2 className="text-lg font-bold text-ink">
                {selected.sidoName} {selected.sigunguName} <span className="text-sea">{kind ? EXPERT_KIND_LABEL[kind] : "훈련사·멘토"}</span>
              </h2>
              {inRegion.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                  이 지역에서 활동하는 분이 아직 없어요.{" "}
                  <Link href="/consult" className="font-medium text-sea hover:underline">
                    온라인 전용 보기 →
                  </Link>
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {inRegion.map((e) => (
                    <ExpertItem key={e.id} e={e} />
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs">
                <Link href={kind ? `/consult?kind=${kind}` : "/consult"} className="text-sea hover:underline">
                  ← 전체 보기
                </Link>
              </p>
            </section>
          ) : (
            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-bold text-ink">지역에서 활동 {local.length > 0 ? `${local.length}명` : ""}</h2>
                {local.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">아직 지역 활동 파트너가 없어요. 지도에서 구·시·군을 눌러 보세요.</p>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {local.slice(0, 12).map((e) => (
                      <ExpertItem key={e.id} e={e} />
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h2 className="text-lg font-bold text-ink">온라인 전용 {online.length > 0 ? `${online.length}명` : ""}</h2>
                {online.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                    아직 없어요.{" "}
                    <Link href={member ? "/me/expert" : "/login?next=%2Fme%2Fexpert"} className="font-medium text-sea hover:underline">
                      첫 멘토가 되어 보세요 →
                    </Link>
                  </p>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {online.map((e) => (
                      <ExpertItem key={e.id} e={e} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </RegionMapShell>
      </div>

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm">
        <h2 className="font-bold text-ink">상담 파트너로 함께하시겠어요?</h2>
        <p className="mt-1 text-ink-soft">{EXPERT_KINDS.map((k) => `${EXPERT_KIND_LABEL[k]} — ${EXPERT_KIND_BLURB[k]}`).join(" / ")}</p>
        <p className="mt-1 text-xs text-ink-faint">회원 가입 뒤 내 페이지의 &quot;상담 프로필&quot;에서 직접 만듭니다. 멘토는 바로 공개되고, 훈련사는 자격 확인 뒤 공개됩니다. 아픈 아이의 진료는 동물병원에서 — 여기서는 생활 이야기만 나눕니다.</p>
        <Link href={member ? "/me/expert" : "/signup?next=%2Fme%2Fexpert"} className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
          {member ? "내 상담 프로필 만들기" : "가입하고 프로필 만들기"}
        </Link>
      </section>
    </div>
  );
}
