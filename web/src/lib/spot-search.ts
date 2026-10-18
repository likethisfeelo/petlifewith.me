// ============================================================
// 스팟 첫 화면·시도 페이지 — 지역 검색과 유형 묶음 (순수 함수, 테스트 대상)
// 지역 검색은 펫세권 검색과 같은 규칙: 시군구 이름 앞부분 → 포함 → 시도+시군구, 일반구(영통구 → 수원시)도 찾는다.
// ============================================================
import { GENERAL_GU } from "./petsegwon/stats";
import type { RegionTile } from "./regions";

const squash = (s: string) => s.replace(/[\s·]/g, "");

export interface SpotRegionOption {
  /** 시군구 id — 없으면 시도 전체 */
  regionId: number | null;
  sidoSlug: string;
  sigunguSlug: string | null;
  label: string;
}

/** 시도 이름 짧게 (서울특별시 → 서울, 경기도 → 경기, 충청북도 → 충북) */
export function shortSido(name: string): string {
  const special: Record<string, string> = { 충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전라남도: "전남", 경상북도: "경북", 경상남도: "경남", 전북특별자치도: "전북" };
  if (special[name]) return special[name];
  return name.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, "");
}

export function searchSpotRegions(tiles: RegionTile[], query: string, limit = 12): SpotRegionOption[] {
  const q = squash(query.trim());
  if (!q) return [];
  const scored: Array<{ o: SpotRegionOption; score: number }> = [];
  const seen = new Set<number>();
  for (const r of tiles) {
    const g = squash(r.sigunguName);
    const short = shortSido(r.sidoName);
    const fulls = [squash(`${r.sidoName}${r.sigunguName}`), squash(`${short}${r.sigunguName}`)];
    const score = g.startsWith(q) ? 0 : g.includes(q) ? 1 : fulls.some((f) => f.startsWith(q)) ? 2 : fulls.some((f) => f.includes(q)) ? 3 : -1;
    if (score < 0) continue;
    seen.add(r.id);
    scored.push({ o: { regionId: r.id, sidoSlug: r.sidoSlug, sigunguSlug: r.sigunguSlug, label: `${short} ${r.sigunguName}` }, score });
  }
  // 일반구 → 그 시 ("(영통구 포함)")
  for (const [sido, city, gus] of GENERAL_GU) {
    const r = tiles.find((t) => t.sigunguName === city && shortSido(t.sidoName) === sido);
    if (!r || seen.has(r.id)) continue;
    const gu = gus.find((x) => squash(x).startsWith(q) || (q.length >= 2 && squash(x).includes(q)));
    if (!gu) continue;
    seen.add(r.id);
    scored.push({ o: { regionId: r.id, sidoSlug: r.sidoSlug, sigunguSlug: r.sigunguSlug, label: `${sido} ${city} (${gu} 포함)` }, score: squash(gu).startsWith(q) ? 0 : 1 });
  }
  // 시도 전체
  const sidos = new Map<string, string>();
  for (const t of tiles) sidos.set(t.sidoSlug, t.sidoName);
  for (const [slug, name] of sidos) {
    const names = [squash(name), squash(shortSido(name))];
    if (names.some((n) => n.startsWith(q))) scored.push({ o: { regionId: null, sidoSlug: slug, sigunguSlug: null, label: `${shortSido(name)} 전체` }, score: 4 });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.o.label.localeCompare(b.o.label, "ko"))
    .slice(0, limit)
    .map((x) => x.o);
}

/** 고른 지역·유형 → 목록 주소 (SEO 페이지) */
export function spotSearchHref(o: Pick<SpotRegionOption, "sidoSlug" | "sigunguSlug">, typeSlug: string | null): string {
  if (!o.sigunguSlug) return `/spot/${o.sidoSlug}`;
  return `/spot/${o.sidoSlug}/${o.sigunguSlug}${typeSlug ? `/${typeSlug}` : ""}`;
}

// ---------- 유형 묶음 (목적별) ----------

export interface TypeGroup {
  key: string;
  title: string;
  hint: string;
  slugs: string[];
}

export const TYPE_GROUPS: TypeGroup[] = [
  { key: "play", title: "놀이·운동", hint: "뛰고 헤엄치고 몸 쓰는 곳", slugs: ["playground", "pool", "rehab", "cafe"] },
  { key: "care", title: "관리·미용", hint: "씻기고 다듬는 곳", slugs: ["grooming", "self-wash", "visiting-bath", "visiting-groom"] },
  { key: "stay", title: "맡기기·돌봄", hint: "자리를 비울 때", slugs: ["boarding", "pet-sitter", "hourly-sitter", "dog-walk"] },
  { key: "move", title: "이동", hint: "병원·공항·여행 길", slugs: ["transport"] },
];

/** 유형 목록을 묶음으로 — 묶음에 없는 소비자 유형은 "그 밖의 곳"으로 */
export function groupTypes<T extends { slug: string; monetizable: boolean }>(types: T[]): { groups: Array<TypeGroup & { types: T[] }>; facts: T[] } {
  const bySlug = new Map(types.map((t) => [t.slug, t]));
  const used = new Set<string>();
  const groups = TYPE_GROUPS.map((g) => {
    const list = g.slugs.map((s) => bySlug.get(s)).filter((t): t is T => !!t);
    list.forEach((t) => used.add(t.slug));
    return { ...g, types: list };
  });
  // 광고 없는 사실 정보 유형(장묘·약국)은 따로
  const facts = types.filter((t) => !used.has(t.slug) && !t.monetizable);
  const rest = types.filter((t) => !used.has(t.slug) && t.monetizable);
  if (rest.length) groups.push({ key: "etc", title: "그 밖의 곳", hint: "", slugs: rest.map((t) => t.slug), types: rest });
  return { groups: groups.filter((g) => g.types.length > 0), facts };
}
