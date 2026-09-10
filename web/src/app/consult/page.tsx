// 노견 생활 온라인 상담 허브 — 훈련사·수의사·수의 테크니션·멘토. 순위·평점 없음, 순서는 운영자 정렬.
// 수의사·수의 테크니션은 생활 상담으로 한정하는 고지를 붙인다. 초기에는 noindex (문구 감수 뒤 색인).
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MedicalNotice } from "@/components/notices";
import { assetUrl } from "@/lib/assets";
import { countPublishedExpertsByKind, listPublishedExperts } from "@/lib/queries/experts";
import { CONSULT_MODE_LABEL, EXPERT_KINDS, EXPERT_KIND_BLURB, EXPERT_KIND_LABEL, MEDICAL_ADJACENT_KINDS, isExpertKind, type ConsultMode } from "@/lib/reservations";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "노견 생활 온라인 상담 — 훈련사·수의사·수의 테크니션·멘토",
  description: "노견과 사는 일상의 고민을 훈련사·수의사·수의 테크니션·선배 보호자와 온라인으로 나눕니다. 생활 상담이며 진단·처방이 아닙니다.",
  robots: robotsMeta(false),
};

export default async function ConsultHubPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: kindParam } = await searchParams;
  const kind = isExpertKind(kindParam) ? kindParam : null;
  const [experts, counts] = await Promise.all([listPublishedExperts(kind), countPublishedExpertsByKind()]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "노견생활", path: "/topic/senior-life" }, { name: "온라인 상담", path: "/consult" }]} />
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink">노견 생활 온라인 상담</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
        나이 든 아이와 사는 일상의 고민을 훈련사·수의사·수의 테크니션·선배 보호자와 온라인으로 나눕니다. 상담 시간을 예약하거나 편한 시간대에 연락을 받을 수 있어요.
        신청은 회원만, 결제는 확인 뒤 안내하고, 결제가 확인되면 서비스 안 채팅이 열립니다.
      </p>
      <div className="mt-4">
        <MedicalNotice />
      </div>
      <p className="mt-2 rounded-lg border border-line bg-sand/60 px-4 py-2.5 text-xs leading-relaxed text-ink-soft">
        수의사·수의 테크니션 상담은 <strong className="text-ink">생활 상담</strong>입니다 — 돌봄 루틴·식이·집에서의 간호처럼 일상을 돕는 이야기이며, 진단·처방·치료가 아닙니다. 아픈 아이는 동물병원에서 진료받으세요. 응급 상황은 바로 병원으로.
        전문가는 순위·평점 없이 운영자가 확인한 순서로만 보입니다.
      </p>

      <div className="mt-6 flex flex-wrap gap-1.5 text-xs">
        <Link href="/consult" className={`rounded-full px-3 py-1.5 font-medium ${!kind ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
          전체
        </Link>
        {EXPERT_KINDS.map((k) => (
          <Link key={k} href={`/consult?kind=${k}`} className={`rounded-full px-3 py-1.5 font-medium ${kind === k ? "bg-ink text-cream" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {EXPERT_KIND_LABEL[k]} {counts[k] ? counts[k] : ""}
          </Link>
        ))}
      </div>

      {experts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          <p>아직 등록된 전문가가 없어요. 곧 채워집니다.</p>
          <p className="mt-2">
            훈련사·수의사·수의 테크니션·멘토로 활동하시나요?{" "}
            <Link href="/portal/expert" className="font-medium text-sea hover:underline">
              전문가 등록 요청 →
            </Link>
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {experts.map((e) => (
            <li key={e.id}>
              <Link href={`/consult/${encodeURIComponent(e.slug)}`} className="flex h-full gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-sea/60">
                {assetUrl(e.heroImageKey) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(e.heroImageKey)} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-sand object-cover" />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-sea-soft text-lg font-bold text-sea">{e.displayName.slice(0, 1)}</span>
                )}
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{EXPERT_KIND_LABEL[e.kind]}</span>
                    {MEDICAL_ADJACENT_KINDS.includes(e.kind) && <span className="rounded-full bg-sand px-2 py-0.5 text-ink-soft">생활 상담</span>}
                    {e.modes.map((m) => (
                      <span key={m} className="text-ink-faint">
                        {CONSULT_MODE_LABEL[m as ConsultMode] ?? m}
                      </span>
                    ))}
                  </span>
                  <span className="mt-1 block text-base font-bold text-ink">{e.displayName}</span>
                  {e.credentialsText && <span className="mt-0.5 block text-xs text-ink-soft">{e.credentialsText}</span>}
                  {e.topics.length > 0 && <span className="mt-1 block text-xs text-ink-faint">{e.topics.slice(0, 4).join(" · ")}</span>}
                  <span className="mt-1 block text-xs font-medium text-ink">{e.priceText ?? "요금은 신청 후 안내"}{e.hasSlots ? " · 시간 예약 가능" : ""}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10 rounded-2xl border border-line bg-sand/60 p-5 text-sm">
        <h2 className="font-bold text-ink">전문가로 함께하시겠어요?</h2>
        <p className="mt-1 text-ink-soft">{EXPERT_KINDS.map((k) => `${EXPERT_KIND_LABEL[k]} — ${EXPERT_KIND_BLURB[k]}`).join(" / ")}</p>
        <Link href="/portal/expert" className="mt-3 inline-block rounded-full bg-ink px-4 py-2 text-xs font-medium text-cream hover:opacity-90">
          전문가 등록 요청
        </Link>
      </section>
    </div>
  );
}
