"use client";

// 스팟 목록 브라우저 — 전체 너비. 위 도구 막대(제목·필터·보기 전환·유형 칩, 모든 보기에서 같은 자리)
// · 가운데 카드/목록/지도 · 오른쪽 패널(필터 또는 미리보기 — 같은 자리).
//
// 미리보기: 카드는 진짜 링크(/place/...)라 크롤러·새 탭·공유는 그대로. 그냥 누르면 주소만 /place/... 로 바꾸고
// 미리보기 창을 연다 (새로고침하면 장소 페이지, 뒤로 가기는 창 닫기).
//   PC 1280px 이상: 목록을 밀어내는 오른쪽 칸 / 그보다 좁으면 오른쪽에서 덮는 창 / 모바일: 아래 시트(60%, 펼치면 전체)
// 보기: [카드 | 목록 | 지도] — 기본은 지도. ?view=card|list 로 공유되고 마지막 선택은 브라우저에 기억한다.
//   PC: 좁은 목록 + 지도. 카드에 마우스를 올리면 핀 강조, 핀을 누르면 목록이 그 카드로 스크롤되고 미리보기.
//   모바일: 막대의 [목록|지도] (카드는 PC 만), 지도는 한 화면, 핀·필터 → 아래 시트.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MultiMap, type MapBounds, type MapPin } from "@/components/map/multi-map";
import {
  EMPTY_FILTERS,
  FILTER_LABEL,
  countActiveFilters,
  filterSpots,
  parseView,
  placeIdFromPath,
  withinBounds,
  countSubAreas,
  subAreaOf,
  type BrowserFilters,
  type BrowserSort,
  type BrowserSpot,
  type BrowserView,
} from "@/lib/spot-browser";
import { SpotPreview, TierBadge } from "./spot-preview";
import { TypeTabs, type TypeTab } from "./type-tabs";

const VIEW_KEY = "spot-view";
const PAGE_SIZE = 60;

