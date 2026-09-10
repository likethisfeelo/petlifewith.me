// 내 상담 채팅 — 바로 연 대화와 예약에 딸린 대화를 한 목록으로.
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listMyChats } from "@/lib/queries/conversations";
import { RESERVATION_STATUS_LABEL } from "@/lib/reservations";

const ROLE_LABEL: Record<string, string> = { requester: "내가 신청", provider: "내 프로필로 온 대화", admin: "운영자" };

export default async function MeChatsPage() {
  const member = (await getCurrentMember())!;
  const chats = await listMyChats(member.id);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-bold text-ink">상담 채팅 {chats.length > 0 ? `${chats.length}개` : ""}</h2>
        <p className="mt-1 text-xs text-ink-faint">
          상담 프로필에서 바로 연 대화는 결제 없이 이어집니다. 예약 요청에 딸린 대화는 결제 확인 뒤에 열려요.
        </p>
        {chats.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
            아직 대화가 없어요.{" "}
            <Link href="/consult" className="font-medium text-sea hover:underline">
              온라인 상담 보기 →
            </Link>
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {chats.map((c) => (
              <li key={c.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${c.kind === "direct" ? "bg-sea-soft text-sea" : "bg-sand text-ink-soft"}`}>
                    {c.kind === "direct" ? "바로 상담" : "예약 상담"}
                  </span>
                  <span>{ROLE_LABEL[c.role] ?? c.role}</span>
                  {c.reservationStatus && <span>{RESERVATION_STATUS_LABEL[c.reservationStatus]}</span>}
                  <span>{formatDateTime(c.lastAt)}</span>
                  <Link href={c.path} className="ml-auto font-medium text-sea hover:underline">
                    열기 →
                  </Link>
                </div>
                <p className="mt-1.5 font-bold text-ink">
                  {c.title}
                  {c.otherName && <span className="font-normal text-ink-soft"> · {c.otherName}</span>}
                </p>
                {c.lastBody && <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft">{c.lastBody}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
