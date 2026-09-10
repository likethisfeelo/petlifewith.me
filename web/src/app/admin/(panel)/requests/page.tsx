import Link from "next/link";
import { carePersonLabel } from "@app/data";
import { slackRequestsWebhookUrl } from "@/lib/config";
import { formatDate, formatDateTime, idSlugPath } from "@/lib/format";
import { listServiceRequests, regionLabels, type RequestListItem } from "@/lib/queries/requests";
import {
  PROMO_PLAN_LABEL,
  REQUEST_KINDS,
  REQUEST_KIND_LABEL,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABEL,
  type CarePartnerPayload,
  type ExpertPartnerPayload,
  type PromoSlotPayload,
  type RequestKind,
  type RequestStatus,
  type SpotRegisterPayload,
} from "@/lib/requests";
import { AdminPageHeader } from "../../_components/fields";
import { togglePromotionAction } from "../../actions";
import { attachOwnerAction, attachRequestSpotAction, saveRequestNoteAction, setRequestStatusAction, toggleRequestPaidAction } from "../../request-actions";

// 요청함 — 업체 등록·정보 관리·지역 상단 노출·돌봄 파트너 등록 요청을 한 곳에서 본다.
// 흐름: 슬랙 알림 → 여기서 확인 → 종류별 바로가기(스팟 등록·편집·노출 토글)로 처리 → 상태 기록.
// 신청자 이름·연락처·사업자번호는 이 화면(관리자)에만 보인다.

interface Props {
  searchParams: Promise<{ kind?: string; status?: string }>;
}

const STATUS_CHIP: Record<RequestStatus, string> = {
  new: "bg-accent-soft text-accent-deep",
  in_progress: "bg-sea-soft text-sea",
  done: "bg-sage-soft text-sage-deep",
  rejected: "bg-sand text-ink-soft",
};

function isKind(v: string | undefined): v is RequestKind {
  return (REQUEST_KINDS as readonly string[]).includes(v ?? "");
}
function isStatus(v: string | undefined): v is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(v ?? "");
}

function payloadRegionIds(item: RequestListItem): number[] {
  const p = item.request.payload as Record<string, unknown>;
  const ids: number[] = [];
  if (typeof p.regionId === "number") ids.push(p.regionId);
  if (Array.isArray(p.regionIds)) for (const n of p.regionIds) if (typeof n === "number") ids.push(n);
  return ids;
}

/** 종류별 요청 내용 → 표시 행 */
function payloadRows(item: RequestListItem, labels: Record<number, string>): Array<[string, string]> {
  const { kind, payload } = item.request;
  const region = (id: number | null | undefined) => (id ? (labels[id] ?? `지역 #${id}`) : "-");
  if (kind === "spot_register") {
    const p = payload as SpotRegisterPayload;
    return [
      ["업체명", p.businessName],
      ["업종", p.typeSlug],
      ["지역", region(p.regionId)],
      ["주소", p.addressRoad ?? "-"],
      ["전화", p.phone ?? "-"],
      ["홈페이지", p.website ?? "-"],
      ["카카오톡", p.kakaoUrl ?? "-"],
      ["인스타그램", p.instagramUrl ?? "-"],
      ["소개", p.intro ?? "-"],
    ];
  }
  if (kind === "care_partner") {
    const p = payload as CarePartnerPayload;
    return [
      ["호칭", carePersonLabel(p.typeSlug)],
      ["활동명", p.displayName],
      ["활동 지역", p.regionIds.map(region).join(", ")],
      ["요금", p.priceText ?? "-"],
      ["활동 시간", p.hoursText ?? "-"],
      ["카카오톡", p.kakaoUrl ?? "-"],
      ["소개", p.intro],
    ];
  }
  if (kind === "expert_partner") {
    const p = payload as ExpertPartnerPayload;
    return [
      ["종류", p.kind],
      ["활동명", p.displayName],
      ["자격·경력", p.credentialsText ?? "-"],
      ["방식", p.modes.join(", ")],
      ["주제", p.topics.join(", ") || "-"],
      ["요금", p.priceText ?? "-"],
      ["소개", p.intro],
    ];
  }
  if (kind === "promo_slot") {
    const p = payload as PromoSlotPayload;
    return [
      ["형", PROMO_PLAN_LABEL[p.plan] ?? p.plan],
      ["노출 지역", region(p.regionId)],
      ["업체명", p.businessName ?? "-"],
    ];
  }
  return [];
}

function filterHref(kind: RequestKind | null, status: RequestStatus | null): string {
  const q = new URLSearchParams();
  if (kind) q.set("kind", kind);
  if (status) q.set("status", status);
  const s = q.toString();
  return s ? `/admin/requests?${s}` : "/admin/requests";
}

