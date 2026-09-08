"use client";

// 노견생활 신체 지도 — 강아지 그림의 부위(카테고리)를 올리면 이름이, 누르면 오른쪽 패널에
// 관찰 포인트(Q&A)와 그 카테고리의 글이 뜬다. 데이터는 data/src/guides/categories.ts.
// 진단·치료 판단은 하지 않는다 — 패널 끝에 "병원과 상의" 를 고정한다 (claude.md 6-2).
import Link from "next/link";
import { useEffect, useState, type KeyboardEvent } from "react";
import type { GuideCategoryDef } from "@app/data";

export interface MapPost {
  slug: string;
  title: string;
  summary: string | null;
  authorName: string | null;
}

interface Hotspot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

// 그림 좌표계(viewBox 0 0 640 400) 위의 부위 위치
const HOTSPOTS: Record<string, Hotspot> = {
  eye: { cx: 524, cy: 134, rx: 44, ry: 36 },
  teeth: { cx: 572, cy: 178, rx: 42, ry: 30 },
  mind: { cx: 492, cy: 98, rx: 40, ry: 26 },
  heart: { cx: 436, cy: 216, rx: 44, ry: 36 },
  weight: { cx: 336, cy: 260, rx: 62, ry: 30 },
  skin: { cx: 322, cy: 176, rx: 74, ry: 26 },
  joint: { cx: 262, cy: 302, rx: 56, ry: 46 },
  rear: { cx: 212, cy: 220, rx: 36, ry: 34 },
};

function Dog() {
  // 귀엽고 단순하게: 둥근 머리·통통한 몸·늘어진 귀·짧은 다리. 색은 사이트 팔레트의 따뜻한 베이지.
  return (
    <g>
      <ellipse cx="352" cy="352" rx="218" ry="15" fill="#ede3d2" />
      {/* 꼬리 — 굵은 선 두 겹으로 외곽선 효과 */}
      <path d="M208 200 C168 188, 146 150, 170 118" fill="none" stroke="#c9a273" strokeWidth="30" strokeLinecap="round" />
      <path d="M208 200 C168 188, 146 150, 170 118" fill="none" stroke="#e2c197" strokeWidth="26" strokeLinecap="round" />
      {/* 뒷다리 */}
      <rect x="222" y="262" width="36" height="80" rx="18" fill="#e2c197" stroke="#c9a273" strokeWidth="2" />
      <rect x="268" y="270" width="36" height="72" rx="18" fill="#efd5ae" stroke="#c9a273" strokeWidth="2" />
      {/* 앞다리 */}
      <rect x="402" y="262" width="36" height="80" rx="18" fill="#e2c197" stroke="#c9a273" strokeWidth="2" />
      <rect x="448" y="270" width="36" height="72" rx="18" fill="#efd5ae" stroke="#c9a273" strokeWidth="2" />
      {/* 몸통 */}
      <rect x="196" y="158" width="302" height="142" rx="71" fill="#efd5ae" stroke="#c9a273" strokeWidth="2" />
      <ellipse cx="346" cy="262" rx="112" ry="32" fill="#f8ead6" />
      {/* 머리 */}
      <circle cx="508" cy="148" r="64" fill="#efd5ae" stroke="#c9a273" strokeWidth="2" />
      {/* 주둥이·코·입 */}
      <ellipse cx="566" cy="172" rx="44" ry="31" fill="#f8ead6" stroke="#c9a273" strokeWidth="2" />
      <ellipse cx="598" cy="162" rx="11" ry="9" fill="#2b241c" />
      <path d="M572 186 q11 10 24 1" fill="none" stroke="#2b241c" strokeWidth="2.4" strokeLinecap="round" />
      {/* 귀 (늘어진) */}
      <path d="M472 96 C438 104, 428 168, 454 198 C472 214, 496 190, 492 154 C490 128, 486 108, 472 96 Z" fill="#d9ad7c" stroke="#c9a273" strokeWidth="2" />
      {/* 눈·볼 */}
      <circle cx="534" cy="138" r="7.5" fill="#2b241c" />
      <circle cx="537" cy="135" r="2.6" fill="#fff" />
      <path d="M524 120 q10 -6 20 -1" fill="none" stroke="#c9a273" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="548" cy="160" rx="10" ry="6" fill="#f3b8a2" opacity="0.6" />
      {/* 목줄 */}
      <path d="M462 198 C490 216, 522 216, 550 202" fill="none" stroke="#d4531f" strokeWidth="9" strokeLinecap="round" />
    </g>
  );
}

