import Link from "next/link";
import { notFound } from "next/navigation";
import { MAKER_CATEGORY_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { getOwnedMaker } from "@/lib/queries/owner";
import { OwnerMakerForm } from "./owner-maker-form";

export default async function OwnerMakerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ item?: string; deleted?: string }> }) {
  const member = (await getCurrentMember())!;
  const { id } = await params;
  const { item: createdItem, deleted } = await searchParams;
  const makerId = Number(id);
  if (!Number.isSafeInteger(makerId)) notFound();
  const found = await getOwnedMaker(makerId, member.id);
  if (!found) notFound();
  const { maker, links, items } = found;

  return (
    <div>
      <p className="text-xs text-ink-faint">
        <Link href="/me/business" className="hover:underline">
          내 업체·브랜드
        </Link>{" "}
        › {maker.name}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{maker.name}</h2>
          <p className="mt-1 text-xs text-ink-soft">
            {MAKER_CATEGORY_LABEL[maker.category] ?? maker.category} · {maker.status === "published" ? "공개 중" : "비공개 (운영자가 소개 기준 확인 뒤 공개)"}
          </p>
        </div>
        {maker.status === "published" && (
          <Link href={idSlugPath("maker", maker.id, maker.slug)} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        )}
      </div>
      {createdItem && <p className="mt-3 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">상품을 등록했습니다.</p>}
      {deleted && <p className="mt-3 rounded-lg border border-line bg-sand px-3 py-2 text-sm text-ink-soft">상품을 삭제했습니다.</p>}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-ink">상품 {items.length > 0 ? `${items.length}개` : ""}</h3>
          <Link href={`/me/business/maker/${maker.id}/items/new`} className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
            + 상품 추가
          </Link>
        </div>
        <p className="mt-1 text-xs text-ink-faint">상품은 브랜드가 공개 상태면 저장 즉시 보입니다. 글에 상품을 연결하면 글 옆에 구매 링크가 함께 보입니다.</p>
        {items.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-5 text-sm text-ink-faint">아직 상품이 없어요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-bold text-ink">{it.name}</span>
                <span className="text-xs text-ink-faint">
                  {it.category} · {formatDate(it.updatedAt)}
                </span>
                <span className="ml-auto flex gap-3 text-xs">
                  <Link href={idSlugPath("item", it.id, it.slug)} className="text-sea hover:underline">
                    공개 페이지
                  </Link>
                  <Link href={`/me/business/maker/${maker.id}/items/${it.id}`} className="rounded-full border border-line px-3 py-1 font-medium text-ink hover:bg-sand">
                    편집
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-base font-bold text-ink">브랜드 정보</h3>
        <div className="mt-3">
          <OwnerMakerForm maker={{ id: maker.id, storyMd: maker.storyMd, heroImageKey: maker.heroImageKey }} links={links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? "" }))} />
        </div>
      </section>
    </div>
  );
}
