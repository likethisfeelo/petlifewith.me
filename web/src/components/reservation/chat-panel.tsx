"use client";

// 상담 채팅 — 대화(conversation) 기준. 예약 대화는 결제 확인 뒤, 상담 프로필에서 바로 연 대화는 즉시 열린다.
// 서버리스라 웹소켓 대신 5초 폴링(서버 액션 RPC). 참여자: 신청 회원·제공자·관리자.
import { useActionState, useEffect, useRef, useState } from "react";
import { fetchChatMessagesAction, sendChatMessageAction, type ChatState } from "@/app/chat-actions";
import type { MessageRow } from "@/lib/queries/reservations";
import { RESERVATION_LIMITS } from "@/lib/reservations";

const ROLE_LABEL: Record<string, string> = { requester: "신청", provider: "제공자", admin: "운영자", system: "안내" };

/** 서버·브라우저가 같은 문자열을 내도록 로케일 없이 서울 시간으로 "9/10 06:27" */
function stamp(d: Date | string): string {
  const k = new Date(new Date(d).getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({ conversationId, initial, myRole, placeholder }: { conversationId: number; initial: MessageRow[]; myRole: string; placeholder?: string }) {
  const [rows, setRows] = useState<MessageRow[]>(initial);
  const [state, formAction, pending] = useActionState<ChatState, FormData>(sendChatMessageAction, {});
  const lastId = rows.length > 0 ? rows[rows.length - 1]!.id : 0;
  const lastRef = useRef(lastId);
  lastRef.current = lastId;
  const bottomRef = useRef<HTMLDivElement>(null);

  const pull = async () => {
    try {
      const more = await fetchChatMessagesAction(conversationId, lastRef.current);
      if (more.length > 0) setRows((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
    } catch {
      /* 다음 폴링에서 다시 */
    }
  };

  useEffect(() => {
    const t = setInterval(pull, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // 보낸 뒤 바로 당겨온다
  useEffect(() => {
    if (!pending) void pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [rows.length]);

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="max-h-[28rem] space-y-2 overflow-y-auto p-4" aria-live="polite">
        {rows.length === 0 && <p className="text-sm text-ink-faint">아직 메시지가 없어요. 첫 인사를 남겨 보세요.</p>}
        {rows.map((m) => {
          const mine = m.senderRole === myRole && m.senderRole !== "system";
          if (m.senderRole === "system") return <p key={m.id} className="text-center text-[11px] text-ink-faint">{m.body}</p>;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-ink text-cream" : "bg-sand text-ink"}`}>
                <p className={`text-[10px] ${mine ? "text-cream/70" : "text-ink-faint"}`}>
                  {m.senderName ?? ROLE_LABEL[m.senderRole] ?? m.senderRole} · {stamp(m.createdAt)}
                </p>
                <p className="whitespace-pre-line">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form
        action={formAction}
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          const ta = e.currentTarget.querySelector("textarea");
          if (ta) setTimeout(() => (ta.value = ""), 0);
        }}
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea name="body" rows={2} required maxLength={RESERVATION_LIMITS.messageMax} placeholder={placeholder ?? "메시지 (전화번호·주소 같은 개인정보는 필요한 만큼만)"} className="w-full rounded-lg border border-line bg-cream/60 px-3 py-2 text-sm outline-none focus:border-ink" />
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream disabled:opacity-50">
          보내기
        </button>
      </form>
      {state.error && <p className="px-4 pb-3 text-xs font-medium text-accent-deep">{state.error}</p>}
    </div>
  );
}
