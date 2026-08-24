// 로컬 개발용 샘플 픽스처 — 페이지 템플릿 개발을 위한 가짜 데이터.
// 전부 "샘플" 접두사 + spots.source='sample'. 실서비스 DB 에 넣지 않는다.
// (스팟은 source='sample' 이 사이트맵·색인에서 제외된다. web/lib/seo 참조)
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../db/client.js";
import {
  claims,
  curationEntries,
  curations,
  deviceModels,
  deviceSites,
  guideDeviceTags,
  guideItemTags,
  guideMakerTags,
  guideSpotTags,
  guides,
  itemOffers,
  items,
  makerLinks,
  makers,
  promotions,
  regions,
  spotLinks,
  spotTypes,
  spots,
  users,
} from "../db/schema.js";
import { slugify } from "../etl/lib/slug.js";

if (process.env.NODE_ENV === "production") {
  console.error("dev 픽스처는 production 환경에서 실행할 수 없습니다.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

async function main() {
  const db = getDb();

  const regionRows = await db.select().from(regions);
  const typeRows = await db.select().from(spotTypes);
  if (regionRows.length === 0 || typeRows.length === 0) {
    throw new Error("seed:base 를 먼저 실행하세요.");
  }
  const region = (sido: string, sigungu: string) => {
    const r = regionRows.find((x) => x.sidoSlug === sido && x.sigunguSlug === sigungu);
    if (!r) throw new Error(`지역 없음: ${sido}/${sigungu}`);
    return r.id;
  };
  const type = (slug: string) => {
    const t = typeRows.find((x) => x.slug === slug);
    if (!t) throw new Error(`스팟 유형 없음: ${slug}`);
    return t.id;
  };

  // ---------- 관리자 사용자 ----------
  let admin = (await db.select().from(users).where(eq(users.email, "admin@example.com")))[0];
  if (!admin) {
    admin = (
      await db.insert(users).values({ email: "admin@example.com", displayName: "관리자(샘플)", role: "admin" }).returning()
    )[0]!;
  }

  // ---------- 메이커 ----------
  const makerDefs = [
    {
      slug: "sample-treat-workshop",
      name: "샘플 간식공방",
      category: "treats",
      regionId: region("gyeonggi", "seongnam-si"),
      storyMd:
        "개발용 샘플 데이터입니다. 실제 브랜드가 아닙니다.\n\n1인 수제간식 공방을 가정한 픽스처로, 사료제조업 등록 배지·판매 채널 링크·스토리 블록의 렌더링을 확인하는 용도입니다.",
      badgeFeedRegistered: true,
      badgeIngredientRegistered: true,
      badgeVerifiedAt: today,
      badgeNote: "샘플 데이터 — 실제 등록 확인이 아닙니다.",
      status: "published" as const,
    },
    {
      slug: "sample-toy-studio",
      name: "샘플 장난감스튜디오",
      category: "toys",
      regionId: region("seoul", "mapo-gu"),
      storyMd:
        "개발용 샘플 데이터입니다. 실제 브랜드가 아닙니다.\n\n노즈워크 매트를 직접 제작하는 소규모 스튜디오를 가정한 픽스처입니다.",
      badgeFeedRegistered: false,
      badgeIngredientRegistered: false,
      status: "published" as const,
    },
  ];
  const makerIds: Record<string, number> = {};
  for (const m of makerDefs) {
    const existing = (await db.select().from(makers).where(eq(makers.slug, m.slug)))[0];
    const row = existing
      ? (await db.update(makers).set({ ...m, updatedAt: new Date() }).where(eq(makers.id, existing.id)).returning())[0]!
      : (await db.insert(makers).values(m).returning())[0]!;
    makerIds[m.slug] = row.id;
    await db.delete(makerLinks).where(eq(makerLinks.makerId, row.id));
    await db.insert(makerLinks).values([
      { makerId: row.id, kind: "website", url: "https://example.com/", label: "자사몰(샘플)", sortOrder: 1 },
      { makerId: row.id, kind: "instagram", url: "https://example.com/instagram", label: "인스타그램(샘플)", sortOrder: 2 },
    ]);
  }

  // ---------- 상품 ----------
  const itemDefs = [
    {
      slug: "sample-nosework-mat",
      name: "샘플 노즈워크 매트",
      makerId: makerIds["sample-toy-studio"],
      category: "toy",
      summary: "간식을 숨겨 후각 탐색을 유도하는 매트 (개발용 샘플)",
      descriptionMd: "개발용 샘플 상품입니다. 실제 판매 상품이 아닙니다.",
    },
    {
      slug: "sample-snuffle-ball",
      name: "샘플 스너플볼",
      makerId: makerIds["sample-toy-studio"],
      category: "toy",
      summary: "굴리면 간식이 조금씩 나오는 공 (개발용 샘플)",
      descriptionMd: "개발용 샘플 상품입니다.",
    },
    {
      slug: "sample-freeze-dried-treat",
      name: "샘플 동결건조 간식",
      makerId: makerIds["sample-treat-workshop"],
      category: "treat",
      summary: "단일 성분 동결건조 간식 (개발용 샘플)",
      descriptionMd: "개발용 샘플 상품입니다.",
    },
    {
      slug: "sample-joint-supplement",
      name: "샘플 관절 보조제",
      makerId: null,
      category: "supplement",
      summary: "노령견 관절 관리 보조제 (개발용 샘플)",
      descriptionMd: "개발용 샘플 상품입니다.",
    },
  ];
  const itemIds: Record<string, number> = {};
  for (const it of itemDefs) {
    const existing = (await db.select().from(items).where(eq(items.slug, it.slug)))[0];
    const row = existing
      ? (await db.update(items).set({ ...it, updatedAt: new Date() }).where(eq(items.id, existing.id)).returning())[0]!
      : (await db.insert(items).values(it).returning())[0]!;
    itemIds[it.slug] = row.id;
    await db.delete(itemOffers).where(eq(itemOffers.itemId, row.id));
    await db.insert(itemOffers).values([
      // 제휴 링크가 있으면 페이지에 수수료 고지가 자동 노출되는지 확인하기 위한 픽스처
      { itemId: row.id, vendor: "coupang", url: "https://example.com/coupang-placeholder", isAffiliate: true, label: "쿠팡(샘플 링크)", sortOrder: 1 },
      { itemId: row.id, vendor: "brand_store", url: "https://example.com/store", isAffiliate: false, label: "자사몰(샘플 링크)", sortOrder: 2 },
    ]);
  }

  // ---------- 스팟 ----------
  const spotDefs = [
    {
      key: "self-wash-mapo",
      name: "샘플 셀프목욕 마포점",
      typeSlug: "self-wash",
      regionId: region("seoul", "mapo-gu"),
      addressRoad: "서울특별시 마포구 샘플로 12",
      phone: "02-0000-0000",
      descriptionMd: "개발용 샘플 스팟입니다. 셀프목욕 시설 상세 페이지 렌더링 확인용.",
      hoursText: "매일 10:00–22:00 (샘플)",
      priceText: "기본 30분 15,000원 (샘플)",
      parkingText: "건물 뒤 2대 (샘플)",
      status: "operating" as const,
    },
    {
      key: "self-wash-gangnam",
      name: "샘플 셀프목욕 강남점",
      typeSlug: "self-wash",
      regionId: region("seoul", "gangnam-gu"),
      addressRoad: "서울특별시 강남구 샘플대로 34",
      descriptionMd: "개발용 샘플 스팟입니다.",
      hoursText: "매일 11:00–21:00 (샘플)",
      priceText: "기본 30분 18,000원 (샘플)",
      status: "operating" as const,
    },
    {
      key: "spa-gangnam",
      name: "샘플 스파&그루밍 강남",
      typeSlug: "grooming",
      regionId: region("seoul", "gangnam-gu"),
      addressRoad: "서울특별시 강남구 샘플로 56",
      phone: "02-0000-0001",
      descriptionMd: "개발용 샘플 스팟입니다. 스파 상세 페이지 렌더링 확인용.",
      hoursText: "화–일 10:30–19:30 (샘플)",
      priceText: "스파 코스 55,000원부터 (샘플)",
      status: "operating" as const,
    },
    {
      key: "pool-seongnam",
      name: "샘플 도그풀 성남",
      typeSlug: "pool",
      regionId: region("gyeonggi", "seongnam-si"),
      addressRoad: "경기도 성남시 샘플공원로 78",
      descriptionMd: "개발용 샘플 스팟입니다. 수영장 상세 페이지 렌더링 확인용.",
      hoursText: "주말 10:00–18:00 (샘플)",
      priceText: "1견 25,000원 (샘플)",
      parkingText: "전용 주차장 (샘플)",
      status: "operating" as const,
    },
    {
      key: "rehab-seongnam",
      name: "샘플 재활운동센터 성남",
      typeSlug: "rehab",
      regionId: region("gyeonggi", "seongnam-si"),
      addressRoad: "경기도 성남시 샘플로 90",
      phone: "031-000-0000",
      descriptionMd: "개발용 샘플 스팟입니다. 수중런닝머신 보유 시설 상세 페이지 확인용.",
      hoursText: "평일 09:00–18:00 (샘플)",
      priceText: "수중런닝 1회 45,000원 (샘플)",
      status: "operating" as const,
    },
    {
      key: "visiting-bath-mapo",
      name: "샘플 방문목욕 서비스",
      typeSlug: "visiting-bath",
      regionId: region("seoul", "mapo-gu"),
      descriptionMd: "개발용 샘플 스팟입니다. 방문목욕 서비스 상세 페이지 확인용.",
      hoursText: "예약제 (샘플)",
      priceText: "소형견 40,000원부터 (샘플)",
      status: "operating" as const,
    },
    {
      key: "memorial-seongnam",
      name: "샘플 반려동물 장례식장",
      typeSlug: "memorial",
      regionId: region("gyeonggi", "gwangju-si"),
      addressRoad: "경기도 광주시 샘플길 11",
      phone: "031-000-0001",
      // 장묘: 담담한 사실 정보만. 광고·추천 없음이 렌더링되는지 확인.
      descriptionMd: "개발용 샘플 스팟입니다. 장묘 페이지의 무광고·사실 정보 전용 렌더링 확인용.",
      hoursText: "연중무휴 (샘플)",
      status: "operating" as const,
    },
    {
      // 정보 3항목 미만 — noindex 게이트 확인용 (이름+지역뿐)
      key: "sparse-boarding",
      name: "샘플 정보부족 유치원",
      typeSlug: "boarding",
      regionId: region("seoul", "gangnam-gu"),
      status: "unknown" as const,
    },
  ];
  const spotIds: Record<string, number> = {};
  for (const s of spotDefs) {
    const { key, typeSlug, ...rest } = s;
    const values = {
      ...rest,
      slug: slugify(s.name, typeSlug),
      typeId: type(typeSlug),
      source: "sample" as const,
      dataReferenceDate: today,
    };
    const existing = (await db.select().from(spots).where(eq(spots.name, s.name)))[0];
    const row = existing
      ? (await db.update(spots).set({ ...values, updatedAt: new Date() }).where(eq(spots.id, existing.id)).returning())[0]!
      : (await db.insert(spots).values(values).returning())[0]!;
    spotIds[key] = row.id;
  }

  // 스팟 외부 링크 — 홈페이지·카카오톡·예약 등 선택적 링크 렌더링 확인용
  for (const key of ["spa-gangnam", "self-wash-mapo"]) {
    const id = spotIds[key]!;
    await db.delete(spotLinks).where(eq(spotLinks.spotId, id));
    await db.insert(spotLinks).values([
      { spotId: id, kind: "website", url: "https://example.com/", label: null, sortOrder: 1 },
      { spotId: id, kind: "kakao", url: "http://pf.kakao.com/_sample", label: null, sortOrder: 2 },
      { spotId: id, kind: "reservation", url: "https://example.com/reserve", label: null, sortOrder: 3 },
    ]);
  }

  // 프로모션 라벨("광고") 렌더링 확인용 — 장묘가 아닌 스팟에만
  await db.delete(promotions).where(eq(promotions.spotId, spotIds["spa-gangnam"]!));
  await db.insert(promotions).values({
    spotId: spotIds["spa-gangnam"]!,
    kind: "region_top",
    active: true,
    startsOn: today,
  });

  // ---------- 기기(주어는 기기) + 보유처 ----------
  const deviceSlug = "sample-class4-laser";
  let device = (await db.select().from(deviceModels).where(eq(deviceModels.slug, deviceSlug)))[0];
  const deviceValues = {
    slug: deviceSlug,
    name: "샘플 치료 레이저 기기",
    makerName: "샘플 제조사",
    category: "laser" as const,
    summaryMd:
      "개발용 샘플 기기입니다. 기기 콘텐츠 안에서 원리·스펙 서술과 보유처 무료 목록이 어떻게 붙는지 확인하는 용도입니다.",
    specsMd: "- 출력: 샘플\n- 조사 방식: 샘플",
  };
  device = device
    ? (await db.update(deviceModels).set({ ...deviceValues, updatedAt: new Date() }).where(eq(deviceModels.id, device.id)).returning())[0]!
    : (await db.insert(deviceModels).values(deviceValues).returning())[0]!;
  await db.delete(deviceSites).where(eq(deviceSites.deviceModelId, device.id));
  await db.insert(deviceSites).values([
    { deviceModelId: device.id, facilityName: "샘플 동물병원 A", regionId: region("seoul", "mapo-gu"), verifiedAt: today, note: "샘플 데이터" },
    { deviceModelId: device.id, facilityName: "샘플 동물병원 B", regionId: region("gyeonggi", "seongnam-si"), verifiedAt: today, note: "샘플 데이터" },
  ]);

  // ---------- 큐레이션 (테마 단위) ----------
  const curSlug = "rainy-day-indoor-play";
  let cur = (await db.select().from(curations).where(eq(curations.themeSlug, curSlug)))[0];
  const curValues = {
    themeSlug: curSlug,
    title: "비 오는 날 실내놀이 아이디어 (샘플)",
    introMd:
      "개발용 샘플 큐레이션입니다.\n\n임베드를 전부 제거해도 읽을 가치가 있어야 한다는 3-3 기준을 확인하기 위해, 각 항목에는 우리 언어로 쓴 요약이 붙습니다.",
    status: "published" as const,
    publishedAt: new Date(),
  };
  cur = cur
    ? (await db.update(curations).set({ ...curValues, updatedAt: new Date() }).where(eq(curations.id, cur.id)).returning())[0]!
    : (await db.insert(curations).values(curValues).returning())[0]!;
  await db.delete(curationEntries).where(eq(curationEntries.curationId, cur.id));
  await db.insert(curationEntries).values([
    {
      curationId: cur.id,
      sortOrder: 1,
      embedSource: "none",
      creatorName: "샘플 크리에이터",
      originalUrl: "https://example.com/original-1",
      summaryMd:
        "링크 전용 항목 샘플. 초보자가 막히는 지점(난이도 조절)을 보완 설명하는 자리에 우리 언어로 쓴 요약이 들어갑니다.",
    },
    {
      curationId: cur.id,
      sortOrder: 2,
      embedSource: "youtube",
      embedRef: "SAMPLE_VIDEO_ID",
      creatorName: "샘플 채널",
      originalUrl: "https://example.com/original-2",
      summaryMd: "유튜브 공식 임베드 렌더링 확인용 샘플 항목입니다. (유효하지 않은 ID 라 플레이어에 오류가 표시됩니다)",
    },
  ]);

  // ---------- 클레임 (관리자 큐 확인용) ----------
  const existingClaim = (await db.select().from(claims).where(eq(claims.claimantName, "샘플 사장님")))[0];
  if (!existingClaim) {
    await db.insert(claims).values({
      targetType: "spot",
      spotId: spotIds["spa-gangnam"]!,
      claimantName: "샘플 사장님",
      contact: "owner@example.com",
      message: "개발용 샘플 클레임입니다.",
    });
  }

  // ---------- 태깅 — 콘텐츠가 시드된 경우에만 연결 ----------
  const tag = async (guideSlug: string, kind: "item" | "spot" | "maker" | "device", refId: number, contextLabel?: string, sortOrder = 0) => {
    const g = (await db.select({ id: guides.id }).from(guides).where(eq(guides.slug, guideSlug)))[0];
    if (!g) return false;
    if (kind === "item") {
      await db.insert(guideItemTags).values({ guideId: g.id, itemId: refId, contextLabel, sortOrder }).onConflictDoNothing();
    } else if (kind === "spot") {
      await db.insert(guideSpotTags).values({ guideId: g.id, spotId: refId, contextLabel, sortOrder }).onConflictDoNothing();
    } else if (kind === "maker") {
      await db.insert(guideMakerTags).values({ guideId: g.id, makerId: refId, contextLabel, sortOrder }).onConflictDoNothing();
    } else {
      await db.insert(guideDeviceTags).values({ guideId: g.id, deviceModelId: refId, sortOrder }).onConflictDoNothing();
    }
    return true;
  };

  let tagged = 0;
  tagged += (await tag("play-nosework-start", "item", itemIds["sample-nosework-mat"]!, "본문에서 예로 든 노즈워크 매트", 1)) ? 1 : 0;
  tagged += (await tag("play-nosework-start", "item", itemIds["sample-snuffle-ball"]!, "난이도를 올릴 때 쓰는 스너플볼", 2)) ? 1 : 0;
  tagged += (await tag("play-nosework-start", "maker", makerIds["sample-toy-studio"]!, "노즈워크 매트를 만드는 브랜드", 1)) ? 1 : 0;
  tagged += (await tag("play-nosework-senior", "item", itemIds["sample-snuffle-ball"]!, "저강도 탐색용 스너플볼", 1)) ? 1 : 0;
  tagged += (await tag("senior-joint-mobility", "item", itemIds["sample-joint-supplement"]!, "본문에서 언급한 관절 보조제", 1)) ? 1 : 0;
  tagged += (await tag("senior-rehab-hydro", "spot", spotIds["rehab-seongnam"]!, "수중런닝머신 보유 시설", 1)) ? 1 : 0;
  tagged += (await tag("senior-rehab-hydro", "device", device.id, undefined, 1)) ? 1 : 0;
  tagged += (await tag("senior-visiting-bath", "spot", spotIds["visiting-bath-mapo"]!, "방문목욕 서비스", 1)) ? 1 : 0;
  tagged += (await tag("senior-skin-bath", "spot", spotIds["self-wash-mapo"]!, "집 근처 셀프목욕 시설 예시", 1)) ? 1 : 0;
  tagged += (await tag("play-indoor-rainy", "item", itemIds["sample-nosework-mat"]!, "실내 후각놀이 도구", 1)) ? 1 : 0;

  console.log(`dev 픽스처 완료 — 메이커 ${makerDefs.length}, 상품 ${itemDefs.length}, 스팟 ${spotDefs.length}, 태깅 ${tagged}건`);
  if (tagged === 0) {
    console.log("  (가이드 태깅 0건 — seed:content 실행 후 seed:dev 를 다시 실행하면 연결됩니다)");
  }

  await closeDb();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
