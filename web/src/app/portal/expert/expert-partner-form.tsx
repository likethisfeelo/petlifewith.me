"use client";

// 상담 전문가 등록 요청 — expert_partner. 병원명·주소는 받지 않는다. 운영자가 확인한 뒤 프로필을 만든다.
import Link from "next/link";
import { Req, RequestForm, inputClass, labelClass } from "@/components/requests/request-form";
import { REQUEST_LIMITS } from "@/lib/requests";
import { CONSULT_MODES, CONSULT_MODE_LABEL, EXPERT_KINDS, EXPERT_KIND_BLURB, EXPERT_KIND_LABEL, MEDICAL_ADJACENT_KINDS } from "@/lib/reservations";

export function ExpertPartnerForm() {
  return (
    <RequestForm
      kind="expert_partner"
      submitLabel="등록 요청 보내기"
      requesterLabel="이름"
      doneBody={
        <>
          <p>운영자가 자격·경력을 확인한 뒤 프로필을 만들고 남겨 주신 연락처로 안내합니다. 수의사·수의 테크니션 상담은 생활 상담으로 한정됩니다.</p>
          <p className="mt-2">
            <Link href="/consult" className="font-medium underline">
              온라인 상담 보기
            </Link>
          </p>
        </>
      }
      messagePlaceholder="자격 확인에 도움이 되는 내용(자격증 종류·발급 기관·경력)을 적어 주세요. 확인은 운영자가 별도로 요청드립니다."
    >
      {(v) => (
        <fieldset className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <legend className="px-1 text-sm font-bold text-ink">활동 정보</legend>
          <div>
            <span className={labelClass}>
              어떤 전문가인가요
              <Req />
            </span>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {EXPERT_KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer gap-2 rounded-xl border border-line bg-cream/40 p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-sand">
                  <input type="radio" name="expertKind" value={k} required defaultChecked={v.expertKind === k} className="mt-0.5" />
                  <span>
                    <span className="font-bold text-ink">{EXPERT_KIND_LABEL[k]}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{EXPERT_KIND_BLURB[k]}</span>
                    {MEDICAL_ADJACENT_KINDS.includes(k) && <span className="mt-0.5 block text-[11px] text-ink-faint">생활 상담 한정 · 진단·처방 아님</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="displayName" className={labelClass}>
                활동명 (페이지에 표시)
                <Req />
              </label>
              <input id="displayName" name="displayName" required minLength={2} maxLength={REQUEST_LIMITS.businessName} defaultValue={v.displayName} className={inputClass} />
            </div>
            <div>
              <label htmlFor="credentialsText" className={labelClass}>
                자격·경력 (한 줄)
              </label>
              <input id="credentialsText" name="credentialsText" maxLength={REQUEST_LIMITS.short} defaultValue={v.credentialsText} placeholder="반려동물행동지도사 2급 · 경력 8년" className={inputClass} />
            </div>
          </div>
          <div>
            <span className={labelClass}>
              상담 방식
              <Req />
            </span>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {CONSULT_MODES.map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="checkbox" name="modesCheck" value={m} defaultChecked={(v.modes ?? "").split(",").includes(m)} onChange={(e) => {
                    const form = e.currentTarget.form;
                    if (!form) return;
                    const hidden = form.querySelector<HTMLInputElement>("input[name=modes]");
                    const checked = [...form.querySelectorAll<HTMLInputElement>("input[name=modesCheck]:checked")].map((x) => x.value);
                    if (hidden) hidden.value = checked.join(",");
                  }} />
                  {CONSULT_MODE_LABEL[m]}
                </label>
              ))}
              <input type="hidden" name="modes" defaultValue={v.modes ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="topics" className={labelClass}>
                상담 주제 (쉼표로)
              </label>
              <input id="topics" name="topics" maxLength={REQUEST_LIMITS.short} defaultValue={v.topics} placeholder="분리불안, 야간 짖음, 노견 산책" className={inputClass} />
            </div>
            <div>
              <label htmlFor="priceText" className={labelClass}>
                요금 (문구)
              </label>
              <input id="priceText" name="priceText" maxLength={REQUEST_LIMITS.short} defaultValue={v.priceText} placeholder="30분 30,000원" className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor="intro" className={labelClass}>
              소개
              <Req />
            </label>
            <textarea id="intro" name="intro" required minLength={10} rows={5} maxLength={REQUEST_LIMITS.intro} defaultValue={v.intro} placeholder="어떤 고민을 함께 볼 수 있는지 (10자 이상). 병원명·주소·진단·처방 표현은 넣지 않습니다." className={inputClass} />
          </div>
        </fieldset>
      )}
    </RequestForm>
  );
}
