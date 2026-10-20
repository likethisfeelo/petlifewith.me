// 시도 전체 스팟 (지도·목록) — 시도 페이지가 브라우저에서 불러온다. 수천 곳이라 HTML 에 싣지 않고 압축해 캐시한다.
import { NextResponse } from "next/server";
import { listLinkKindsBySpot, listSpotsInRegion } from "@/lib/queries/spots";
import { packSpots } from "@/lib/spot-browser";
import { toBrowserSpots } from "@/lib/spot-browser-server";

export const revalidate = 21600; // REVALIDATE.spotDirectory

export async function GET(req: Request) {
  const sido = new URL(req.url).searchParams.get("sido") ?? "";
  if (!/^[a-z-]{2,30}$/.test(sido)) return NextResponse.json({ error: "bad sido" }, { status: 400 });
  const spots = await listSpotsInRegion({ sidoSlug: sido });
  const items = toBrowserSpots(spots, await listLinkKindsBySpot(spots.map((s) => s.spot.id)));
  return NextResponse.json(packSpots(items), { headers: { "cache-control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
