import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getExpertById } from "@/lib/queries/experts";
import { minToHm } from "@/lib/reservations";
import { AdminPageHeader } from "../../../_components/fields";
import { ExpertEditor } from "./expert-editor";

export default async function AdminExpertEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const expertId = Number(id);
  if (!Number.isSafeInteger(expertId)) notFound();
  const expert = await getExpertById(expertId);
  if (!expert) notFound();
  const email = expert.userId ? ((await getDb().select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, expert.userId)).limit(1))[0]?.email ?? "") : "";
  return (
    <div>
      <AdminPageHeader
        title={expert.displayName}
        description={`${expert.status === "published" ? "공개 중" : "비공개"} · 슬롯 ${expert.slots.length}개`}
        right={
          <Link href={`/consult/${encodeURIComponent(expert.slug)}`} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        }
      />
      {created && <p className="mt-4 rounded-lg border border-sage/30 bg-sage-soft px-3 py-2 text-sm text-sage-deep">등록되었습니다. 공개 체크를 켜야 상담 허브에 보입니다.</p>}
      <div className="mt-5">
        <ExpertEditor
          mode="edit"
          expert={{
            id: expert.id,
            kind: expert.kind,
            displayName: expert.displayName,
            introMd: expert.introMd,
            credentialsText: expert.credentialsText,
            credentialsVerifiedAt: expert.credentialsVerifiedAt,
            topics: expert.topics,
            modes: expert.modes,
            priceText: expert.priceText,
            heroImageKey: expert.heroImageKey,
            userEmail: email,
            contact: expert.contact,
            status: expert.status,
            sortOrder: expert.sortOrder,
          }}
          slots={expert.slots.map((s) => ({ weekday: String(s.weekday), start: minToHm(s.startMin), end: minToHm(s.endMin) }))}
        />
      </div>
    </div>
  );
}
