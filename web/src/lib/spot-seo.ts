// 검색용 유형 이름 — 칩·필터는 짧은 이름(spot_types.name: "미용·스파")을 그대로 쓰고,
// 페이지 제목·H1·설명은 사람들이 실제로 검색하는 말("애견미용", "애견운동장")로 쓴다.
//  head: 제목 맨 앞 대표 검색어 (애견/반려동물/펫 + 업종 — 지도 앱·업계가 쓰는 이름)
//  alt:  같은 걸 다르게 부르는 말 (강아지·고양이·반려견) — 제목 뒤쪽·설명에 함께 실어 검색 폭을 넓힌다
// 고양이도 받는 업종은 alt 에 "고양이"를 넣는다. 지금은 애견·종합을 한 페이지로 두고, 나중에 고양이 페이지를 나눌 수 있다.

export interface TypeSeo {
  head: string;
  alt: string;
}

export const SPOT_TYPE_SEO: Record<string, TypeSeo> = {
  grooming: { head: "애견미용", alt: "강아지·고양이 미용실" },
  "self-wash": { head: "애견 셀프목욕", alt: "강아지 셀프목욕장" },
  pool: { head: "애견수영장", alt: "강아지 수영장·반려견 수영장" },
  playground: { head: "애견운동장", alt: "강아지 놀이터·반려견 놀이터" },
  cafe: { head: "애견카페", alt: "반려동물 동반 카페·애견동반 카페" },
  boarding: { head: "애견호텔·애견유치원", alt: "강아지·고양이 호텔·위탁" },
  "pet-sitter": { head: "반려동물 펫시터", alt: "강아지·고양이 방문 돌봄" },
  "hourly-sitter": { head: "애견 위탁 돌봄", alt: "시간제 펫시터·강아지 맡기는 곳" },
  "dog-walk": { head: "애견 산책 대행", alt: "강아지 산책·도그워커" },
  "visiting-bath": { head: "애견 방문목욕", alt: "강아지 출장 목욕" },
  "visiting-groom": { head: "애견 출장미용", alt: "강아지·고양이 방문미용" },
  rehab: { head: "반려견 재활운동", alt: "강아지 재활·운동 시설" },
  transport: { head: "펫택시·반려동물 운송", alt: "애견 택시·동물 운송" },
  memorial: { head: "반려동물 장례식장", alt: "동물장묘·강아지·고양이 장례" },
  pharmacy: { head: "동물약국", alt: "반려동물 약국" },
};

/** 유형의 검색용 이름 — 표가 없으면(B2B 등) 표시 이름 그대로 */
export function typeSeo(type: { slug: string; name: string }): TypeSeo {
  return SPOT_TYPE_SEO[type.slug] ?? { head: type.name, alt: type.name };
}

/** 제목: "부산 동래구 애견미용 — 강아지·고양이 미용실 12곳" (같은 이름 구(중구·서구 등)가 많아 시도를 앞에 붙인다) */
export function regionTypeTitle(place: string, type: { slug: string; name: string }, count?: number): string {
  const { head, alt } = typeSeo(type);
  const tail = alt === head ? "" : ` — ${alt}${count ? ` ${count}곳` : ""}`;
  return `${place} ${head}${tail || (count ? ` ${count}곳` : "")}`;
}
