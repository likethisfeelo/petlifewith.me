import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, isDbConfigured, schema } from "@/lib/db";
import { CLAIM_STATUS_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { decideClaimAction } from "../../actions";

const { claims, spots, makers } = schema;

export default async function AdminClaimsPage() {
  if (!isDbConfigured()) return <p className="text-sm text-ink-soft">DATABASE_URL 미설정</p>;
  const db = getDb();

  const rows = await db
    .select({ claim: claims, spotName: spots.name, spotSlug: spots.slug, makerName: makers.name, makerSlug: makers.slug })
    .from(claims)
    .leftJoin(spots, eq(claims.spotId, spots.id))
    .leftJoin(makers, eq(claims.makerId, makers.id))
    .orderBy(desc(claims.createdAt));

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink">클레임 {rows.length}건</h1>
      <p className="mt-1 text-xs text-ink-faint">
        연락처·사업자번호는 확인 용도로만 사용합니다. 승인 후 요청 정보를 스팟/메이커 편집에서 반영하세요.
      </p>

      <div className="mt-4 space-y-3">
        {rows.length === 0 && <p className="text-sm text-ink-faint">접수된 클레임이 없습니다.</p>}
        {rows.map(({ claim, spotName, spotSlug, makerName, makerSlug }) => {
          const targetName = claim.targetType === "spot" ? spotName : makerName;
          const targetPath =
            claim.targetType === "spot" && claim.spotId && spotSlug
              ? idSlugPath("place", claim.spotId, spotSlug)
              : claim.targetType === "maker" && claim.makerId && makerSlug
                ? idSlugPath("maker", claim.makerId, makerSlug)
                : null;
          return (
            <div key={claim.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span
                    className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      claim.status === "pending"
                        ? "bg-accent-soft text-accent-deep"
                        : claim.status === "approved"
                          ? "bg-sage-soft text-sage-deep"
                          : "bg-sand text-ink-soft"
                    }`}
                  >
                    {CLAIM_STATUS_LABEL[claim.status]}
                  </span>
                  <span className="font-bold text-ink">{targetName ?? "(삭제된 대상)"}</span>
                  <span className="ml-2 text-xs text-ink-faint">
                    {claim.targetType === "spot" ? "스팟" : "메이커"} · {formatDate(claim.createdAt)}
                  </span>
                </div>
                {targetPath && (
                  <Link href={targetPath} className="text-xs font-medium text-sea hover:underline">
                    대상 페이지 →
                  </Link>
                )}
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-faint">신청인</dt>
                  <dd className="text-ink">{claim.claimantName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">연락처 (비공개)</dt>
                  <dd className="text-ink">{claim.contact}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">사업자번호 (비공개)</dt>
                  <dd className="text-ink">{claim.bizRegistrationNo ?? "-"}</dd>
                </div>
              </dl>
              {claim.message && <p className="mt-2 rounded-lg bg-sand px-3 py-2 text-sm text-ink-soft">{claim.message}</p>}
              {claim.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <form action={decideClaimAction}>
                    <input type="hidden" name="id" value={claim.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="rounded-full bg-sage px-4 py-1.5 text-xs font-medium text-white hover:opacity-90">
                      승인
                    </button>
                  </form>
                  <form action={decideClaimAction}>
                    <input type="hidden" name="id" value={claim.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-soft hover:bg-sand">
                      반려
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
