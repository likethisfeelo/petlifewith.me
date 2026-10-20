// 링크 페이지 편집 패널 (서버) — 데이터를 모아 편집기에 넘긴다. 관리자·사장님 화면 공용
import { assetUrl } from "@/lib/assets";
import { siteUrl } from "@/lib/config";
import { getSpotPage, getSpotPageStats, listSpotMedia } from "@/lib/queries/spot-pages";
import { MEDIA_LIMITS, isPaidActive, linkBaseUrl, linkPageUrl } from "@/lib/spot-pages";
import { SpotPageEditor } from "./spot-page-editor";

export async function SpotPagePanel({ spotId, admin, monetizable }: { spotId: number; admin: boolean; monetizable: boolean }) {
  const page = await getSpotPage(spotId);
  if (!page && !admin) return null;
  const [media, stats] = page ? await Promise.all([listSpotMedia(spotId), getSpotPageStats(spotId)]) : [[], null];
  const paidActive = monetizable && isPaidActive(page);
  return (
    <SpotPageEditor
      spotId={spotId}
      admin={admin}
      monetizable={monetizable}
      paidActive={paidActive}
      linkUrl={page ? linkPageUrl(linkBaseUrl(siteUrl()), spotId, page) : null}
      page={page && { published: page.published, handle: page.handle, intro: page.intro, services: page.services, paidFrom: page.paidFrom, paidUntil: page.paidUntil }}
      media={media.map((m) => ({ id: m.id, kind: m.kind, url: assetUrl(m.objectKey), posterUrl: assetUrl(m.posterKey) }))}
      stats={stats}
      mediaLimit={MEDIA_LIMITS.paid.image}
    />
  );
}
