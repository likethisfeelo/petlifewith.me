import type { MetadataRoute } from "next";
import { isProductionSite, siteUrl } from "@/lib/config";

// 프로덕션 URL 이 설정되지 않은 환경(로컬·프리뷰)은 전면 차단 —
// 실수로 색인되는 사고를 robots 차원에서도 막는다 (lib/seo.ts 의 메타 가드와 이중).
export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/admin/", "/claim/", "/reservations/", "/book/", "/chat/", "/me", "/me/"] }],
    sitemap: `${siteUrl().replace(/\/$/, "")}/sitemap.xml`,
  };
}
