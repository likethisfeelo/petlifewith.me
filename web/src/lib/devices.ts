// ============================================================
// 관리·재활 도구(기기) — 분류·라벨 (순수). 허브 /device 와 기기 페이지 /device/[슬러그].
// 주어는 병원이 아니라 기기다 (claude.md 6-2). 보유 병원 목록은 무료·순위 없음, 체험 가능 업체는 스팟(지도·예약 요청)으로 이어진다.
// 수익은 콘텐츠 게시: 제조사가 의뢰한 글은 sponsor_name 으로 "광고·협찬" 표기가 자동으로 붙고 기기 페이지 상단에 고정된다.
// ============================================================

export const DEVICE_CATEGORIES = ["rehab_equipment", "laser", "monitor", "imaging", "stethoscope", "other"] as const;
export type DeviceCategory = (typeof DEVICE_CATEGORIES)[number];

export const DEVICE_CATEGORY_LABEL: Record<DeviceCategory, string> = {
  rehab_equipment: "재활 운동 기구",
  laser: "레이저·물리치료 기기",
  monitor: "모니터링·측정",
  imaging: "영상",
  stethoscope: "청진·검사",
  other: "기타 관리 도구",
};

export const DEVICE_CATEGORY_BLURB: Record<DeviceCategory, string> = {
  rehab_equipment: "수중 러닝머신·밸런스 기구·경사로 등 관절·근력을 돕는 장비",
  laser: "통증·염증 관리에 쓰이는 기기 — 원리와 사용 목적을 사실대로",
  monitor: "활동량·심박·수면을 재는 기기 — 집에서 쓰는 것 위주",
  imaging: "영상 장비 — 보유처 안내만",
  stethoscope: "청진·검사 도구",
  other: "보조기구·보행 보조·기타",
};

export function isDeviceCategory(v: unknown): v is DeviceCategory {
  return typeof v === "string" && (DEVICE_CATEGORIES as readonly string[]).includes(v);
}

/** 보유처 종류 — hospital: 보유 병원(무료 목록) / trial: 체험 가능 업체(스팟 연결) */
export const DEVICE_SITE_KINDS = ["hospital", "trial"] as const;
export type DeviceSiteKind = (typeof DEVICE_SITE_KINDS)[number];
export const DEVICE_SITE_KIND_LABEL: Record<DeviceSiteKind, string> = { hospital: "보유 병원", trial: "체험 가능 업체" };

export function isDeviceSiteKind(v: unknown): v is DeviceSiteKind {
  return typeof v === "string" && (DEVICE_SITE_KINDS as readonly string[]).includes(v);
}

/** 기기 페이지 색인 조건 — 공개 상태이고 원리 설명이 있어야 한다 (얇은 페이지 방지) */
export function deviceIndexable(d: { published: boolean; summaryMd: string | null }): boolean {
  return d.published && Boolean(d.summaryMd && d.summaryMd.trim().length >= 200);
}
