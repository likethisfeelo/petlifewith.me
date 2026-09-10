import Link from "next/link";
import { notFound } from "next/navigation";
import { idSlugPath } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { getOwnedItem } from "@/lib/queries/owner";
import { OwnerItemForm } from "../owner-item-form";

export default async function OwnerItemEditPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const member = (await getCurrentMember())!;
  const { id, itemId } = await params;
  const makerId = Number(id);
  const iid = Number(itemId);
  if (!Number.isSafeInteger(makerId) || !Number.isSafeInteger(iid)) notFound();
  const found = await getOwnedItem(iid, member.id);
  if (!found || found.maker.id !== makerId) notFound();
  const { item, maker, offers, mentionCount } = found;
  return (
    <div>
      <p className="text-xs text-ink-faint">
        <Link href="/me/business" className="hover:underline">
          내 업체·브랜드
        </Link>{" "}
        ›{" "}
        <Link href={`/me/business/maker/${makerId}`} className="hover:underline">
          {maker.name}
        </Link>{" "}
        › {item.name}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold tracking-tight text-ink">{item.name}</h2>
        <Link href={idSlugPath("item", item.id, item.slug)} className="text-sm font-medium text-sea hover:underline">
          공개 페이지 보기 →
        </Link>
      </div>
      <div className="mt-5">
        <OwnerItemForm
          mode="edit"
          item={{ id: item.id, makerId, name: item.name, category: item.category, summary: item.summary, descriptionMd: item.descriptionMd, imageKey: item.imageKey, mentionCount }}
          offers={offers.filter((o) => o.vendor !== "coupang").map((o) => ({ vendor: o.vendor, url: o.url, label: o.label ?? "" }))}
        />
        {offers.some((o) => o.vendor === "coupang") && <p className="mt-2 text-xs text-ink-faint">운영자가 단 쿠팡 링크는 여기서 보이지 않으며 그대로 유지됩니다.</p>}
      </div>
    </div>
  );
}
