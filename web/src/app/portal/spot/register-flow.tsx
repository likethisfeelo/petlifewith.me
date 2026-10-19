"use client";

// 업체 등록 흐름 — ① 내 업체 찾기 → ② 있으면 "내 업체예요"(정보 관리 요청), 없으면 "새로 등록" → ③ 연락처 남기면 끝.
// 한 화면에서 끝난다 (페이지 이동 없음). 로그인 없이 찾고 보낼 수 있다 — 로그인 회원이면 요청이 계정에 연결된다.
// 들어오는 길: ?region=<id>&type=<slug> (지역·유형 배너) → 찾기 순서에 반영 / ?spot=<id> (장소 페이지) → 바로 ②
// 진행 상태는 주소(?spot= / ?step=new / ?q=)에 남겨 새로고침·가입 후 돌아와도 이어진다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/components/tracker";
import type { OwnerSearchHit } from "@/lib/queries/spot-register";
import type { RegionOption, SpotTypeOption } from "@/lib/queries/requests";
import { phoneDigits } from "@/lib/spot-register";
import { ClaimForm } from "@/app/claim/[target]/[id]/claim-form";
import { SpotRegisterForm } from "./spot-register-form";

type Step = "find" | "claim" | "new";

const ev = (action: string, extra: Record<string, string | number> = {}) => track("tool_action", { tool: "spot_register", action, ...extra });