export default async function AdminRequestsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : null;
  const status = isStatus(sp.status) ? sp.status : null;
  const items = await listServiceRequests({ kind, status });
  const labels = await regionLabels(items.flatMap(payloadRegionIds));
  const slackOn = Boolean(slackRequestsWebhookUrl());
  const openCount = items.filter((i) => i.request.status === "new").length;

  return (
    <div>
      <AdminPageHeader
        title="요청함"
        description="업체 등록 · 정보 관리 · 지역 상단 노출 · 돌봄 파트너 등록 요청이 모두 여기로 들어옵니다. 슬랙 알림을 받은 뒤 여기서 확인하고, 종류별 바로가기로 처리한 다음 상태를 남기세요. 연락처·사업자번호는 확인 용도로만 씁니다."
      />
      <p className="mt-3 text-xs text-ink-faint">
        표시 {items.length}건 · 접수 {openCount}건 · 슬랙 알림 {slackOn ? "켜짐" : "꺼짐 (SLACK_REQUESTS_WEBHOOK_URL 또는 SLACK_BOOKING_WEBHOOK_URL 미설정 — 저장만 됨)"}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        <Link href={filterHref(kind, null)} className={`rounded-full px-3 py-1 font-medium ${status === null ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
          상태 전체
        </Link>
        {REQUEST_STATUSES.map((s) => (
          <Link key={s} href={filterHref(kind, s)} className={`rounded-full px-3 py-1 font-medium ${status === s ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {REQUEST_STATUS_LABEL[s]}
          </Link>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        <Link href={filterHref(null, status)} className={`rounded-full px-3 py-1 font-medium ${kind === null ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
          종류 전체
        </Link>
        {REQUEST_KINDS.map((k) => (
          <Link key={k} href={filterHref(k, status)} className={`rounded-full px-3 py-1 font-medium ${kind === k ? "bg-ink text-white" : "border border-line text-ink-soft hover:bg-sand"}`}>
            {REQUEST_KIND_LABEL[k]}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">해당하는 요청이 없습니다.</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <RequestCard key={item.request.id} item={item} labels={labels} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ item, labels }: { item: RequestListItem; labels: Record<number, string> }) {
  const r = item.request;
  const rows = payloadRows(item, labels);
  const spotPath = r.spotId && item.spotSlug ? idSlugPath("place", r.spotId, item.spotSlug) : null;
  const makerPath = r.makerId && item.makerSlug ? idSlugPath("maker", r.makerId, item.makerSlug) : null;
  const closed = r.status === "done" || r.status === "rejected";

  return (
    <li id={`request-${r.id}`} className={`rounded-xl border p-4 text-sm ${closed ? "border-line bg-surface/60" : r.status === "new" ? "border-accent/30 bg-surface" : "border-line bg-surface"}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">#{r.id}</span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CHIP[r.status]}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
        <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{REQUEST_KIND_LABEL[r.kind]}</span>
        <span>{formatDateTime(r.createdAt)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.slackSentAt ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>{r.slackSentAt ? "슬랙 전송됨" : "슬랙 미전송"}</span>
        {r.kind === "promo_slot" && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.paidAt ? "bg-sage-soft text-sage-deep" : "bg-sand text-ink-faint"}`}>{r.paidAt ? `입금 확인 ${formatDate(r.paidAt)}` : "입금 미확인"}</span>
        )}
        {r.handledAt && <span className="text-ink-faint">처리 {formatDate(r.handledAt)}</span>}
      </div>

      {/* 대상 — 연결된 스팟·메이커 */}
      {(r.spotId || r.makerId) && (
        <p className="mt-2 text-sm">
          <span className="text-xs text-ink-faint">대상 </span>
          {r.spotId ? (
            <>
              <Link href={`/admin/spots/${r.spotId}`} className="font-bold text-ink hover:underline">
                {item.spotName ?? `스팟 #${r.spotId}`}
              </Link>
              {spotPath && (
                <Link href={spotPath} className="ml-2 text-xs text-sea hover:underline">
                  공개 페이지 →
                </Link>
              )}
              {r.kind === "promo_slot" && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${item.promoted ? "bg-accent-soft text-accent-deep" : "bg-sand text-ink-faint"}`}>{item.promoted ? "지역 상단 노출 중" : "노출 꺼짐"}</span>}
            </>
          ) : (
            <>
              <Link href={`/admin/makers/${r.makerId}`} className="font-bold text-ink hover:underline">
                {item.makerName ?? `메이커 #${r.makerId}`}
              </Link>
              {makerPath && (
                <Link href={makerPath} className="ml-2 text-xs text-sea hover:underline">
                  공개 페이지 →
                </Link>
              )}
            </>
          )}
        </p>
      )}

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">신청인</dt>
          <dd className="text-ink">{r.requesterName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-ink-faint">연락처 (비공개)</dt>
          <dd className="text-ink">{r.contact}</dd>
        </div>
        {item.memberName && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">회원</dt>
            <dd className="text-ink">{item.memberName} <span className="text-ink-faint">— 처리하면 이 회원이 /me 에서 직접 관리</span></dd>
          </div>
        )}
        {r.bizRegistrationNo && (
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">사업자번호 (비공개)</dt>
            <dd className="text-ink">{r.bizRegistrationNo}</dd>
          </div>
        )}
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">{k}</dt>
            <dd className="whitespace-pre-line break-all text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {r.message && <p className="mt-2 whitespace-pre-line rounded-lg bg-sand px-3 py-2 text-xs text-ink-soft">{r.message}</p>}

      {/* 종류별 바로가기 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {(r.kind === "spot_register" || r.kind === "care_partner") &&
          (r.spotId ? (
            <Link href={`/admin/spots/${r.spotId}`} className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-sand">
              스팟 편집 →
            </Link>
          ) : (
            <Link href={`/admin/spots/new?from=${r.id}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-white hover:opacity-90">
              {r.kind === "care_partner" ? "파트너로 등록 (값 채워짐) →" : "스팟으로 등록 (값 채워짐) →"}
            </Link>
          ))}
        {r.kind === "expert_partner" && r.status !== "done" && (
          <Link href={`/admin/experts/new?from=${r.id}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-white hover:opacity-90">
            전문가로 등록 (값 채워짐) →
          </Link>
        )}
        {r.kind === "spot_claim" && r.spotId && (
          <Link href={`/admin/spots/${r.spotId}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-white hover:opacity-90">
            편집기에서 반영 →
          </Link>
        )}
        {r.kind === "maker_claim" && r.makerId && (
          <Link href={`/admin/makers/${r.makerId}`} className="rounded-full bg-ink px-3 py-1 font-semibold text-white hover:opacity-90">
            편집기에서 반영 →
          </Link>
        )}
        {(r.kind === "spot_claim" || r.kind === "maker_claim") && r.userId && (r.spotId || r.makerId) && r.status !== "done" && (
          <form action={attachOwnerAction}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="rounded-full bg-sage px-3 py-1 font-semibold text-white hover:opacity-90" title="사업자번호·연락처로 운영자임을 확인한 뒤 누르세요">
              소유자로 연결 (완료)
            </button>
          </form>
        )}
        {r.kind === "promo_slot" && (
          <>
            <form action={toggleRequestPaidAction}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" className={`rounded-full px-3 py-1 font-semibold ${r.paidAt ? "bg-sand text-ink-soft" : "bg-sage text-white"}`}>
                {r.paidAt ? "입금 확인 취소" : "입금 확인"}
              </button>
            </form>
            {r.spotId ? (
              <form action={togglePromotionAction}>
                <input type="hidden" name="spotId" value={r.spotId} />
                <button type="submit" className={`rounded-full px-3 py-1 font-semibold ${item.promoted ? "bg-accent-soft text-accent-deep" : "bg-ink text-white"}`}>
                  {item.promoted ? "지역 상단 노출 끄기" : "지역 상단 노출 켜기"}
                </button>
              </form>
            ) : (
              <form action={attachRequestSpotAction} className="flex items-center gap-1">
                <input type="hidden" name="id" value={r.id} />
                <input name="spotId" type="number" min={1} placeholder="스팟 id" className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-ink" />
                <button type="submit" className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-ink hover:bg-sand">
                  업체 연결
                </button>
                <Link href={`/admin/spots?q=${encodeURIComponent((r.payload as PromoSlotPayload).businessName ?? "")}`} className="text-sea hover:underline">
                  스팟 찾기
                </Link>
              </form>
            )}
          </>
        )}
      </div>

      {/* 상태 · 메모 */}
      <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap gap-1.5">
          {REQUEST_STATUSES.filter((s) => s !== r.status).map((s) => (
            <form key={s} action={setRequestStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={s} />
              <button type="submit" className={`rounded-full px-3 py-1 text-xs font-medium ${s === "done" ? "bg-sage text-white" : s === "rejected" ? "border border-line text-ink-soft hover:bg-sand" : "border border-line text-ink hover:bg-sand"}`}>
                {s === "new" ? "접수로 되돌리기" : `${REQUEST_STATUS_LABEL[s]}${s === "in_progress" ? "으로" : "로"} 표시`}
              </button>
            </form>
          ))}
        </div>
        <form action={saveRequestNoteAction} className="ml-auto flex w-full items-start gap-1.5 sm:w-auto">
          <input type="hidden" name="id" value={r.id} />
          <textarea name="adminNote" rows={1} defaultValue={r.adminNote ?? ""} placeholder="운영 메모 (안내한 내용, 결제 방법 등)" className="w-full min-w-[16rem] rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-ink" />
          <button type="submit" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink hover:bg-sand">
            메모 저장
          </button>
        </form>
      </div>
    </li>
  );
}
