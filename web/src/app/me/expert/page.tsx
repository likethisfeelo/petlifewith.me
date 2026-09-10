// 내 상담 프로필 — 멘토(누구나) 또는 훈련사(자격 확인 뒤 공개)
import Link from "next/link";
import { getCurrentMember } from "@/lib/member";
import { getExpertForUser } from "@/lib/queries/experts";
import { listRegionOptions } from "@/lib/queries/requests";
import { EXPERT_KIND_LABEL, minToHm } from "@/lib/reservations";
import { MyExpertForm } from "./my-expert-form";

export default async function MeExpertPage() {
  const member = (await getCurrentMember())!;
  const [expert, regions] = await Promise.all([getExpertForUser(member.id), listRegionOptions()]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-ink">내 상담 프로필</h2>
        {expert && expert.status === "published" && (
          <Link href={`/consult/${encodeURIComponent(expert.slug)}`} className="text-sm font-medium text-sea hover:underline">
            공개 페이지 보기 →
          </Link>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        노견을 먼저 돌본 경험이 있다면 누구나 멘토로 상담을 열 수 있어요. 훈련사는 자격·경력을 적으면 운영자가 확인한 뒤 공개합니다. 지역을 고르면 그 지역 페이지에, 비우면 온라인 전용으로 보입니다.
        신청이 들어오면 받은 요청 탭에서 확인 → 결제 확인 → 채팅으로 이어집니다.
      </p>
      {expert && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${expert.status === "published" ? "border border-sage/30 bg-sage-soft text-sage-deep" : "border border-line bg-sand text-ink-soft"}`}>
          {EXPERT_KIND_LABEL[expert.kind]} · {expert.status === "published" ? "공개 중" : expert.kind === "trainer" ? "운영자 자격 확인 대기 (비공개)" : "비공개"} · 슬롯 {expert.slots.length}개 · 지역 {expert.regionIds.length}곳
        </p>
      )}
      <div className="mt-5">
        <MyExpertForm
          isNew={!expert}
          regions={regions}
          slots={(expert?.slots ?? []).map((s) => ({ weekday: String(s.weekday), start: minToHm(s.startMin), end: minToHm(s.endMin) }))}
          initial={{
            kind: expert?.kind ?? "mentor",
            displayName: expert?.displayName ?? member.displayName,
            introMd: expert?.introMd ?? null,
            credentialsText: expert?.credentialsText ?? null,
            topics: expert?.topics ?? [],
            modes: expert?.modes ?? ["chat"],
            priceText: expert?.priceText ?? null,
            heroImageKey: expert?.heroImageKey ?? null,
            contact: expert?.contact ?? null,
            status: expert?.status ?? "draft",
            regionIds: expert?.regionIds ?? [],
          }}
        />
      </div>
    </div>
  );
}