export function SpotBrowser({
  items,
  title,
  sidebar,
  registerCard,
  emptyText = "아직 등록된 곳이 없습니다.",
  typeTabs = [],
  subAreas = [],
}: {
  /** 일반구 칩 (천안시 → 동남구·서북구) — 주소로 나눠 이 화면 안에서 좁힌다 (?gu=) */
  subAreas?: string[];
  /** 유형 칩 — 도구 막대 아래 한 줄 */
  typeTabs?: TypeTab[];
  items: BrowserSpot[];
  title: ReactNode;
  /** 필터 패널 아래쪽에 붙일 서버 콘텐츠 (다른 유형·지역 바꾸기) */
  sidebar?: ReactNode;
  /** "여기에 내 업체를 소개하세요" 카드 */
  registerCard?: { href: string; label: string } | null;
  emptyText?: string;
  showSidebar?: boolean;
}) {
  const [filters, setFilters] = useState<BrowserFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<BrowserSort>("default");
  const [view, setView] = useState<BrowserView>("map");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [sheetFull, setSheetFull] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listUrl = useRef<string | null>(null);
  const pushed = useRef(false);
  const cardRefs = useRef(new Map<number, HTMLElement>());

  const byId = useMemo(() => new Map(items.map((s) => [s.id, s])), [items]);
  const [subArea, setSubArea] = useState<string | null>(null);
  const subCounts = useMemo(() => countSubAreas(items, subAreas), [items, subAreas]);
  const areaItems = useMemo(() => (subArea ? items.filter((s) => subAreaOf(s.address, subAreas) === subArea) : items), [items, subArea, subAreas]);
  const filtered = useMemo(() => filterSpots(areaItems, filters, sort), [areaItems, filters, sort]);
  const pickSubArea = useCallback((g: string | null) => {
    setSubArea(g);
    setBounds(null);
    const url = new URL(window.location.href);
    if (g) url.searchParams.set("gu", g);
    else url.searchParams.delete("gu");
    if (!placeIdFromPath(url.pathname)) {
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      listUrl.current = url.pathname + url.search;
    }
  }, []);
  const shown = useMemo(() => (view === "map" ? withinBounds(filtered, bounds) : filtered), [filtered, bounds, view]);
  // 시도 전체처럼 수백~수천 곳이면 목록은 나눠 그린다 (지도는 전부 — 묶음으로 보인다)
  const [limit, setLimit] = useState(PAGE_SIZE);
  useEffect(() => setLimit(PAGE_SIZE), [filters, sort, bounds, view]);
  const pins = useMemo<MapPin[]>(
    () => filtered.filter((s) => s.lat != null && s.lng != null).map((s) => ({ id: s.id, name: s.name, lat: s.lat!, lng: s.lng!, strong: s.monetizable && (s.tier === "paid" || s.tier === "promoted"), photo: s.heroUrl })),
    [filtered],
  );
  const selected = selectedId != null ? byId.get(selectedId) ?? null : null;
  const activeCount = countActiveFilters(filters);

  // 처음: ?view= → 기억한 보기 → 지도(기본)
  useEffect(() => {
    listUrl.current = window.location.pathname + window.location.search;
    const gu = new URLSearchParams(window.location.search).get("gu");
    if (gu && subAreas.includes(gu)) setSubArea(gu);
    let v = parseView(new URLSearchParams(window.location.search).get("view"));
    if (!v) {
      try {
        v = parseView(localStorage.getItem(VIEW_KEY));
      } catch {
        v = null;
      }
    }
    if (v) setView(v);
  }, []);

  const changeView = useCallback((v: BrowserView) => {
    setView(v);
    setBounds(null);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // 기억 못 해도 괜찮다
    }
    const url = new URL(window.location.href);
    if (v === "map") url.searchParams.delete("view");
    else url.searchParams.set("view", v);
    if (!placeIdFromPath(url.pathname)) {
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      listUrl.current = url.pathname + url.search;
    }
  }, []);

  const open = useCallback(
    (id: number) => {
      const s = byId.get(id);
      if (!s) return;
      setSelectedId(id);
      setFiltersOpen(false);
      setSheetFull(false);
      if (placeIdFromPath(window.location.pathname)) window.history.replaceState(window.history.state, "", s.href);
      else {
        window.history.pushState(window.history.state, "", s.href);
        pushed.current = true;
      }
    },
    [byId],
  );

  const close = useCallback(() => {
    setSelectedId(null);
    if (!placeIdFromPath(window.location.pathname)) return;
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else if (listUrl.current) window.history.replaceState(window.history.state, "", listUrl.current);
  }, []);

  // 뒤로/앞으로 가기: 주소가 장소면 그 미리보기, 아니면 닫기
  useEffect(() => {
    const onPop = () => {
      const id = placeIdFromPath(window.location.pathname);
      if (id && byId.has(id)) setSelectedId(id);
      else {
        pushed.current = false;
        setSelectedId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [byId]);

  useEffect(() => {
    if (selectedId == null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, close]);

  // 핀을 누르면 목록에서 그 카드로
  const selectFromMap = useCallback(
    (id: number) => {
      open(id);
      const idx = shown.findIndex((x) => x.id === id);
      if (idx >= limit) setLimit(idx + 1);
      requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    },
    [open, shown, limit],
  );

  const onCardClick = (e: React.MouseEvent<HTMLAnchorElement>, id: number) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(id);
  };

  const isMap = view === "map";
  const filterPanel = (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-xs font-bold text-ink">조건</legend>
        <div className="space-y-1.5">
          {(Object.keys(FILTER_LABEL) as Array<keyof BrowserFilters>).map((k) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <input type="checkbox" checked={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.checked }))} className="accent-[var(--color-sea,#0b7285)]" />
              {FILTER_LABEL[k]}
            </label>
          ))}
        </div>
        {activeCount > 0 && (
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="mt-2 text-xs font-medium text-sea hover:underline">
            조건 지우기
          </button>
        )}
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-ink">정렬</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as BrowserSort)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink">
          <option value="default">기본 순</option>
          <option value="name">이름순 (가나다)</option>
        </select>
      </label>
    </div>
  );

  const cards = (compact: boolean) => (
    <>
    <ul className={compact || view === "list" ? "divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" : `grid gap-3 sm:grid-cols-2 ${selected || filtersOpen ? "lg:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-3 2xl:grid-cols-4"}`}>
      {shown.slice(0, limit).map((s) => (
        <li
          key={s.id}
          ref={(el) => {
            if (el) cardRefs.current.set(s.id, el);
            else cardRefs.current.delete(s.id);
          }}
          onMouseEnter={() => setHoverId(s.id)}
          onMouseLeave={() => setHoverId((h) => (h === s.id ? null : h))}
        >
          <SpotItem spot={s} row={compact || view === "list"} active={s.id === selectedId} onClick={(e) => onCardClick(e, s.id)} />
        </li>
      ))}
      {registerCard && !compact && view !== "list" && (
        <li>
          <a href={registerCard.href} className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line p-5 text-center text-sm text-ink-soft hover:border-sea hover:text-sea">
            <span className="text-2xl" aria-hidden="true">＋</span>
            <span className="font-bold">{registerCard.label}</span>
            <span className="text-xs">무료 등록 · 링크 페이지 제공</span>
          </a>
        </li>
      )}
    </ul>
    {shown.length > limit && (
      <button type="button" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)} className="mt-3 w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-ink hover:bg-sand">
        더 보기 <span className="text-ink-faint">({(shown.length - limit).toLocaleString("ko-KR")}곳 남음)</span>
      </button>
    )}
    </>
  );

  const panelOpen = !!selected || filtersOpen;
  const openFilters = () => {
    if (selected) close();
    setFiltersOpen((o) => !o);
  };
  const activeChips = (Object.keys(FILTER_LABEL) as Array<keyof BrowserFilters>).filter((k) => filters[k]);
  const viewBtn = (v: BrowserView, label: string, extra = "") => (
    <button
      key={v}
      type="button"
      onClick={() => changeView(v)}
      aria-pressed={view === v}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${extra} ${view === v ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"}`}
    >
      {label}
    </button>
  );

  // 오른쪽 패널 내용 — 업체를 고르면 미리보기, 아니면 필터(조건·정렬·다른 유형·지역)
  const panelBody = selected ? (
    <SpotPreview item={selected} />
  ) : (
    <div className="space-y-6">
      {filterPanel}
      {sidebar}
    </div>
  );
  const panelTitle = selected ? "미리보기" : `필터${activeCount > 0 ? ` · ${activeCount}개 적용` : ""}`;
  const closePanel = () => (selected ? close() : setFiltersOpen(false));

  return (
    <div>
      {/* 도구 막대 — 모든 보기에서 같은 자리 (PC·모바일 공통, 스크롤해도 붙음): 제목·개수 | 필터 · 보기 전환 / 유형 칩 */}
      <div className="sticky top-14 z-20 -mx-1 mb-3 space-y-2 bg-cream/95 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <h2 className="mr-auto min-w-0 truncate text-sm font-bold text-ink">
            {title} <span className="font-medium text-ink-faint">{shown.length.toLocaleString("ko-KR")}곳{shown.length !== items.length ? ` / 전체 ${items.length.toLocaleString("ko-KR")}` : ""}</span>
          </h2>
          <button
            type="button"
            onClick={openFilters}
            aria-expanded={filtersOpen && !selected}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${filtersOpen && !selected ? "border-ink bg-ink text-cream" : "border-line bg-surface text-ink hover:bg-sand"}`}
          >
            ⚙ 필터{activeCount > 0 ? ` ${activeCount}` : ""}
          </button>
          <div role="group" aria-label="보기 방식" className="flex shrink-0 rounded-full border border-line bg-surface p-0.5">
            {viewBtn("card", "카드", "hidden md:inline-block")}
            {viewBtn("list", "목록")}
            {viewBtn("map", "지도")}
          </div>
        </div>
        {typeTabs.length > 1 && <TypeTabs tabs={typeTabs} variant="map" />}
      </div>

      {subAreas.length > 0 && (
        <nav aria-label="구 고르기" className="mb-3 flex flex-wrap items-center gap-2">
          {[null, ...subAreas].map((g) => {
            const active = g === subArea;
            const n = g ? subCounts[g] ?? 0 : items.length;
            return (
              <button
                key={g ?? "all"}
                type="button"
                onClick={() => pickSubArea(g)}
                aria-pressed={active}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${active ? "border-sea bg-sea text-white" : "border-line bg-surface text-ink hover:border-sea hover:text-sea"}`}
              >
                {g ?? "구 전체"} <span className={`text-xs font-medium ${active ? "text-white/80" : "text-ink-faint"}`}>{n.toLocaleString("ko-KR")}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* 켜 둔 조건 — 패널을 닫아도 보이고 ✕ 로 바로 끈다 */}
      {(activeChips.length > 0 || sort !== "default" || bounds) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          {activeChips.map((k) => (
            <button key={k} type="button" onClick={() => setFilters((f) => ({ ...f, [k]: false }))} className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea hover:bg-sea hover:text-white">
              {FILTER_LABEL[k]} ✕
            </button>
          ))}
          {sort !== "default" && (
            <button type="button" onClick={() => setSort("default")} className="rounded-full bg-sea-soft px-2.5 py-1 font-medium text-sea hover:bg-sea hover:text-white">
              이름순 ✕
            </button>
          )}
          {bounds && (
            <button type="button" onClick={() => setBounds(null)} className="rounded-full bg-sand px-2.5 py-1 font-medium text-ink-soft hover:text-ink">
              지도에 보이는 곳만 ✕
            </button>
          )}
        </div>
      )}

      <div className={`grid gap-4 ${panelOpen ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="min-w-0">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">{emptyText}</p>
          ) : isMap ? (
            <>
              {/* PC: 좁은 목록 + 지도 */}
              <div className="hidden gap-3 md:grid md:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
                <div className="h-[calc(100vh-14rem)] min-h-[420px] overflow-y-auto pr-1">{shown.length ? cards(true) : <NoMatch />}</div>
                <MultiMap pins={pins} hoverId={hoverId} selectedId={selectedId} onSelect={selectFromMap} onSearchArea={setBounds} className="h-[calc(100vh-14rem)] min-h-[420px]" />
              </div>
              {/* 모바일: 지도 한 화면 — 핀을 누르면 아래 시트, 목록은 위 [목록] */}
              <div className="md:hidden">
                <MultiMap pins={pins} hoverId={null} selectedId={selectedId} onSelect={open} onSearchArea={setBounds} className="h-[calc(100dvh-13rem)] min-h-[360px]" />
              </div>
            </>
          ) : shown.length ? (
            cards(false)
          ) : (
            <NoMatch />
          )}
        </div>

        {/* 오른쪽 패널(미리보기·필터): xl 은 옆 칸, md~xl 은 덮는 창, 모바일은 아래 시트 */}
        {panelOpen && (
          <>
            <button type="button" aria-label={`${panelTitle} 닫기`} onClick={closePanel} className="fixed inset-0 z-40 bg-black/30 xl:hidden" />
            <aside
              role="dialog"
              aria-label={selected ? `${selected.name} 미리보기` : "필터"}
              className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-surface shadow-2xl transition-[height] md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[400px] md:rounded-none xl:sticky xl:top-36 xl:z-0 xl:h-[calc(100vh-14rem)] xl:min-h-[420px] xl:w-auto xl:rounded-2xl xl:border xl:border-line xl:shadow-none ${
                sheetFull ? "h-[100dvh] rounded-none" : "h-[60dvh]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <button type="button" onClick={() => setSheetFull((f) => !f)} className="text-xs font-semibold text-ink-soft md:hidden" aria-label={sheetFull ? "시트 줄이기" : "시트 펼치기"}>
                  <span className="mx-auto mb-1 block h-1 w-10 rounded-full bg-line" aria-hidden="true" />
                  {sheetFull ? "줄이기 ▾" : "펼치기 ▴"}
                </button>
                <span className="hidden text-xs font-semibold text-ink-faint md:inline">{panelTitle}</span>
                <button type="button" onClick={closePanel} className="rounded-full px-2 py-1 text-lg leading-none text-ink-soft hover:bg-sand" aria-label="닫기">
                  ×
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">{panelBody}</div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

function NoMatch() {
  return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">조건에 맞는 곳이 없습니다. 필터를 줄이거나 지도를 넓혀 보세요.</p>;
}

function SpotItem({ spot, row, active, onClick }: { spot: BrowserSpot; row: boolean; active: boolean; onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  // 측정: 상단 노출(유료) 카드는 노출·클릭을 따로 센다 (docs/측정기획_GA4_GTM.md)
  const track =
    spot.tier === "promoted" && spot.monetizable
      ? { "data-track": "promo_click", "data-track-impression": "promo_impression" }
      : { "data-track": "entity_click", "data-track-link-area": "directory_list" };
  const meta = [spot.status === "operating" ? "영업 중" : spot.status === "closed" ? "폐업" : spot.status === "suspended" ? "휴업" : "확인 필요", spot.hours, spot.parking && "주차 정보", spot.booking && "예약·상담"].filter(Boolean);
  if (row) {
    return (
      <a href={spot.href} onClick={onClick} {...track} data-track-entity-type="spot" data-track-entity-id={String(spot.id)} className={`flex items-center gap-3 px-4 py-3 hover:bg-sand/60 ${active ? "bg-sea-soft/60" : ""}`}>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{spot.name}</span>
            <TierBadge tier={spot.tier} monetizable={spot.monetizable} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-soft">{spot.address ?? spot.regionLabel}</span>
        </span>
        <span className="shrink-0 text-[11px] text-ink-faint">{meta[0]}</span>
      </a>
    );
  }
  return (
    <a
      href={spot.href}
      onClick={onClick}
      {...track}
      data-track-entity-type="spot"
      data-track-entity-id={String(spot.id)}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-md ${active ? "border-sea ring-2 ring-sea/30" : spot.tier === "paid" && spot.monetizable ? "border-ink/40" : "border-line"}`}
    >
      {spot.heroUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={spot.heroUrl} alt="" loading="lazy" className="aspect-[16/9] w-full bg-sand object-cover" />
      )}
      <span className="flex flex-1 flex-col p-4">
        <span className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-sea-soft px-2 py-0.5 font-medium text-sea">{spot.typeName}</span>
          <TierBadge tier={spot.tier} monetizable={spot.monetizable} />
        </span>
        <span className="mt-2 block text-base font-bold text-ink group-hover:underline">{spot.name}</span>
        {spot.address && <span className="mt-1 line-clamp-1 block text-sm text-ink-soft">{spot.address}</span>}
        <span className="mt-auto block pt-3 text-xs text-ink-faint">{meta.join(" · ")}</span>
      </span>
    </a>
  );
}
