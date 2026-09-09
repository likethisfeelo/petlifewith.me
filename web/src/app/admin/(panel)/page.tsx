import Link from "next/link";
import { sql, eq, isNull } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";

const { guides, serviceRequests, spots, makers, items, deviceModels, curations, rehabSites, users, comments, spotServiceAreas, bookingRequests } = schema;

export default async function AdminDashboardPage() {
  if (!isDbConfigured()) {
    return <p className="text-sm text-ink-soft">DATABASE_URL 이 설정되지 않았습니다.</p>;
  }
  const db = getDb();

  const [guideCounts, newRequests, spotCount, makerCount, itemCount, deviceCount, curationCount, rehabCount, memberCount, commentCount, careCount, openBookings] = await Promise.all([
    db
      .select({ status: guides.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(guides)
      .groupBy(guides.status),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(serviceRequests).where(eq(serviceRequests.status, "new")),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(spots),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(makers),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(items),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(deviceModels),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(curations),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(rehabSites),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, "member")),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(comments),
    db.select({ count: sql<number>`count(distinct ${spotServiceAreas.spotId})`.mapWith(Number) }).from(spotServiceAreas).where(eq(spotServiceAreas.exposed, true)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(bookingRequests).where(isNull(bookingRequests.handledAt)),
  ]);

  const byStatus = Object.fromEntries(guideCounts.map((g) => [g.status, g.count]));

  const cards: Array<{ label: string; value: number; href: string; alert?: boolean }> = [
    { label: "발행된 게시글", value: byStatus.published ?? 0, href: "/admin/guides" },
    { label: "감수 대기", value: byStatus.review_pending ?? 0, href: "/admin/guides?status=review_pending", alert: (byStatus.review_pending ?? 0) > 0 },
    { label: "회원 글 승인 대기", value: byStatus.pending ?? 0, href: "/admin/guides?status=pending", alert: (byStatus.pending ?? 0) > 0 },
    { label: "작성 중", value: byStatus.draft ?? 0, href: "/admin/guides" },
    { label: "미처리 요청 (요청함)", value: newRequests[0]?.count ?? 0, href: "/admin/requests?status=new", alert: (newRequests[0]?.count ?? 0) > 0 },
    { label: "스팟", value: spotCount[0]?.count ?? 0, href: "/admin/spots" },
    { label: "메이커", value: makerCount[0]?.count ?? 0, href: "/admin/makers" },
    { label: "상품", value: itemCount[0]?.count ?? 0, href: "/admin/items" },
    { label: "기기", value: deviceCount[0]?.count ?? 0, href: "/admin/devices" },
    { label: "큐레이션", value: curationCount[0]?.count ?? 0, href: "/admin/curations" },
    { label: "재활·한방 시행처", value: rehabCount[0]?.count ?? 0, href: "/admin/rehab" },
    { label: "회원", value: memberCount[0]?.count ?? 0, href: "/admin/members" },
    { label: "댓글", value: commentCount[0]?.count ?? 0, href: "/admin/comments" },
    { label: "돌봄 파트너 (노출 중)", value: careCount[0]?.count ?? 0, href: "/admin/care" },
    { label: "미처리 예약 신청", value: openBookings[0]?.count ?? 0, href: "/admin/bookings", alert: (openBookings[0]?.count ?? 0) > 0 },
  ];

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink">대시보드</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-xl border p-4 ${c.alert ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"}`}
          >
            <p className="text-xs text-ink-soft">{c.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${c.alert ? "text-accent-deep" : "text-ink"}`}>{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-line bg-sand/60 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">빠른 등록</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { href: "/admin/guides/new", label: "게시글 작성" },
            { href: "/admin/spots/new", label: "스팟 등록" },
            { href: "/admin/care", label: "돌봄 파트너 지역 노출" },
            { href: "/admin/makers/new", label: "메이커 등록" },
            { href: "/admin/items/new", label: "상품 등록" },
            { href: "/admin/devices/new", label: "기기 등록" },
            { href: "/admin/rehab/new", label: "재활·한방 시행처 등록" },
            { href: "/admin/curations/new", label: "큐레이션 등록" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-ink hover:bg-sand"
            >
              + {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-3">
          의료 인접 편은 감수 완료 전 발행이 차단됩니다. data/content/guides 의 마크다운과 같은 슬러그를 쓰면
          시드 재실행 시 본문이 덮어써지니, 관리자에서 쓴 글은 다른 슬러그를 쓰세요.
        </p>
      </div>
    </div>
  );
}