export function SeniorBodyMap({ areas, postsByCategory }: { areas: GuideCategoryDef[]; postsByCategory: Record<string, MapPost[]> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // /topic/senior-life#joint 처럼 부위가 지정돼 들어오면 바로 펼친다 (글 페이지의 카테고리 칩이 이렇게 연결)
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && areas.some((a) => a.slug === hash)) setSelected(hash);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [areas]);

  const select = (slug: string) => {
    const next = selected === slug ? null : slug;
    setSelected(next);
    try {
      window.history.replaceState(null, "", next ? `#${next}` : window.location.pathname);
    } catch {
      // 히스토리 조작이 막힌 환경은 무시
    }
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, slug: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(slug);
    }
  };

  const active = areas.find((a) => a.slug === selected) ?? null;
  const tip = areas.find((a) => a.slug === hovered) ?? null;
  const tipSpot = tip ? HOTSPOTS[tip.slug] : null;

  return (
    <section id="body-map" className="mt-8">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex justify-between text-xs text-ink-faint">
            <span>부위에 올리면 이름이, 누르면 관찰 포인트와 글이 뜹니다</span>
            <span className="hidden sm:inline">다시 누르면 닫힙니다</span>
          </div>
          <svg viewBox="0 0 640 400" role="img" aria-label="노견 신체 영역 지도" className="mt-2 h-auto w-full overflow-visible">
            <Dog />
            {areas.map((a) => {
              const h = HOTSPOTS[a.slug];
              if (!h) return null;
              const isActive = selected === a.slug;
              const isHover = hovered === a.slug;
              return (
                <g
                  key={a.slug}
                  role="button"
                  tabIndex={0}
                  aria-label={a.name}
                  aria-pressed={isActive}
                  className="cursor-pointer outline-none"
                  onMouseEnter={() => setHovered(a.slug)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(a.slug)}
                  onBlur={() => setHovered(null)}
                  onClick={() => select(a.slug)}
                  onKeyDown={(e) => onKey(e, a.slug)}
                >
                  <ellipse
                    cx={h.cx}
                    cy={h.cy}
                    rx={h.rx}
                    ry={h.ry}
                    fill={isActive || isHover ? "rgba(212,83,31,0.16)" : "transparent"}
                    stroke={isActive || isHover ? "rgba(212,83,31,0.55)" : "transparent"}
                    strokeWidth="2"
                  />
                  <circle cx={h.cx} cy={h.cy} r="6" fill="none" stroke="#d4531f" strokeWidth="1.5" opacity="0.5" className="pl-pulse" />
                  <circle cx={h.cx} cy={h.cy} r={isActive ? 8 : 6} fill="#d4531f" stroke="#fff" strokeWidth="2" />
                </g>
              );
            })}
            {tip && tipSpot && (
              <g pointerEvents="none" transform={`translate(${Math.min(Math.max(tipSpot.cx, 80), 560)} ${tipSpot.cy - tipSpot.ry - 14})`}>
                <rect x="-78" y="-40" width="156" height="34" rx="17" fill="#2b241c" />
                <text x="0" y="-19" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
                  {tip.name}
                </text>
                <text x="0" y="-8" textAnchor="middle" fontSize="9.5" fill="#fff" opacity="0.75">
                  {tip.questions[0]?.q}
                </text>
              </g>
            )}
          </svg>
        </div>

        <aside className="min-h-[18rem] rounded-2xl border border-line bg-surface p-5 shadow-sm" aria-live="polite">
          {!active ? (
            <div className="text-sm leading-relaxed text-ink-soft">
              <p className="font-semibold text-ink">그림의 점을 누르세요.</p>
              <p className="mt-2">
                관절이 먼저 눈에 들어오면 관절부터, 밤에 서성이면 인지부터. 지금 밟히는 신호 하나만 골라도 됩니다.
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-extrabold text-ink">{active.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{active.blurb}</p>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {active.questions.map((item) => (
                  <li key={item.q} className="py-3">
                    <p className="text-sm font-semibold text-ink">Q. {item.q}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{item.a}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <p className="text-xs font-semibold text-ink">관련 글</p>
                {(postsByCategory[active.slug] ?? []).length === 0 ? (
                  <p className="mt-1 text-xs text-ink-faint">이 부위의 글은 준비 중입니다.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {postsByCategory[active.slug]!.map((p) => (
                      <li key={p.slug}>
                        <Link href={`/guide/${p.slug}`} className="text-sm font-medium text-accent-deep hover:underline">
                          {p.title} →
                        </Link>
                        {p.authorName && <span className="ml-1 text-xs text-ink-faint">회원 글 · {p.authorName}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-4 text-xs text-ink-faint">여기 적힌 것은 집에서 살펴보는 관찰 포인트입니다. 신호가 이어지면 동물병원에서 확인하세요.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-ink">목록으로도 들어갈 수 있습니다</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {areas.map((a) => {
            const on = selected === a.slug;
            const count = (postsByCategory[a.slug] ?? []).length;
            return (
              <button
                key={a.slug}
                type="button"
                onClick={() => select(a.slug)}
                aria-pressed={on}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/50 hover:bg-accent-soft/50"
                }`}
              >
                <span className="block text-sm font-bold text-ink">
                  {a.name}
                  {count > 0 && <span className="ml-1.5 text-xs font-medium text-ink-faint">{count}편</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ink-soft">{a.questions.map((q) => q.q).join(" · ")}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
