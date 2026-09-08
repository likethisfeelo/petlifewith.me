// 글 상단 디렉토리 배너 — 관리자가 지정한 스팟 유형(guides.banner_spot_types)을 3열 배너로.
// 클릭하면 그 유형의 디렉토리(/spot/type/[slug])로 간다: 업체를 찾고, 사장님은 등록을 요청하는 입구.
// 커뮤니티 게시판이 아니다 — 아무나 글을 쓰는 곳이 아니라 업체 정보가 쌓이는 곳.
import Link from "next/link";
import type { SpotTypeRow } from "@/lib/queries/spots";

/** 유형별 한 줄 안내 (spot_types.description 은 ETL 메모라 사용자용 문구를 따로 둔다) */
const BLURB: Record<string, string> = {
  boarding: "낮 시간을 맡기는 유치원·데이케어·호텔. 지역별로 찾고 견학 전 확인할 것을 봅니다.",
  "pet-sitter": "집으로 오거나 시터 집에서 돌보는 펫시터. 지역별 업체·개인 사업자 정보.",
  "dog-walk": "산책 대행·동행 서비스. 노견에게 맞는 산책 조건을 확인하고 지역에서 찾습니다.",
  "visiting-bath": "이동이 부담스러운 아이를 위한 방문·출장 목욕.",
  "visiting-groom": "집으로 오는 미용. 노령견 전문 여부를 확인합니다.",
  rehab: "재활 운동·수중런닝머신 시설.",
  grooming: "미용·스파 시설.",
  "self-wash": "직접 씻기는 셀프목욕 시설.",
};

function Icon({ slug }: { slug: string }) {
  const common = { className: "h-6 w-6", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (slug) {
    case "boarding": // 집·지붕
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
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
              <Icon slug={t.slug} />
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
