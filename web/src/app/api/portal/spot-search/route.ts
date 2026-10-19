// 사장님 "내 업체 찾기" — 이름·전화번호로 기존 업체를 찾는다. 소유 상태(없음/내 업체/다른 회원)를 함께 준다.
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/member";
import { getSpotForOwner, searchSpotsForOwner } from "@/lib/queries/spot-register";
import { searchTerm } from "@/lib/spot-register";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = Number(u.searchParams.get("id"));
  if (Number.isSafeInteger(id) && id > 0) {
    const member = await getCurrentMember().catch(() => null);
    const hit = await getSpotForOwner(id, member?.id ?? null);
    return NextResponse.json({ hits: hit ? [hit] : [] }, { headers: { "cache-control": "private, no-store" } });
  }
  const term = searchTerm(u.searchParams.get("q"));
  if (!term) return NextResponse.json({ hits: [] });
  const regionId = Number(u.searchParams.get("region")) || null;
  const member = await getCurrentMember().catch(() => null);
  const hits = await searchSpotsForOwner(term, { regionId, typeSlug: u.searchParams.get("type"), memberId: member?.id ?? null });
  return NextResponse.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}
