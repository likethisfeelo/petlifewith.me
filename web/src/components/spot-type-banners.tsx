// 글 상단 디렉토리 배너 — 관리자가 지정한 스팟 유형(guides.banner_spot_types)을 3열 배너로.
// 클릭하면 그 유형의 디렉토리(/spot/type/[slug])로 간다: 업체를 찾고, 사장님은 등록을 요청하는 입구.
// 커뮤니티 게시판이 아니다 — 아무나 글을 쓰는 곳이 아니라 업체 정보가 쌓이는 곳.
import Link from "next/link";
import type { SpotTypeRow } from "@/lib/queries/spots";

/** 유형별 한 줄 안내 (spot_types.description 은 ETL 메모라 사용자용 문구를 따로 둔다) */
const BLURB: Record<string, string> = {
  boarding: "낮 시간을 맡기는 유치원·데이케어·호텔. 지역별로 찾고 견학 전 확인할 것을 봅니다.",
  "pet-sitter": "보호자 집으로 와서 돌보는 방문 돌봄. 지역별 업체·개인 사업자 정보.",
  "hourly-sitter": "몇 시간 자리를 비울 때, 시터 집에 아이를 맡기는 시간 단위 돌봄.",
  "dog-walk": "산책 대행·동행 서비스. 노견에게 맞는 산책 조건을 확인하고 지역에서 찾습니다.",
  "visiting-bath": "이동이 부담스러운 아이를 위한 방문·출장 목욕.",
  "visiting-groom": "집으로 오는 미용. 노령견 전문 여부를 확인합니다.",
  rehab: "재활·특수 훈련 장비를 갖춘 곳 — 수중 러닝머신·밸런스 기구. 장비를 등록한 곳만 소개합니다.",
  grooming: "미용·스파 시설.",
  "self-wash": "직접 씻기는 셀프목욕 시설.",
};

