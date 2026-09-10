import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/member";
import { getOwnedMaker } from "@/lib/queries/owner";
import { OwnerItemForm } from "../owner-item-form";

export default async function OwnerItemNewPage({ params }: { params: Promise<{ id: string }> }) {
  const member = (await getCurrentMember())!;
  const { id } = await params;
  const makerId = Number(id);
  if (!Number.isSafeInteger(makerId)) notFound();
  const found = await getOwnedMaker(makerId, member.id);
  if (!found) notFound();
  return (
    <div>
      <p className="text-xs text-ink-faint">
        <Link href="/me/business" className="hover:underline">
          내 업체·브랜드
        </Link>{" "}
        ›{" "}
        <Link href={`/me/business/maker/${makerId}`} className="hover:underline">
          {found.maker.name}
        </Link>{" "}
        › 상품 추가
      </p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink">상품 추가</h2>
      <div className="mt-5">
        <OwnerItemForm mode="create" item={{ makerId, name: "", category: "treat", summary: null, descriptionMd: null, imageKey: null }} offers={[]} />
      </div>
    </div>
  );
}
