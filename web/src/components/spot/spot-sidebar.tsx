// 스팟 목록 왼쪽 칸 아래쪽 (서버) — 이 지역의 다른 유형, 같은 시도의 다른 시군구. 모두 진짜 링크(SEO)
import Link from "next/link";
import { regionHref, type RegionTile } from "@/lib/regions";

export function SpotSidebar({
  types,
  currentType,
  basePath,
  sidoRegions,
  currentRegionId,
  typeSlug,
  countsByRegion,
  sidoName,
  sidoSlug,
}: {
  types: Array<{ slug: string; name: string; count: number }>;
  currentType: string | null;
  basePath: string;
  sidoRegions: RegionTile[];
  currentRegionId: number;
  typeSlug: string | null;
  countsByRegion: Record<number, number>;
  sidoName: string;
  sidoSlug: string;
}) {
  return (
    <div className="space-y-5 text-sm">
      {types.length > 0 && (
        <nav aria-label="이 지역의 다른 유형">
          <p className="mb-2 text-xs font-bold text-ink">유형</p>
          <ul className="flex flex-wrap gap-1.5">
            <li>
              <Link href={basePath} className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${currentType === null ? "bg-ink text-cream" : "bg-sand text-ink-soft hover:text-ink"}`}>
                전체
              </Link>
            </li>
            {types.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`${basePath}/${t.slug}`}
                  aria-current={t.slug === currentType ? "page" : undefined}
                  className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${t.slug === currentType ? "bg-ink text-cream" : "bg-sand text-ink-soft hover:text-ink"}`}
                >
                  {t.name} <span className="opacity-60">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <nav aria-label={`${sidoName} 다른 지역`}>
        <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
          {sidoName}
          <Link href={`/spot/${sidoSlug}`} className="font-medium text-sea hover:underline">
            지역 바꾸기
          </Link>
        </p>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {sidoRegions.map((r) => {
            const n = countsByRegion[r.id] ?? 0;
            const current = r.id === currentRegionId;
            return (
              <li key={r.id}>
                <Link
                  href={regionHref(r, typeSlug)}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${current ? "bg-sea-soft font-bold text-sea" : n > 0 ? "text-ink-soft hover:bg-sand hover:text-ink" : "text-ink-faint hover:bg-sand"}`}
                >
                  <span>{r.sigunguName}</span>
                  {n > 0 && <span>{n.toLocaleString("ko-KR")}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
