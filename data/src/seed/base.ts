// 기본 시드 — 토픽(클러스터), 스팟 유형, 지역. 몇 번을 실행해도 안전(upsert).
import { getDb, closeDb } from "../db/client.js";
import { regions, spotTypes, topics } from "../db/schema.js";
import { REGIONS } from "../regions/regions.js";

const TOPICS = [
  {
    slug: "senior-life",
    name: "노견생활",
    description:
      "변화를 느낀 순간부터. 신체 영역별로 살펴볼 것, 집에서 확인하는 방법, 도울 수 있는 것들.",
    phase: "initial",
    sortOrder: 1,
  },
  {
    slug: "play",
    name: "놀이",
    description: "노즈워크, 실내놀이, 지능놀이. 우리 개는 뭘 할 때 즐거울까.",
    phase: "initial",
    sortOrder: 2,
  },
  {
    slug: "care",
    name: "케어·힐링",
    description: "마사지, 스파, 셀프목욕, 발톱·귀 관리.",
    phase: "secondary",
    sortOrder: 3,
  },
  {
    slug: "treats",
    name: "간식",
    description: "수제간식, 성분 읽는 법, 알러지, 훈련용 간식.",
    phase: "secondary",
    sortOrder: 4,
  },
  {
    slug: "spot",
    name: "스팟",
    description: "놀이터, 수영장, 셀프목욕장, 스파 — 반려동물이 즐거운 곳.",
    phase: "always",
    sortOrder: 5,
  },
] as const;

// 장묘는 monetizable=false — 광고를 붙이지 않는다 (기획서 4-1).
const SPOT_TYPES = [
  { slug: "grooming", name: "미용·스파", description: "동물미용업 인허가 기반 시딩", monetizable: true, sortOrder: 1 },
  { slug: "self-wash", name: "셀프목욕", description: "공공데이터에 없어 직접 발굴한다", monetizable: true, sortOrder: 2 },
  { slug: "pool", name: "수영장", description: "직접 발굴·재분류로 채운다", monetizable: true, sortOrder: 3 },
  { slug: "playground", name: "놀이터", description: "직접 발굴·재분류로 채운다", monetizable: true, sortOrder: 4 },
  { slug: "boarding", name: "유치원·위탁", description: "동물위탁관리업 인허가 기반 시딩", monetizable: true, sortOrder: 5 },
  { slug: "visiting-bath", name: "방문목욕", description: "등록 형태가 제각각 — 부분 시딩 + 직접 발굴", monetizable: true, sortOrder: 6 },
  { slug: "visiting-groom", name: "방문미용", description: "직접 발굴", monetizable: true, sortOrder: 7 },
  { slug: "rehab", name: "재활·수중런닝", description: "보유 여부는 공공데이터에 없다 — 직접 발굴", monetizable: true, sortOrder: 8 },
  { slug: "transport", name: "이동·운송", description: "동물운송업 인허가 기반 시딩", monetizable: true, sortOrder: 9 },
  { slug: "memorial", name: "장묘", description: "광고 없음. 인허가 기반 사실 정보만 담담하게 정리한다", monetizable: false, sortOrder: 10 },
] as const;

async function main() {
  const db = getDb();

  for (const t of TOPICS) {
    await db
      .insert(topics)
      .values(t)
      .onConflictDoUpdate({
        target: topics.slug,
        set: { name: t.name, description: t.description, phase: t.phase, sortOrder: t.sortOrder, updatedAt: new Date() },
      });
  }
  console.log(`topics: ${TOPICS.length}건 upsert`);

  for (const s of SPOT_TYPES) {
    await db
      .insert(spotTypes)
      .values(s)
      .onConflictDoUpdate({
        target: spotTypes.slug,
        set: { name: s.name, description: s.description, monetizable: s.monetizable, sortOrder: s.sortOrder },
      });
  }
  console.log(`spot_types: ${SPOT_TYPES.length}건 upsert`);

  let inserted = 0;
  for (const r of REGIONS) {
    const res = await db.insert(regions).values(r).onConflictDoNothing().returning({ id: regions.id });
    if (res.length > 0) inserted += 1;
  }
  console.log(`regions: 전체 ${REGIONS.length}건 중 신규 ${inserted}건`);

  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb();
  process.exit(1);
});
