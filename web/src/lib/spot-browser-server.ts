// 서버 목록(SpotWithMeta) → 브라우저 항목 (위경도 변환·이미지 주소·예약 가능 판정)
import { assetUrl } from "./assets";
import { idSlugPath } from "./format";
import { spotLatLng } from "./geo";
import type { SpotWithMeta } from "./queries/spots";
import type { BrowserSpot } from "./spot-browser";

const BOOKING_KINDS = new Set(["kakao", "reservation"]);

export function toBrowserSpots(items: SpotWithMeta[], linkKinds: Map<number, string[]>): BrowserSpot[] {
  return items.map(({ spot, typeName, typeSlug, typeMonetizable, region, tier, photoKey }) => {
    const ll = spotLatLng(spot);
    const kinds = linkKinds.get(spot.id) ?? [];
    return {
      id: spot.id,
      name: spot.name,
      href: idSlugPath("place", spot.id, spot.slug),
      typeName,
      typeSlug,
      regionLabel: `${region.sidoName} ${region.sigunguName}`,
      address: spot.addressRoad,
      status: spot.status,
      hours: spot.hoursText,
      parking: spot.parkingText,
      price: spot.priceText,
      tier,
      monetizable: typeMonetizable,
      // 목록 카드·지도 핀 대표 사진은 프리미엄·상단 노출만 (무료 등록 업체 사진은 링크 페이지에서만)
      heroUrl: typeMonetizable && (tier === "paid" || tier === "promoted") ? (assetUrl(photoKey ?? spot.heroImageKey) ?? null) : null,
      lat: ll?.lat ?? null,
      lng: ll?.lng ?? null,
      booking: kinds.some((k) => BOOKING_KINDS.has(k)) || (typeMonetizable && spot.status === "operating" && !!spot.claimedBy),
      claimed: !!spot.claimedBy,
    };
  });
}
