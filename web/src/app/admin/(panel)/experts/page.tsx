import Link from "next/link";
import { formatDate } from "@/lib/format";
import { listExpertsAdmin } from "@/lib/queries/experts";
import { CONSULT_MODE_LABEL, EXPERT_KIND_LABEL, type ConsultMode } from "@/lib/reservations";
import { AdminPageHeader } from "../../_components/fields";
import { toggleExpertPublishedAction } from "../../expert-actions";

export default async function AdminExpertsPage() {
  const rows = await listExpertsAdmin();
  return (
    <div>
      <AdminPageHeader
        title="상담 전문가"
        description="훈련사·수의사·수의 테크니션·멘토 프로필. 요청함(상담 전문가 등록)에서 '전문가로 등록'으로 만들거나 직접 등록합니다. 수의사·수의 테크니션은 생활 상담으로 한정 — 병원명·주소·순위·평점 없음."
        right={
          <Link href="/admin/experts/new" className="rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:opacity-90">
            + 전문가 등록
          </Link>
        }
      />
      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">아직 전문가가 없습니다.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {rows.map((e) => (
            <li key={e.id} className="rounded-xl border border-line bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <span className={`rounded-full px-2 py-0.5 font-medium ${e.status === "published" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>{e.status === "published" ? "공개" : "비공개"}</span>
                <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{EXPERT_KIND_LABEL[e.kind]}</span>
                <span>{e.modes.map((m) => CONSULT_MODE_LABEL[m as ConsultMode] ?? m).join("·") || "방식 없음"}</span>
                <span>{e.hasSlots ? "슬롯 있음" : "연락받기만"}</span>
                <span>계정 {e.userName ?? "없음 (운영자 응대)"}</span>
                <span>정렬 {e.sortOrder}</span>
                <span>{formatDate(e.updatedAt)}</span>
                <form action={toggleExpertPublishedAction} className="ml-auto">
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className={`rounded-full px-3 py-1 text-xs font-semibold ${e.status === "published" ? "bg-sand text-ink-soft" : "bg-ink text-white"}`}>
                    {e.status === "published" ? "비공개로" : "공개하기"}
                  </button>
                </form>
              </div>
              <p className="mt-2 font-bold text-ink">
                <Link href={`/admin/experts/${e.id}`} className="hover:underline">
                  {e.displayName}
                </Link>
                {e.status === "published" && (
                  <Link href={`/consult/${encodeURIComponent(e.slug)}`} className="ml-2 text-xs font-medium text-sea hover:underline">
                    공개 페이지 →
                  </Link>
                )}
              </p>
              {e.credentialsText && <p className="mt-0.5 text-xs text-ink-soft">{e.credentialsText}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
