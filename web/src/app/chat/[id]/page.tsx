// 상담 채팅 한 대화 — 상담 프로필에서 바로 연 대화(테스트 운영). 참여자(신청 회원·상담 프로필 주인)와 운영자만.
// 결제·예약이 필요한 요청은 /reservations/[id] 쪽 흐름을 그대로 쓴다.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChatPanel } from "@/components/reservation/chat-panel";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { getChatFor } from "@/lib/queries/conversations";
import { listMessages } from "@/lib/queries/reservations";
import { robotsMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "상담 채팅", robots: robotsMeta(false) };

export default async function ChatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ started?: string }> }) {
  const { id } = await params;
  const { started } = await searchParams;
  const cid = Number(id);
  if (!Number.isSafeInteger(cid)) notFound();
  const [admin, member] = await Promise.all([getSession(), getCurrentMember()]);
  if (!admin && !member) redirect(`/login?next=${encodeURIComponent(`/chat/${cid}`)}`);
  const chat = await getChatFor(cid, { userId: member?.id ?? null, admin: Boolean(admin) });
  if (!chat) notFound();
  if (chat.reservationId) redirect(`/reservations/${chat.reservationId}`);
  const msgs = await listMessages(cid);
  const other = chat.role === "provider" ? chat.requesterNickname : chat.providerNickname;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs text-ink-faint">
        <Link href="/me/chats" className="hover:underline">
          ← 내 상담 채팅
        </Link>
      </p>
      {started && (
        <p className="mt-3 rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">
          대화가 열렸어요. 답이 바로 오지 않을 수 있어요 — 상대가 확인하면 알림 대신 이 페이지에 메시지가 쌓입니다.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">바로 상담</span>
        <span>{formatDateTime(chat.conv.createdAt)} 시작</span>
        {chat.role === "provider" && <span className="rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">내 상담 프로필로 온 대화</span>}
      </div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">
        {chat.targetPath ? (
          <Link href={chat.targetPath} className="hover:underline">
            {chat.title}
          </Link>
        ) : (
          chat.title
        )}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {chat.role === "provider" ? `${other ?? "회원"} 님과의 대화` : "생활 상담 — 진단·처방·치료는 다루지 않습니다."}
      </p>

      <div className="mt-5">
        <ChatPanel conversationId={cid} initial={msgs} myRole={chat.role} placeholder="궁금한 것을 적어 주세요 (개인정보는 필요한 만큼만)" />
      </div>

      <div className="mt-5 space-y-2 text-xs leading-relaxed text-ink-faint">
        <p>
          아픈 곳이 있거나 상태가 갑자기 나빠졌다면 채팅보다 진료가 먼저입니다. 이 대화는 생활·돌봄 이야기를 나누는 자리예요.
        </p>
        <p>
          시간을 정해 상담하거나 유료 상담을 원하면 상담 프로필에서 <span className="font-medium text-ink-soft">시간 예약·연락받기</span>로 요청해 주세요. 결제 확인 뒤 예약 채팅이 따로 열립니다.
        </p>
      </div>
    </div>
  );
}