export function RegisterFlow({ types, regions }: { types: SpotTypeOption[]; regions: RegionOption[] }) {
  const [step, setStep] = useState<Step>("find");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<OwnerSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<OwnerSearchHit | null>(null);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [typeSlug, setTypeSlug] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const searched = useRef(false);

  // 처음: 주소에서 이어받기
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const rid = Number(p.get("region"));
    if (regions.some((r) => r.id === rid)) setRegionId(rid);
    const t = p.get("type");
    if (t && types.some((x) => x.slug === t)) setTypeSlug(t);
    const spot = Number(p.get("spot"));
    if (Number.isSafeInteger(spot) && spot > 0) {
      fetch(`/api/portal/spot-search?id=${spot}`)
        .then((r) => r.json())
        .then((d: { hits: OwnerSearchHit[] }) => {
          if (d.hits[0]) {
            setPicked(d.hits[0]);
            setStep("claim");
          }
        })
        .catch(() => {});
    } else if (p.get("step") === "new") setStep("new");
    if (p.get("q")) setQ(p.get("q")!);
  }, [regions, types]);

  // 주소에 진행 상태 남기기 (지역·유형은 그대로)
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete("spot");
    u.searchParams.delete("step");
    u.searchParams.delete("q");
    if (step === "claim" && picked) u.searchParams.set("spot", String(picked.id));
    if (step === "new") u.searchParams.set("step", "new");
    if (step !== "claim" && q.trim()) u.searchParams.set("q", q.trim());
    window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
  }, [step, picked, q]);

  // 찾기 (입력 멈추면 0.25초 뒤)
  useEffect(() => {
    if (step !== "find") return;
    const text = q.trim();
    if (text.replace(/\s/g, "").length < 2) {
      setHits(null);
      return;
    }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: text });
      if (regionId) params.set("region", String(regionId));
      if (typeSlug) params.set("type", typeSlug);
      fetch(`/api/portal/spot-search?${params}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { hits: OwnerSearchHit[] }) => {
          setHits(d.hits);
          setLoading(false);
          if (!searched.current) {
            searched.current = true;
            ev("search");
          }
          if (d.hits.length === 0) ev("not_found");
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, regionId, typeSlug, step]);

  const go = (s: Step, hit: OwnerSearchHit | null = null) => {
    setPicked(hit);
    setStep(s);
    ev(s === "claim" ? "pick_existing" : s === "new" ? "start_new" : "back_to_find");
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const region = regionId ? regions.find((r) => r.id === regionId) : null;
  const typeName = typeSlug ? types.find((t) => t.slug === typeSlug)?.name : null;
  const qPhone = phoneDigits(q);

  return (
    <div ref={topRef} className="scroll-mt-20">
      <Steps step={step} />

      {step === "find" && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <label htmlFor="owner-q" className="text-base font-bold text-ink">
            먼저 내 업체가 이미 있는지 찾아볼게요
          </label>
          <p className="mt-1 text-sm text-ink-soft">공공데이터로 미리 올려 둔 업체가 많아요. 있으면 새로 적을 필요 없이 &quot;내 업체예요&quot;만 누르면 돼요.</p>
          <input
            id="owner-q"
            type="search"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="업체명 또는 전화번호 (예: 멍멍스파, 02-123-4567)"
            autoComplete="off"
            className="mt-4 h-12 w-full rounded-xl border border-line bg-cream px-4 text-base text-ink placeholder:text-ink-faint focus:border-sea focus:outline-none focus:ring-2 focus:ring-sea/30"
          />
          {(region || typeName) && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
              먼저 보여 줄 곳:
              {region && (
                <button type="button" onClick={() => setRegionId(null)} className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea" aria-label={`${region.sigunguName} 조건 빼기`}>
                  {region.sidoName} {region.sigunguName} ✕
                </button>
              )}
              {typeName && (
                <button type="button" onClick={() => setTypeSlug(null)} className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea" aria-label={`${typeName} 조건 빼기`}>
                  {typeName} ✕
                </button>
              )}
            </p>
          )}

          <div className="mt-4" aria-live="polite">
            {loading && hits === null && <p className="text-sm text-ink-faint">찾는 중…</p>}
            {hits && hits.length > 0 && (
              <ul className="space-y-2">
                {hits.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">
                        {h.name}
                        {h.status === "closed" && <span className="ml-1.5 text-xs font-normal text-ink-faint">(폐업으로 표시됨)</span>}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {h.typeName} · {h.address ?? h.regionLabel}
                      </span>
                    </span>
                    <HitAction hit={h} onPick={() => go("claim", h)} />
                  </li>
                ))}
              </ul>
            )}
            {hits && hits.length === 0 && (
              <p className="rounded-xl bg-sand/60 px-4 py-3 text-sm text-ink-soft">
                &quot;{q.trim()}&quot;(으)로 등록된 업체가 없어요. 아래에서 바로 새로 등록해 주세요 — 1분이면 끝나요.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">{hits && hits.length > 0 ? "목록에 내 업체가 없나요?" : "찾지 않고 바로 등록해도 돼요."}</p>
            <button type="button" onClick={() => go("new")} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:opacity-90">
              새 업체로 등록하기 →
            </button>
          </div>
        </div>
      )}

      {step === "claim" && picked && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <button type="button" onClick={() => go("find")} className="text-xs font-medium text-sea hover:underline">
            ← 다른 업체 찾기
          </button>
          <div className="mt-3 rounded-xl bg-sea-soft px-4 py-3">
            <p className="text-xs font-semibold text-sea">선택한 업체</p>
            <p className="mt-0.5 text-lg font-extrabold text-ink">{picked.name}</p>
            <p className="text-xs text-ink-soft">
              {picked.typeName} · {picked.address ?? picked.regionLabel} ·{" "}
              <Link href={picked.href} target="_blank" className="underline">
                페이지 보기 ↗
              </Link>
            </p>
          </div>
          {picked.owner === "none" ? (
            <>
              <p className="mt-4 text-sm font-semibold text-ink">연락받을 분만 적어 주시면 끝이에요.</p>
              <p className="text-sm text-ink-soft">운영자가 사장님이 맞는지 확인하고 연락드려요. 확인되면 정보를 직접 고치고 무료 링크 페이지도 쓸 수 있어요.</p>
              <ClaimForm targetType="spot" targetId={picked.id} backPath={picked.href} />
            </>
          ) : (
            <div className="mt-4">
              <HitAction hit={picked} onPick={() => {}} />
            </div>
          )}
        </div>
      )}

      {step === "new" && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <button type="button" onClick={() => go("find")} className="text-xs font-medium text-sea hover:underline">
            ← 먼저 찾아보기
          </button>
          <p className="mt-3 text-base font-bold text-ink">새 업체 등록 — 연락처만 있으면 접수돼요</p>
          <SpotRegisterForm
            types={types}
            regions={regions}
            initial={{ businessName: q.trim() && !qPhone ? q.trim() : "", phone: qPhone ? q.trim() : "", regionId, typeSlug }}
            onPickDuplicate={(h) => go("claim", h)}
          />
        </div>
      )}
    </div>
  );
}

function HitAction({ hit, onPick }: { hit: OwnerSearchHit; onPick: () => void }) {
  if (hit.owner === "mine")
    return (
      <Link href={`/me/business/spot/${hit.id}`} className="rounded-full bg-sage-deep px-4 py-2 text-xs font-bold text-white">
        이미 내 업체예요 · 관리하기
      </Link>
    );
  if (hit.owner === "other")
    return (
      <span className="text-right text-xs text-ink-soft">
        다른 회원이 관리 중이에요.
        <br />
        본인 업체라면{" "}
        <Link href="/consult" className="font-medium text-sea underline">
          운영자에게 문의
        </Link>
      </span>
    );
  return (
    <button type="button" onClick={onPick} className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-cream hover:opacity-90">
      내 업체예요
    </button>
  );
}

function Steps({ step }: { step: Step }) {
  const items = [
    { n: 1, label: "내 업체 찾기", on: step === "find" },
    { n: 2, label: step === "new" ? "새로 등록" : step === "claim" ? "내 업체 확인" : "확인 또는 등록", on: step !== "find" },
    { n: 3, label: "연락처 남기면 끝", on: false },
  ];
  return (
    <ol className="flex items-center gap-2 text-xs sm:text-sm" aria-label="진행 단계">
      {items.map((it, i) => (
        <li key={it.n} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${it.on ? "bg-ink text-cream" : "bg-sand text-ink-faint"}`}>{it.n}</span>
          <span className={it.on ? "font-semibold text-ink" : "text-ink-faint"}>{it.label}</span>
          {i < items.length - 1 && <span className="text-ink-faint" aria-hidden>›</span>}
        </li>
      ))}
    </ol>
  );
}
