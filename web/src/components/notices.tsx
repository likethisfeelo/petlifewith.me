// 고지·표기 컴포넌트 — 누락이 제재 사유가 되는 것들 (claude.md 6-2, 6-4)

/** 제휴 링크가 포함된 모든 페이지에 자동 노출되는 수수료 고지 */
export function AffiliateDisclosure() {
  return (
    <p className="rounded-lg border border-line bg-sand px-4 py-3 text-xs text-ink-soft">
      이 페이지에는 쿠팡 파트너스 등 제휴 링크가 포함되어 있으며, 링크를 통해 구매하면 사이트가 일정액의
      수수료를 제공받습니다. 구매 가격에는 차이가 없습니다.
    </p>
  );
}

/** 의료 인접 콘텐츠 하단 고정 — "이상 신호를 감지하면 병원으로" 결론을 템플릿이 보장한다 */
export function MedicalNotice() {
  return (
    <div className="rounded-lg border border-sage/30 bg-sage-soft px-4 py-3 text-sm text-sage-deep">
      <p className="font-semibold">이 글은 진료를 대체하지 않습니다</p>
      <p className="mt-1 text-[13px] leading-relaxed">
        집에서 살펴보는 방법과 기기·서비스 정보는 참고용입니다. 여기서 다룬 변화나 이상 신호가 이어진다면
        가까운 동물병원에서 확인하세요. 진료 시기를 놓치지 않는 것이 가장 중요합니다.
      </p>
    </div>
  );
}

/** 수의사 감수 표기 — 사실일 때만 렌더 (감수 전 발행은 DB 게이트가 막는다) */
export function VetReviewBadge({ reviewerName, reviewedAt }: { reviewerName: string; reviewedAt?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-sage-deep">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M8 1.5 2.5 3.7v3.6c0 3.4 2.3 6 5.5 7.2 3.2-1.2 5.5-3.8 5.5-7.2V3.7L8 1.5Zm-.9 9-2.3-2.3.9-.9 1.4 1.4 3.2-3.2.9.9-4.1 4.1Z" />
      </svg>
      {reviewerName} 수의사 감수{reviewedAt ? ` · ${reviewedAt.slice(0, 7).replace("-", ".")}` : ""}
    </span>
  );
}

/** 노출 광고 라벨 — 광고와 정보를 섞지 않는다 (표시광고법) */
export function AdLabel() {
  return (
    <span className="inline-flex items-center rounded border border-ink-faint/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-faint">
      광고
    </span>
  );
}

/** 협찬 표기 — 업체가 비용·제품을 지원한 글. 본문 앞에서 광고임을 밝힌다 (표시광고법) */
export function SponsoredNote({ sponsorName }: { sponsorName: string }) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-soft/50 px-4 py-3 text-sm text-ink">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        <AdLabel />
        {sponsorName} 협찬 콘텐츠입니다
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        제작비 또는 제품을 지원받고 쓴 글입니다. 지원 여부와 무관하게 확인한 사실만 적고, 효과를 단정하지 않습니다.
      </p>
    </div>
  );
}

/** 협찬 배지 — 목록·머리글에 짧게 */
export function SponsoredBadge({ sponsorName }: { sponsorName: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-deep">
      <AdLabel />
      {sponsorName} 협찬
    </span>
  );
}

/** 배지 — "인증" 이 아니라 사실 진술. 기준일을 함께 표기한다 (claude.md 7) */
export function FactBadge({ label, verifiedAt, note }: { label: string; verifiedAt?: string | null; note?: string | null }) {
  const title = [note, verifiedAt ? `기준일 ${verifiedAt}` : null].filter(Boolean).join(" · ");
  return (
    <span
      title={title || undefined}
      className="inline-flex items-center gap-1 rounded-full bg-honey-soft px-2.5 py-1 text-xs font-medium text-honey"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M6.6 11.6 3.4 8.4l1-1 2.2 2.2 5-5 1 1-6 6Z" />
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Zm0-1.3A5.7 5.7 0 1 0 8 2.3a5.7 5.7 0 0 0 0 11.4Z" />
      </svg>
      {label}
      {verifiedAt && <span className="font-normal text-honey/80">({verifiedAt.slice(0, 10)} 기준)</span>}
    </span>
  );
}

/**
 * 데이터 출처·기준일 표기 — 스팟 정보 부정확 리스크 대응 (기획서 SECTION 07).
 * 공공데이터 행은 원천(행정안전부 지방행정 인허가데이터)과 관리번호까지 명시한다.
 */
export function DataReferenceNote({
  date,
  source,
  licenseMgmtNo,
}: {
  date: string | null;
  source?: string | null;
  licenseMgmtNo?: string | null;
}) {
  const parts: string[] = [];
  if (source === "public_data") {
    parts.push("출처: 행정안전부 지방행정 인허가데이터 (공공데이터포털 data.go.kr) 확인 자료");
  } else if (source === "direct") {
    parts.push("출처: 직접 확인 정보");
  }
  if (date) parts.push(`기준일 ${date}`);
  if (source === "public_data" && licenseMgmtNo) parts.push(`관리번호 ${licenseMgmtNo}`);
  if (parts.length === 0) return null;
  return <p className="text-xs text-ink-faint">{parts.join(" · ")}</p>;
}

/** B2B 참고 디렉토리 안내 — 소비자 시설과 구분한다 (의약품 도매·의료용구 판매 등) */
export function B2BNote() {
  return (
    <p className="mt-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
      이 유형은 일반 소비자 대상 시설이 아니라 <strong>업체 간(B2B) 인허가 정보</strong>입니다.
      광고·추천 없이 행정안전부 인허가 사실 정보만 참고용으로 정리합니다.
    </p>
  );
}

/** 동물약국 안내 (claude.md 6-2) — 진단·처방의 주체는 수의사임을 명시한다 */
export function PharmacyNote() {
  return (
    <p className="mt-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
      동물용의약품 중 처방대상 의약품은 수의사 처방전이 있어야 구입할 수 있습니다. 증상이 있다면
      자가 투약보다 동물병원 진료가 먼저입니다. 구입·투여 전에 수의사·약사와 상의하세요.
    </p>
  );
}

/**
 * 재활·한방·특수치료 시행처 목록 안내 (claude.md 6-2) — 병원 추천·순위가 아니라
 * "치료법을 어디서 받을 수 있는가"의 사실 목록임을 명시한다.
 */
export function RehabListNote() {
  return (
    <p className="mt-3 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
      이 목록은 병원 추천이 아닙니다. 치료법을 시행한다고 <strong>공개된 사실</strong>만 지역별 가나다순으로
      정리하며, 광고·순위·평점·비용 비교를 두지 않습니다. 치료 적합 여부와 비용은 진료 시 수의사와 직접
      상의하세요.
    </p>
  );
}

/** 회원 글 안내 — 관리자 확인은 거쳤지만 감수는 아니다. 진료 대체 아님을 명시한다 (claude.md 6-2) */
export function MemberPostNote({ authorName }: { authorName: string }) {
  return (
    <p className="mt-4 rounded-lg border border-line bg-sand px-4 py-3 text-sm text-ink-soft">
      <strong className="text-ink">{authorName}</strong> 님이 쓴 회원 글입니다. 개인의 경험과 관찰을 나눈 글이며 수의사 감수를
      거친 정보가 아닙니다. 우리 개의 상황에 맞는 판단은 동물병원과 상의하세요.
    </p>
  );
}
