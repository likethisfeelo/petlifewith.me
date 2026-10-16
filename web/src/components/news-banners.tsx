// 뉴스 우측 이미지 배너 — PC: 오른쪽 세로형(1:2) 위아래로 2개, 모바일: 목록 아래 가로형(3:1).
// <picture> 로 화면 폭에 맞는 이미지만 받는다. 광고 배너는 "광고" 표기 + 외부 링크 rel=sponsored.
import Link from "next/link";
import type { ReactNode } from "react";
import { assetUrl } from "@/lib/assets";
import { isInternalPath, type NewsBanner } from "@/lib/news-banners";

function BannerLink({ banner, slot, children }: { banner: NewsBanner; slot: number; children: ReactNode }) {
  const track = {
    "data-track": "promo_click",
    "data-track-banner": `news_${slot}`,
    "data-track-link-area": "news_sidebar",
    "data-track-is-sponsored": banner.sponsored ? "true" : "false",
  };
  if (!banner.href) return <div className="block">{children}</div>;
  if (isInternalPath(banner.href)) {
    return (
      <Link href={banner.href} className="block" {...track}>
        {children}
      </Link>
    );
  }
  return (
    <a href={banner.href} target="_blank" rel={banner.sponsored ? "noopener sponsored" : "noopener"} className="block" {...track}>
      {children}
    </a>
  );
}

export function NewsBanners({ banners }: { banners: NewsBanner[] }) {
  if (banners.length === 0) return null;
  return (
    <div className="grid gap-4">
      {banners.map((b, i) => {
        const pc = assetUrl(b.pcImageKey ?? b.mobileImageKey);
        const mobile = assetUrl(b.mobileImageKey ?? b.pcImageKey);
        if (!pc || !mobile) return null;
        return (
          <figure
            key={i}
            className="relative overflow-hidden rounded-xl border border-line bg-sand"
            data-track-impression="promo_impression"
            data-track-banner={`news_${i + 1}`}
            data-track-link-area="news_sidebar"
          >
            <BannerLink banner={b} slot={i + 1}>
              <picture>
                <source media="(min-width: 1024px)" srcSet={pc} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mobile} alt={b.alt} loading="lazy" decoding="async" className="block aspect-[3/1] w-full object-cover lg:aspect-[1/2]" />
              </picture>
            </BannerLink>
            {b.sponsored && <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 text-[11px] font-medium text-cream">광고</span>}
          </figure>
        );
      })}
    </div>
  );
}
