// ============================================================
// 재활·한방·특수치료 — 치료법 정의 (주어는 병원이 아니라 치료법, claude.md 6-2)
//
// 공개 페이지(/rehab)와 시행처 목록(rehab_sites.modalities)이 공유하는 어휘.
// 설명은 "무엇이며 어떤 목적으로 쓰이는가"까지만 쓴다. 효과를 단정하지 않는다
// ("관절염에 효과적" 금지 — "○○ 목적으로 사용된다" 까지가 정보).
// ============================================================

export interface RehabModalityDef {
  slug: string;
  name: string;
  /** 목록 칩용 짧은 이름 */
  short: string;
  /** 사실 서술. 효과 단정·병원 평가 금지 */
  description: string;
  /** 이 목록에서 시행처를 어떤 근거로 확인했는가 (공개 표기) */
  basis: string;
}

export const REHAB_MODALITIES: readonly RehabModalityDef[] = [
  {
    slug: "acupuncture",
    name: "침치료 (CVA)",
    short: "침치료",
    description:
      "가는 침을 경혈에 놓는 수의 침술. CVA(Certified Veterinary Acupuncturist)는 Chi University 의 수의 침술 과정을 수료한 수의사에게 주어지는 자격 명칭이다.",
    basis: "CVA 공식 지도 등재 여부 또는 병원이 공개한 진료 안내",
  },
  {
    slug: "oriental",
    name: "한방 진료 (양·한방 통합)",
    short: "한방",
    description:
      "침·뜸·한약 등 한의학 방식의 수의 진료. 서양의학 진료와 함께 운영하는 곳은 스스로 '양·한방 통합 진료'라고 표기한다.",
    basis: "병원이 공개한 진료 안내 또는 상호에 명시된 표기",
  },
  {
    slug: "rehab",
    name: "재활의학 (물리치료·운동치료)",
    short: "재활의학",
    description:
      "수술 후·노령·근골격 질환의 기능 회복을 목적으로 하는 물리치료와 운동치료. 재활의학과 또는 재활센터를 두고 운영한다고 공개한 곳을 모았다.",
    basis: "병원·체인이 공개한 진료과 안내 또는 상호에 명시된 표기",
  },
  {
    slug: "hydrotherapy",
    name: "수중 재활 (수중런닝머신·재활 수영)",
    short: "수중재활",
    description:
      "물의 부력으로 관절에 실리는 무게를 줄인 상태에서 걷거나 수영하게 하는 재활 운동. 수중런닝머신(언더워터 트레드밀) 또는 재활 수영장을 보유했다고 공개한 곳.",
    basis: "병원이 공개한 장비·시설 안내",
  },
  {
    slug: "manual-therapy",
    name: "도수치료",
    short: "도수치료",
    description: "손으로 관절과 근육을 움직여 가동 범위 회복을 돕는 물리치료의 한 방식.",
    basis: "병원이 공개한 진료 안내",
  },
  {
    slug: "eswt",
    name: "체외충격파 (ESWT)",
    short: "체외충격파",
    description: "몸 밖에서 만든 충격파를 조직에 가하는 치료. 근골격 질환에 사용된다.",
    basis: "병원이 공개한 장비 안내",
  },
  {
    slug: "hbot",
    name: "고압산소치료",
    short: "고압산소",
    description: "대기압보다 높은 압력의 챔버 안에서 산소를 공급하는 치료.",
    basis: "병원이 공개한 장비 안내",
  },
  {
    slug: "laser",
    name: "레이저·전기자극 치료",
    short: "레이저·전기자극",
    description: "치료용 레이저 조사, 전기 자극(TENS·NMES 등)을 이용하는 물리치료.",
    basis: "병원이 공개한 장비 안내",
  },
  {
    slug: "university",
    name: "수의과대학 부속 동물병원",
    short: "대학 부속",
    description:
      "수의과대학이 운영하는 교육·진료 기관. 신경·근골격 재활을 포함한 여러 진료과를 두고 있으며, 1차 동물병원의 의뢰(리퍼)로 진료하는 경우가 많다.",
    basis: "대학 공식 안내",
  },
];

const bySlug = new Map(REHAB_MODALITIES.map((m) => [m.slug, m]));

export function getRehabModality(slug: string): RehabModalityDef | undefined {
  return bySlug.get(slug);
}

export function isRehabModalitySlug(slug: string): boolean {
  return bySlug.has(slug);
}

/** 정의 순서대로 정렬한 유효 슬러그 목록. 모르는 슬러그는 버린다 (호출부가 리포트). */
export function normalizeModalitySlugs(slugs: readonly string[]): { valid: string[]; unknown: string[] } {
  const set = new Set(slugs.map((s) => s.trim()).filter(Boolean));
  const unknown = [...set].filter((s) => !bySlug.has(s));
  const valid = REHAB_MODALITIES.map((m) => m.slug).filter((s) => set.has(s));
  return { valid, unknown };
}