/** 유형·용도별 선 아이콘 — 글 상단 배너와 토픽 하단 돌봄 배너가 같이 쓴다 */
export function SpotTypeIcon({ slug, className = "h-6 w-6" }: { slug: string; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "boarding": // 집·지붕 (유치원)
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "daycare": // 해 (낮 시간)
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </svg>
      );
    case "pet-sitter": // 사람 + 하트
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5S14.5 16.7 14.5 20" />
          <path d="M17.5 13.5c-1.3-1.6-3.5-.4-3.2 1.3.2 1.2 1.6 2.3 3.2 3.6 1.6-1.3 3-2.4 3.2-3.6.3-1.7-1.9-2.9-3.2-1.3Z" />
        </svg>
      );
    case "hourly-sitter": // 집 + 시계 (시터 집에 맡기는 시간 단위 돌봄)
      return (
        <svg {...common}>
          <path d="M3 12 9 7l6 5" />
          <path d="M5 11v8h8v-8" />
          <circle cx="17.5" cy="16.5" r="4" />
          <path d="M17.5 14.5v2l1.4 1" />
        </svg>
      );
    case "dog-walk": // 발자국 + 길
      return (
        <svg {...common}>
          <path d="M3 20c4-3 6-8 11-9" />
          <circle cx="16.5" cy="6.5" r="1.4" />
          <circle cx="19.5" cy="8.5" r="1.2" />
          <circle cx="14" cy="9" r="1.2" />
          <path d="M16.2 10.8c-1.7 0-2.7 1.4-2.2 2.6.5 1.1 3.9 1.1 4.4 0 .5-1.2-.5-2.6-2.2-2.6Z" />
        </svg>
      );
    case "pool": // 물결
      return (
        <svg {...common}>
          <path d="M3 9c2 0 2-1.5 4-1.5S9 9 11 9s2-1.5 4-1.5S17 9 19 9s2-1.5 2-1.5" />
          <path d="M3 14c2 0 2-1.5 4-1.5S9 14 11 14s2-1.5 4-1.5S17 14 19 14s2-1.5 2-1.5" />
          <path d="M3 19c2 0 2-1.5 4-1.5S9 19 11 19s2-1.5 4-1.5S17 19 19 19s2-1.5 2-1.5" />
        </svg>
      );
    case "playground": // 공 + 잔디
      return (
        <svg {...common}>
          <circle cx="14" cy="9" r="4.5" />
          <path d="M11 6.5c2 1 4 3.5 4.5 6M3 20c2-1.5 3-1.5 5 0s3 1.5 5 0 3-1.5 5 0 3 1.5 3 0" />
        </svg>
      );
    case "cafe": // 컵 + 김
      return (
        <svg {...common}>
          <path d="M5 10h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-5Z" />
          <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3" />
        </svg>
      );
    case "meetup": // 사람 셋
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="2.6" />
          <circle cx="5.5" cy="9" r="2" />
          <circle cx="18.5" cy="9" r="2" />
          <path d="M7.5 20c0-2.8 2-4.6 4.5-4.6s4.5 1.8 4.5 4.6" />
          <path d="M2 18c0-2 1.4-3.5 3.5-3.5M22 18c0-2-1.4-3.5-3.5-3.5" />
        </svg>
      );
    case "consult": // 말풍선 + 하트 (온라인 상담)
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
          <path d="M12 12.2 9.6 9.9a1.6 1.6 0 0 1 2.3-2.3l.1.1.1-.1a1.6 1.6 0 0 1 2.3 2.3z" />
        </svg>
      );
    case "grooming": // 빗 + 반짝임 (미용·스파)
      return (
        <svg {...common}>
          <path d="M3.5 5.5h10a2 2 0 0 1 2 2v3.5h-14V7.5a2 2 0 0 1 2-2Z" />
          <path d="M5.5 11v3.2M8.5 11v3.2M11.5 11v3.2M14.5 11v3.2" />
          <path d="M19 4v3.4M17.3 5.7h3.4" />
        </svg>
      );
    case "self-wash": // 욕조 + 물방울 (셀프목욕)
      return (
        <svg {...common}>
          <path d="M3 12.5h18V15a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2.5Z" />
          <path d="M6 12.5V7a2 2 0 0 1 4 0" />
          <path d="M6.5 19.5 6 21M17.5 19.5 18 21" />
          <path d="M15 4.5c1.4 1.5 2.1 2.6 2.1 3.4a2.1 2.1 0 1 1-4.2 0c0-.8.7-1.9 2.1-3.4Z" />
        </svg>
      );
    case "visiting-groom": // 가위 (방문미용)
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.6" />
          <circle cx="6" cy="18" r="2.6" />
          <path d="M20 4 8.3 15.7" />
          <path d="M14.6 14.4 20 19.8" />
          <path d="M8.3 8.3 12 12" />
        </svg>
      );
    case "visiting-bath": // 샤워기 + 물방울 (방문목욕)
      return (
        <svg {...common}>
          <path d="M4 20V7a3 3 0 0 1 6 0v1" />
          <path d="M9.5 10.5h9a2 2 0 0 1 2 2H7.5a2 2 0 0 1 2-2Z" />
          <path d="M11 16v1.5M14.5 15.5V18M18 16v1.5" />
        </svg>
      );
    case "rehab": // 러닝머신 경사면 + 발자국 (운동·재활)
      return (
        <svg {...common}>
          <path d="M3 18h18" />
          <path d="M4 15 18 9" />
          <path d="M18 9V5.5M18 5.5h-2.5" />
          <circle cx="8.5" cy="9.5" r="1.1" />
          <circle cx="11" cy="8" r="1" />
          <path d="M9.6 12.6c-1.2 0-1.9 1-1.5 1.8.3.8 2.7.8 3 0 .4-.8-.3-1.8-1.5-1.8Z" />
        </svg>
      );
    case "rehab-site": // 잎 + 십자 (재활·한방 시행처)
      return (
        <svg {...common}>
          <path d="M5 19c0-7 4-11 12-12-1 8-5 12-12 12Z" />
          <path d="M5 19c3-3 5-5 8-8" />
          <path d="M17.5 14.5v5M15 17h5" />
        </svg>
      );
    case "device": // 기기 본체 + 다이얼 (관리·재활 도구)
      return (
        <svg {...common}>
          <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
          <circle cx="9" cy="12" r="2.6" />
          <path d="M14.5 9.5h3M14.5 12h3M14.5 14.5h2" />
          <path d="M8 18v2h8v-2" />
        </svg>
      );
    case "monitor": // 심박 곡선 (모니터링·측정)
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="13" rx="2" />
          <path d="M6 12h3l1.5-3 2.5 6 1.5-3H18" />
          <path d="M9 21h6" />
        </svg>
      );
    default: // 핀
      return (
        <svg {...common}>
          <path d="M12 21s6-5.2 6-10a6 6 0 0 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.2" />
        </svg>
      );
  }
}

export function SpotTypeBanners({ types, counts }: { types: SpotTypeRow[]; counts: Map<number, number> }) {
  if (types.length === 0) return null;
  return (
    <nav aria-label="관련 디렉토리" className="mt-6 grid gap-3 sm:grid-cols-3">
      {types.map((t) => {
        const n = counts.get(t.id) ?? 0;
        return (
          <Link
            key={t.id}
            href={`/spot/type/${t.slug}`}
            className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:border-sea/50 hover:shadow-md"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sea-soft text-sea">
              <SpotTypeIcon slug={t.slug} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink group-hover:underline">
                {t.name}
                <span className="ml-1.5 text-xs font-medium text-ink-faint">{n > 0 ? `전국 ${n.toLocaleString("ko-KR")}곳` : "등록 받는 중"}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-soft">{BLURB[t.slug] ?? t.description ?? ""}</span>
              <span className="mt-1 block text-[11px] font-medium text-sea">업체 찾기 · 등록 →</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
