// 업체·돌봄 파트너 카드의 행동 줄 — [카카오톡 상담(있으면 먼저)] [예약 요청] [자세히].
// 예약 요청은 로그인 회원이 서비스 안에서 보낸다(/book/spot/[id]) → 제공자·관리자 확인 → 결제 확인 → 채팅.
import Link from "next/link";

export function ReserveActions({ spotId, kakaoUrl, detailHref, compact = false }: { spotId: number; kakaoUrl: string | null; detailHref?: string; compact?: boolean }) {
  const pad = compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {kakaoUrl && (
        <a href={kakaoUrl} target="_blank" rel="noopener noreferrer nofollow" className={`rounded-full bg-[#fae100] font-semibold text-[#3c1e1e] hover:bg-[#f2d900] ${pad}`}>
          카카오톡 상담
        </a>
      )}
      <Link href={`/book/spot/${spotId}`} className={`rounded-full font-semibold text-white ${kakaoUrl ? "bg-ink hover:opacity-90" : "bg-accent hover:bg-accent-deep"} ${pad}`}>
        예약 요청
      </Link>
      {detailHref && (
        <Link href={detailHref} className="ml-auto text-xs font-medium text-sea hover:underline">
          자세히 →
        </Link>
      )}
    </div>
  );
}
