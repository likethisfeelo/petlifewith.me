// "바로 채팅으로 상담" 버튼 — 상담 프로필과 대화를 즉시 연다 (회원 전용, 결제 없이).
// 비회원이 누르면 서버 액션이 로그인으로 보낸다. 시간 예약·유료 상담은 예약 요청 흐름을 그대로 쓴다.
import { startConsultChatAction } from "@/app/chat-actions";

export function StartChatButton({
  expertId,
  nextPath,
  label = "바로 채팅으로 상담",
  className = "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep",
}: {
  expertId: number;
  nextPath: string;
  label?: string;
  className?: string;
}) {
  return (
    <form action={startConsultChatAction} className="inline">
      <input type="hidden" name="expertId" value={expertId} />
      <input type="hidden" name="nextPath" value={nextPath} />
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
