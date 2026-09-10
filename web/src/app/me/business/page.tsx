// 내 업체·브랜드 — 소유 확인된 것의 목록·편집 진입 + 등록·소유 확인 요청 안내 + 진행 중 요청
import Link from "next/link";
import { SPOT_STATUS_LABEL, formatDate, idSlugPath } from "@/lib/format";
import { getCurrentMember } from "@/lib/member";
import { listOwnedMakers, listOwnedSpots } from "@/lib/queries/owner";
import { listMyServiceRequests } from "@/lib/queries/requests";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL } from "@/lib/requests";

export default async function MeBusinessPage() {
  const member = (await getCurrentMember())!;
  const [spots, makers, requests] = await Promise.all([listOwnedSpots(member.id), listOwnedMakers(member.id), listMyServiceRequests(member.id)]);
  const open = requests.filter((r) => r.status === "new" || r.status === "in_progress");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-ink">내 업체 {spots.length > 0 ? `${spots.length}곳` : ""}</h2>
        <p className="mt-1 text-xs text-ink-faint">소유가 확인된 업체·돌봄 파트너입니다. 운영시간·요금·소개·링크·대표 이미지를 직접 고칠 수 있어요. 이름·주소·유형·지역은 요청으로 바꿉니다.</p>
        {spots.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-5 text-sm text-ink-faint">아직 없어요. 아래에서 등록하거나 소유 확인을 요청하세요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {spots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "operating" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-soft"}`}>{SPOT_STATUS_LABEL[s.status] ?? s.status}</span>
                <span className="font-bold text-ink">{s.name}</span>
                <span className="text-xs text-ink-faint">
                  {s.typeName} · {s.regionLabel} · {formatDate(s.updatedAt)}
                </span>
                <span className="ml-auto flex gap-3 text-xs">
                  <Link href={idSlugPath("place", s.id, s.slug)} className="text-sea hover:underline">
                    공개 페이지
                  </Link>
                  <Link href={`/me/business/spot/${s.id}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-cream hover:opacity-90">
                    편집
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-ink">내 브랜드 {makers.length > 0 ? `${makers.length}개` : ""}</h2>
        <p className="mt-1 text-xs text-ink-faint">브랜드 소개·링크·대표 이미지와 상품을 관리합니다. 브랜드 공개 여부는 소개 기준 확인 뒤 운영자가 정합니다.</p>
        {makers.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line p-5 text-sm text-ink-faint">아직 없어요. 아래에서 브랜드 소개를 신청하거나 소유 확인을 요청하세요.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {makers.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === "published" ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-soft"}`}>{m.status === "published" ? "공개" : "비공개"}</span>
                <span className="font-bold text-ink">{m.name}</span>
                <span className="text-xs text-ink-faint">상품 {m.itemCount}개 · {formatDate(m.updatedAt)}</span>
                <span className="ml-auto flex gap-3 text-xs">
                  {m.status === "published" && (
                    <Link href={idSlugPath("maker", m.id, m.slug)} className="text-sea hover:underline">
                      공개 페이지
                    </Link>
                  )}
                  <Link href={`/me/business/maker/${m.id}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-cream hover:opacity-90">
                    편집·상품
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="add" className="rounded-2xl border border-line bg-sand/50 p-5">
        <h2 className="text-sm font-bold text-ink">업체·브랜드 추가하기</h2>
        <p className="mt-1 text-xs text-ink-soft">로그인한 채로 요청하면 이 계정에 연결되고, 운영자가 확인하면 여기에 나타나 직접 관리할 수 있어요. 여러 곳을 가져도 됩니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/spot" className="rounded-xl border border-line bg-surface p-3 hover:border-sea/60">
            <p className="text-sm font-bold text-ink">이미 디렉토리에 있는 업체</p>
            <p className="mt-0.5 text-xs text-ink-soft">지역에서 내 업체를 찾아 업체 페이지의 &quot;정보 관리 요청&quot;을 누르세요 → 소유 확인</p>
          </Link>
          <Link href="/portal/spot#register" className="rounded-xl border border-line bg-surface p-3 hover:border-sea/60">
            <p className="text-sm font-bold text-ink">아직 없는 업체</p>
            <p className="mt-0.5 text-xs text-ink-soft">업체 등록 요청 → 운영자가 만들면서 이 계정을 소유자로 연결</p>
          </Link>
          <Link href="/portal/care" className="rounded-xl border border-line bg-surface p-3 hover:border-sea/60">
            <p className="text-sm font-bold text-ink">펫시터 · 시간제 시터 · 도그워커</p>
            <p className="mt-0.5 text-xs text-ink-soft">돌봄 파트너 등록 요청 (주소 없이 활동 지역만)</p>
          </Link>
          <Link href="/maker" className="rounded-xl border border-line bg-surface p-3 hover:border-sea/60">
            <p className="text-sm font-bold text-ink">브랜드 (간식·장난감·용품)</p>
            <p className="mt-0.5 text-xs text-ink-soft">이미 소개된 브랜드라면 브랜드 페이지의 &quot;정보 관리 요청&quot;, 처음이라면 브랜드·제품 등록 안내에서 신청</p>
          </Link>
        </div>
      </section>

      {open.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-ink">진행 중인 요청</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface text-sm">
            {open.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="rounded-full bg-sea-soft px-2 py-0.5 text-xs font-medium text-sea">{REQUEST_KIND_LABEL[r.kind]}</span>
                <span className="text-ink">{r.summary}</span>
                <span className="ml-auto text-xs text-ink-faint">
                  {REQUEST_STATUS_LABEL[r.status]} · {formatDate(r.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
