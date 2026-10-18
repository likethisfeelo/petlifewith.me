// 목록 미리보기 창의 내용 — 카드에 없는 것(채널 링크·소개·서비스·사진)만 가볍게 (components/spot/spot-preview.tsx)
import { NextResponse } from "next/server";
import { assetUrl } from "@/lib/assets";
import { siteUrl } from "@/lib/config";
import { SPOT_STATUS_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { spotLatLng } from "@/lib/geo";
import { spotLinkLabel } from "@/lib/links";
import { getSpotPage, listSpotMedia } from "@/lib/queries/spot-pages";
import { getPlace, getSpotLinks } from "@/lib/queries/spots";
import { UNVERIFIED_NOTICE, linkBaseUrl, linkPageUrl } from "@/lib/spot-pages";

export const revalidate = 21600; // REVALIDATE.place

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const found = await getPlace(id);
  if (!found || !found.typeListed) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { spot, region, tier } = found;
  const paid = found.typeMonetizable && tier === "paid";
  const [links, page, media] = await Promise.all([getSpotLinks(id), getSpotPage(id), paid ? listSpotMedia(id) : Promise.resolve([])]);
  const coords = spotLatLng(spot);
  const intro = page?.intro?.trim() || spot.descriptionMd?.split(/\n\s*\n/)[0]?.replace(/[#*_>`]/g, "").trim().slice(0, 240) || null;
  return NextResponse.json({
    id,
    name: spot.name,
    href: idSlugPath("place", id, spot.slug),
    typeName: found.typeName,
    regionLabel: `${region.sidoName} ${region.sigunguName}`,
    status: SPOT_STATUS_LABEL[spot.status] ?? spot.status,
    operating: spot.status === "operating",
    address: spot.addressRoad,
    phone: spot.phone,
    hours: spot.hoursText,
    price: spot.priceText,
    parking: spot.parkingText,
    intro,
    services: page?.services ?? [],
    tier,
    monetizable: found.typeMonetizable,
    heroUrl: assetUrl(spot.heroImageKey) ?? null,
    images: media.filter((m) => m.kind === "image").slice(0, 4).map((m) => assetUrl(m.objectKey)).filter(Boolean),
    links: links.map((l) => ({ id: l.id, kind: l.kind, label: spotLinkLabel(l), url: l.url })),
    linkPageUrl: page?.published ? linkPageUrl(linkBaseUrl(siteUrl()), id, page) : null,
    bookUrl: found.typeMonetizable && spot.status === "operating" && spot.source !== "sample" ? `/book/spot/${id}` : null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    notice: tier === "unlisted" && !spot.claimedBy && spot.source !== "sample" ? UNVERIFIED_NOTICE : null,
    dataReferenceDate: spot.dataReferenceDate ? formatDate(spot.dataReferenceDate) : null,
  });
}
