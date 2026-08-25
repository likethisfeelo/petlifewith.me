// URL 슬러그. 한글은 유지한다 — /place/[id]-[slug] 에서 유일성은 id 가 담당하고
// 슬러그는 가독성·검색 키워드 역할만 한다.
export function slugify(input: string, fallback = "item"): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || fallback;
}
