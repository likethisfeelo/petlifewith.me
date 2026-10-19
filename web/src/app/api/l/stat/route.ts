// 링크 페이지 조회·채널 클릭 집계 — 브라우저 비콘 (components/linkpage/link-beacon.tsx)
// 같은 탭에서 다시 보는 조회는 비콘이 sessionStorage 로 걸러 보낸다. 여기서는 형식만 확인한다.
import { NextResponse } from "next/server";
import { recordSpotPageStat } from "@/lib/queries/spot-pages";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { spotId, kind } = (body ?? {}) as { spotId?: unknown; kind?: unknown };
  if (typeof spotId !== "number" || !Number.isSafeInteger(spotId) || spotId <= 0 || (kind !== "view" && kind !== "click")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const ok = await recordSpotPageStat(spotId, kind).catch(() => false);
  return NextResponse.json({ ok });
}
