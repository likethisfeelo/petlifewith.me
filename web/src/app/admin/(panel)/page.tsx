import Link from "next/link";
import { sql, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";

const { guides, claims, spots, makers, items } = schema;

export default async function AdminDashboardPage() {
  if (!isDbConfigured()) {
    return <p className="text-sm text-ink-soft">DATABASE_URL 이 설정되지 않았습니다.</p>;
  }
  const db = getDb();

  const [guideCounts, pendingClaims, spotCount, makerCount, itemCount] = await Promise.all([
    db
      .select({ status: guides.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(guides)
      .groupBy(guides.status),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(claims).where(eq(claims.status, "pending")),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(spots),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(makers),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(items),
  ]);

  const byStatus = Object.fromEntries(guideCounts.map((g) => [g.status, g.count]));

  const cards: Array<{ label: string; value: number; href: string; alert?: boolean }> = [
    { label: "발행된 가이드", value: byStatus.published ?? 0, href: "/admin/guides" },
    { label: "감수 대기", value: byStatus.review_pending ?? 0, href: "/admin/guides", alert: (byStatus.review_pending ?? 0) > 0 },
    { label: "작성 중", value: byStatus.draft ?? 0, href: "/admin/guides" },
    { label: "대기 중 클레임", value: pendingClaims[0]?.count ?? 0, href: "/admin/claims", alert: (pendingClaims[0]?.count ?? 0) > 0 },
    { label: "스팟", value: spotCount[0]?.count ?? 0, href: "/admin/spots" },
    { label: "메이커", value: makerCount[0]?.count ?? 0, href: "/admin" },
    { label: "상품", value: itemCount[0]?.count ?? 0, href: "/admin" },
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
      <p className="mt-6 text-xs text-ink-faint">
        의료 인접 편은 감수 완료 전 발행이 차단됩니다. 콘텐츠 원본은 data/content/guides 마크다운이며, 시드
        재실행 시 관리자에서 수정한 본문을 덮어씁니다.
      </p>
    </div>
  );
}
