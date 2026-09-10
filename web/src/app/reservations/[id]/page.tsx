// 예약·상담 한 건 — 신청 회원·제공자·관리자만. 상태 단계, 역할별 버튼, 결제 확인 뒤 채팅.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatPanel } from "@/components/reservation/chat-panel";
import { StatusActions, StatusChip } from "@/components/reservation/reservation-status";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { getConversationId, getReservationFor, listMessages } from "@/lib/queries/reservations";
import { RESERVATION_KIND_LABEL, RESERVATION_STATUSES, RESERVATION_STATUS_LABEL, chatOpen, slotLabel } from "@/lib/reservations";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "예약·상담", robots: robotsMeta(false) };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const rid = Number(id);
  if (!Number.isSafeInteger(rid)) notFound();
  const [admin, member] = await Promise.all([getSession(), getCurrentMember()]);
  if (!admin && !member) redirect(`/login?next=${encodeURIComponent(`/reservations/${rid}`)}`);
  const found = await getReservationFor(rid, { userId: member?.id ?? null, admin: Boolean(admin) });
  if (!found) notFound();
  const { r, role } = found;
  const convId = chatOpen(r.status) ? await getConversationId(rid) : null;
  const msgs = convId ? await listMessages(convId) : [];
  const steps = RESERVATION_STATUSES.filter((s) => s !== "cancelled");
  const stepIdx = steps.indexOf(r.status as (typeof steps)[number]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs text-ink-faint">
        <Link href={role === "admin" ? "/admin/reservations" : role === "provider" ? "/me/received" : "/me/requests"} className="hover:underline">
          ← {role === "admin" ? "예약·상담 관리" : role === "provider" ? "받은 요청" : "내 신청"}
        </Link>
      </p>
      {created && <p className="mt-3 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">요청을 보냈어요. 확인되면 결제 방법을 안내하고, 결제 확인 뒤 여기서 채팅이 열립니다.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">#{r.id}</span>
        <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{RESERVATION_KIND_LABEL[r.kind]}</span>
        <StatusChip status={r.status} />
        <span>{formatDateTime(r.createdAt)}</span>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">
        {found.targetPath ? (
          <Link href={found.targetPath} className="hover:underline">
            {r.targetName}
          </Link>
        ) : (
          r.targetName
        )}
      </h1>

      {/* 단계 */}
      {r.status !== "cancelled" && (
        <ol className="mt-4 flex flex-wrap gap-1 text-[11px]">
          {steps.map((s, i) => (
            <li key={s} className={`rounded-full px-2.5 py-1 font-medium ${i <= stepIdx ? "bg-ink text-cream" : "bg-sand text-ink-faint"}`}>
              {i + 1}. {RESERVATION_STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      )}

      <dl className="mt-5 grid gap-x-6 gap-y-1.5 rounded-xl border border-line bg-surface p-4 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">신청</dt>
          <dd className="text-ink">{found.requesterNickname ?? "(비회원)"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">담당</dt>
          <dd className="text-ink">{found.providerNickname ?? "운영자가 대신 응대"}</dd>
        </div>
        {r.slotStart && r.slotEnd && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">상담 시간</dt>
            <dd className="text-ink">{slotLabel({ start: r.slotStart, end: r.slotEnd })}</dd>
          </div>
        )}
        {r.preferredText && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">희망 일정</dt>
            <dd className="text-ink">{r.preferredText}</dd>
          </div>
        )}
        {r.topic && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">주제</dt>
            <dd className="text-ink">{r.topic}</dd>
          </div>
        )}
        {r.petNote && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">반려동물</dt>
            <dd className="text-ink">{r.petNote}</dd>
          </div>
        )}
        {r.message && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-ink-faint">내용</dt>
            <dd className="whitespace-pre-line text-ink">{r.message}</dd>
          </div>
        )}
        {role !== "requester" && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-ink-faint">연락처 (비공개)</dt>
            <dd className="text-ink">
              {r.requesterName} · {r.contact}
            </dd>
          </div>
        )}
        {r.paidAt && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">결제 확인</dt>
            <dd className="text-ink">
              {formatDateTime(r.paidAt)} ({r.paidBy === "admin" ? "운영자" : "담당자"})
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        <StatusActions id={r.id} status={r.status} role={role} />
        {role === "requester" && r.status === "new" && <p className="mt-2 text-xs text-ink-faint">담당자 또는 운영자가 확인하면 결제 방법을 안내합니다.</p>}
        {role === "requester" && r.status === "confirmed" && <p className="mt-2 text-xs text-ink-faint">안내받은 방법으로 결제하면 담당자가 확인하고 채팅을 엽니다.</p>}
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">채팅</h2>
        {convId ? (
          <div className="mt-3">
            <ChatPanel reservationId={r.id} initial={msgs} myRole={role} />
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line p-5 text-sm text-ink-faint">{r.status === "cancelled" ? "취소된 요청입니다." : "결제가 확인되면 채팅이 열립니다. 그 전에는 카카오톡 등 업체 채널을 이용하거나 확인을 기다려 주세요."}</p>
        )}
      </section>
    </div>
  );
}
