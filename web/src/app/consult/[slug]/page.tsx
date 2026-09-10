// 전문가 페이지 — 소개는 누구나, 신청은 회원만 (시간 예약 또는 연락받기).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MedicalNotice } from "@/components/notices";
import { ReservationForm } from "@/components/reservation/reservation-form";
import { assetUrl } from "@/lib/assets";
import { formatDate } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";
import { getCurrentMember } from "@/lib/member";
import { bookedSlotStarts, getExpertBySlug } from "@/lib/queries/experts";
import { CONSULT_MODE_LABEL, EXPERT_KIND_LABEL, MEDICAL_ADJACENT_KINDS, WEEKDAY_LABEL, minToHm, slotWindows, type ConsultMode } from "@/lib/reservations";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "온라인 상담", robots: robotsMeta(false) };

export default async function ExpertPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const [expert, member] = await Promise.all([getExpertBySlug(slug), getCurrentMember()]);
  if (!expert || expert.status !== "published") notFound();
  const now = new Date();
  const booked = await bookedSlotStarts(expert.id, now);
  const windows = slotWindows(expert.slots, booked, now);
  const intro = expert.introMd ? renderMarkdown(expert.introMd) : null;
  const medical = MEDICAL_ADJACENT_KINDS.includes(expert.kind);
  const path = `/consult/${encodeURIComponent(expert.slug)}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs crumbs={[{ name: "홈", path: "/" }, { name: "온라인 상담", path: "/consult" }, { name: expert.displayName, path }]} />
      <header className="mt-6 flex gap-4">
        {assetUrl(expert.heroImageKey) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(expert.heroImageKey)} alt="" className="h-24 w-24 shrink-0 rounded-2xl bg-sand object-cover" />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-sea-soft text-2xl font-bold text-sea">{expert.displayName.slice(0, 1)}</span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea">{EXPERT_KIND_LABEL[expert.kind]}</span>
            {medical && <span className="rounded-full bg-sand px-2.5 py-1 text-ink-soft">생활 상담 · 진단·처방 아님</span>}
            {expert.modes.map((m) => (
              <span key={m} className="rounded-full border border-line px-2.5 py-1 text-ink-soft">
                {CONSULT_MODE_LABEL[m as ConsultMode] ?? m}
              </span>
            ))}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{expert.displayName}</h1>
          {expert.credentialsText && (
            <p className="mt-1 text-sm text-ink-soft">
              {expert.credentialsText}
              {expert.credentialsVerifiedAt && <span className="text-ink-faint"> · 확인 {formatDate(expert.credentialsVerifiedAt)}</span>}
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-ink">{expert.priceText ?? "요금은 신청 후 안내"}</p>
        </div>
      </header>

      {expert.topics.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-1.5">
          {expert.topics.map((t) => (
            <span key={t} className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink-soft">
              {t}
            </span>
          ))}
        </p>
      )}
      {intro && <div className="guide-prose prose prose-neutral mt-6 max-w-none text-sm" dangerouslySetInnerHTML={{ __html: intro.html }} />}

      {expert.slots.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
          <h2 className="font-bold text-ink">상담 가능한 시간 (매주)</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {expert.slots.map((s, i) => (
              <li key={i} className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea">
                {WEEKDAY_LABEL[s.weekday]} {minToHm(s.startMin)}–{minToHm(s.endMin)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-faint">앞으로 2주 안의 빈 시간 {windows.length}개 · 서울 시간</p>
        </section>
      )}

      <div className="mt-6">
        <MedicalNotice />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">상담 신청</h2>
        {member ? (
          <ReservationForm target={{ expertId: expert.id, name: expert.displayName }} defaultName={member.displayName} nextPath={path} slots={windows.map((w) => ({ startMs: w.start.getTime(), endMs: w.end.getTime() }))} consult />
        ) : (
          <div className="mt-4 rounded-xl border border-line bg-sand/60 p-5 text-sm">
            <p className="font-semibold text-ink">상담 신청은 회원만 할 수 있어요</p>
            <p className="mt-1 text-ink-soft">로그인하면 상담 시간을 예약하거나 연락받기를 신청하고, 진행 상황과 채팅을 내 페이지에서 볼 수 있어요.</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream hover:opacity-90">
                로그인
              </Link>
              <Link href={`/signup?next=${encodeURIComponent(path)}`} className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold text-ink hover:bg-sand">
                가입하기
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
