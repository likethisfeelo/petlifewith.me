// ============================================================
// DB 스키마 — 처음부터 최종형 (기획서 SECTION 01·04, claude.md 5-5)
// 콘텐츠 / 상품 / 스팟 / 메이커 / 태깅 관계를 런칭 시점에 전부 정의한다.
// 데이터가 비어 있어도 상관없다.
//
// 원칙
//  - users: 내부 UUID 가 PK. Cognito sub 는 나중에 채우는 UNIQUE NULL 컬럼 (claude.md 10-5)
//  - 개체 단위 태깅: 콘텐츠↔상품/스팟/메이커를 관계 테이블로 직접 연결 (claude.md 5-4)
//  - 의료 인접 콘텐츠는 감수 전 발행 불가 — DB CHECK 로 강제 (claude.md 6-2)
//  - 큐레이션 임베드는 창작자명·원본 링크가 NOT NULL — 출처 표기 강제 (기획서 3-4)
//  - 개인정보: 메이커/스팟에 대표자 개인명·상세주소(동·호수) 컬럼 자체를 두지 않는다 (claude.md 5-6)
//  - 파일은 오브젝트 키만 저장. 도메인·버킷명을 DB 에 넣지 않는다 (claude.md 10-1)
// ============================================================
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------- 공통 ----------

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------- enum ----------

export const userRole = pgEnum("user_role", ["admin", "editor", "owner", "member"]);
export const topicPhase = pgEnum("topic_phase", ["initial", "secondary", "always"]);
export const guideRole = pgEnum("guide_role", ["hub", "spoke"]);
export const guideStatus = pgEnum("guide_status", [
  "draft", // 작성 중
  "review_pending", // 감수 대기 (의료 인접 편)
  "published",
  "archived",
]);
export const spotStatus = pgEnum("spot_status", ["operating", "suspended", "closed", "unknown"]);
export const spotSource = pgEnum("spot_source", [
  "public_data", // 인허가 시딩
  "direct", // 직접 발굴 (셀프목욕 등 — 독점 자산)
  "claimed", // 업주 클레임으로 보강
  "sample", // 로컬 개발 픽스처 — 색인·사이트맵에서 항상 제외
]);
export const makerStatus = pgEnum("maker_status", ["draft", "published"]);
export const claimStatus = pgEnum("claim_status", ["pending", "approved", "rejected"]);
export const claimTarget = pgEnum("claim_target", ["spot", "maker"]);
export const embedSource = pgEnum("embed_source", ["youtube", "instagram", "none"]);
export const offerVendor = pgEnum("offer_vendor", ["coupang", "brand_store", "other"]);
export const promotionKind = pgEnum("promotion_kind", ["region_top", "content_card"]);
export const deviceCategory = pgEnum("device_category", [
  "laser",
  "stethoscope",
  "imaging",
  "monitor",
  "rehab_equipment",
  "other",
]);

// ---------- 사용자 ----------
// 지금은 인증 없이 개발. Cognito 는 나중에 cognito_sub 만 채워서 연결한다.
// cognito_sub 를 PK 로 쓰지 않는다 — 공급자 교체/풀 재생성 시 FK 가 무너진다.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cognitoSub: text("cognito_sub").unique(),
    email: text("email").unique(),
    displayName: text("display_name"),
    role: userRole("role").notNull().default("member"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

// ---------- 토픽 (클러스터) ----------

export const topics = pgTable("topics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(), // senior-life / play / care / treats / spot
  name: text("name").notNull(),
  description: text("description"),
  phase: topicPhase("phase").notNull().default("initial"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- 콘텐츠 (가이드) ----------

export const guides = pgTable(
  "guides",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"), // 카드·검색결과용 한 줄
    bodyMd: text("body_md").notNull().default(""),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topics.id),
    role: guideRole("role").notNull().default("spoke"), // 허브 1 + 스포크 구조
    spokeGroup: text("spoke_group"), // 노견: body(신체 영역) / support(지지 서비스)
    status: guideStatus("status").notNull().default("draft"),
    // 의료 인접 취급 규칙 (기획서 SECTION 02)
    medicalAdjacent: boolean("medical_adjacent").notNull().default(false),
    vetReviewed: boolean("vet_reviewed").notNull().default(false),
    vetReviewerName: text("vet_reviewer_name"), // "○○ 수의사 감수" 표기용
    vetReviewedAt: date("vet_reviewed_at"),
    heroImageKey: text("hero_image_key"), // S3 오브젝트 키 (URL 아님)
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("guides_topic_idx").on(t.topicId, t.status),
    index("guides_status_idx").on(t.status),
    // 감수 없는 의료 인접 편은 published 로 전환할 수 없다.
    check(
      "guides_medical_review_gate",
      sql`${t.status} <> 'published' OR ${t.medicalAdjacent} = false OR ${t.vetReviewed} = true`,
    ),
  ],
);

// ---------- 메이커 (간식·장난감·용품 제조 브랜드) ----------
// 대표자 개인명·상세 주소 컬럼을 두지 않는다. 지역은 시군구까지만.

export const makers = pgTable(
  "makers",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(), // treats / toys / goods
    regionId: integer("region_id").references(() => regions.id), // 시군구까지만 노출
    storyMd: text("story_md"), // 에디토리얼 소개 (만든 이유와 과정)
    // 배지는 "사실 진술"만 — "인증" 표현 금지 (claude.md 7)
    feedLicenseId: bigint("feed_license_id", { mode: "number" }).references(() => feedLicenses.id),
    badgeFeedRegistered: boolean("badge_feed_registered").notNull().default(false), // 사료제조업 등록 확인
    badgeIngredientRegistered: boolean("badge_ingredient_registered").notNull().default(false), // 성분등록 확인
    badgeVerifiedAt: date("badge_verified_at"), // 배지 툴팁에 기준일 명시
    badgeNote: text("badge_note"), // 검증 항목 설명
    selectionMemo: text("selection_memo"), // 선정 기준(4-4) 검증 내부 메모 — 렌더링 금지
    status: makerStatus("status").notNull().default("draft"),
    claimedBy: uuid("claimed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("makers_status_idx").on(t.status), index("makers_category_idx").on(t.category)],
);

export const makerLinks = pgTable(
  "maker_links",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => makers.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // website / instagram / smartstore / funding / etc
    url: text("url").notNull(),
    label: text("label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("maker_links_maker_idx").on(t.makerId)],
);

// 사료제조업 인허가 원장 (배지 근거 데이터 — 공적 데이터 기반 사실 진술)
export const feedLicenses = pgTable(
  "feed_licenses",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    businessName: text("business_name").notNull(),
    licenseKind: text("license_kind"), // 단미 / 배합 / 보조 (개방 범위는 data.go.kr 확인 후 확정)
    regionId: integer("region_id").references(() => regions.id),
    registeredAt: date("registered_at"),
    bizStatus: text("biz_status"),
    licenseMgmtNo: text("license_mgmt_no").unique(), // 중복 적재 방지 키
    referenceDate: date("reference_date"), // 데이터 기준일
    sourcePayload: jsonb("source_payload"), // 정규화 전 원본 행 (추적용)
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("feed_licenses_name_idx").on(t.businessName)],
);

// ---------- 상품 ----------

export const items = pgTable(
  "items",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    makerId: bigint("maker_id", { mode: "number" }).references(() => makers.id),
    category: text("category").notNull(), // toy / treat / supplement / tool / gear
    summary: text("summary"),
    descriptionMd: text("description_md"),
    imageKey: text("image_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("items_maker_idx").on(t.makerId), index("items_category_idx").on(t.category)],
);

// 구매 링크. is_affiliate=true 링크가 하나라도 렌더되는 페이지에는
// 수수료 고지가 자동 노출된다 (web 렌더 규칙, claude.md 6-4).
export const itemOffers = pgTable(
  "item_offers",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    vendor: offerVendor("vendor").notNull(),
    url: text("url").notNull(),
    isAffiliate: boolean("is_affiliate").notNull().default(false),
    label: text("label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("item_offers_item_idx").on(t.itemId)],
);

// ---------- 지역 ----------
// URL 은 로마자 슬러그: /spot/seoul/gangnam-gu/. 시군구 단위 (일반구는 시로 합침).

export const regions = pgTable(
  "regions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    sidoName: text("sido_name").notNull(), // 서울특별시
    sidoSlug: text("sido_slug").notNull(), // seoul
    sigunguName: text("sigungu_name").notNull(), // 강남구
    sigunguSlug: text("sigungu_slug").notNull(), // gangnam-gu
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("regions_slug_uq").on(t.sidoSlug, t.sigunguSlug),
    uniqueIndex("regions_name_uq").on(t.sidoName, t.sigunguName),
  ],
);

// 농림축산검역본부 동물등록 현황 — 시군구별 x 출생연도별.
// 지역별 노령견 비율 산출의 근거 (지역 페이지 고유 데이터 블록).
export const regionDogStats = pgTable(
  "region_dog_stats",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    birthYear: integer("birth_year").notNull(),
    registeredCount: integer("registered_count").notNull(),
    referenceDate: date("reference_date").notNull(), // 데이터 기준일
  },
  (t) => [
    uniqueIndex("region_dog_stats_uq").on(t.regionId, t.birthYear, t.referenceDate),
    index("region_dog_stats_region_idx").on(t.regionId),
  ],
);

// ---------- 스팟 ----------

export const spotTypes = pgTable("spot_types", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(), // grooming / self-wash / pool / ...
  name: text("name").notNull(),
  description: text("description"),
  // 장묘는 광고를 붙이지 않는다 (기획서 4-1). 프로모션 로직이 이 플래그를 본다.
  monetizable: boolean("monetizable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const spots = pgTable(
  "spots",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull(), // URL 은 /place/[id]-[slug] — id 가 유일성 담당
    name: text("name").notNull(),
    typeId: integer("type_id")
      .notNull()
      .references(() => spotTypes.id),
    regionId: integer("region_id")
      .notNull()
      .references(() => regions.id),
    // 주소는 도로명+건물번호까지. 층·호수 등 상세는 ETL 에서 제거 (claude.md 5-6)
    addressRoad: text("address_road"),
    phone: text("phone"),
    status: spotStatus("status").notNull().default("unknown"),
    source: spotSource("source").notNull().default("public_data"),
    // 인허가 원천 필드
    licenseMgmtNo: text("license_mgmt_no").unique(), // 관리번호 — 재적재 시 dedup 키
    licenseDate: date("license_date"),
    dataReferenceDate: date("data_reference_date"), // "데이터 기준일 명시" (기획서 SECTION 07)
    // 인허가 좌표는 원본 그대로 보관. 좌표계 확인 전에는 위경도 변환하지 않는다 (추측 금지).
    rawCoordX: doublePrecision("raw_coord_x"),
    rawCoordY: doublePrecision("raw_coord_y"),
    rawCoordSystem: text("raw_coord_system"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // 에디토리얼·클레임으로 채워지는 정보 항목 — noindex 게이트가 개수를 센다
    descriptionMd: text("description_md"),
    hoursText: text("hours_text"),
    priceText: text("price_text"),
    parkingText: text("parking_text"),
    heroImageKey: text("hero_image_key"),
    claimedBy: uuid("claimed_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("spots_region_type_idx").on(t.regionId, t.typeId, t.status),
    index("spots_type_idx").on(t.typeId),
    index("spots_source_idx").on(t.source),
  ],
);

// 스팟 외부 링크 — 홈페이지·카카오톡·예약·인스타 등을 필요한 것만 선택적으로.
// maker_links 와 동일한 구조다. 고정 컬럼 대신 이 테이블을 쓰는 이유는
// 업체마다 쓰는 채널이 제각각이고(카카오톡 채널만 있는 곳, 네이버 예약만 있는 곳),
// 채널이 늘어날 때마다 스키마를 바꾸지 않기 위해서다.
export const spotLinks = pgTable(
  "spot_links",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    spotId: bigint("spot_id", { mode: "number" })
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // website / kakao / reservation / instagram / naver / blog / etc
    url: text("url").notNull(),
    label: text("label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("spot_links_spot_idx").on(t.spotId)],
);

// 노출 광고 (기획서 4-3). 가격은 트래픽 확보 후 책정 — 지금은 슬롯 구조만.
// 장묘 스팟에는 생성 금지 (spot_types.monetizable — 앱 레이어에서 강제).
export const promotions = pgTable(
  "promotions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    spotId: bigint("spot_id", { mode: "number" })
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    kind: promotionKind("kind").notNull(),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    active: boolean("active").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("promotions_spot_idx").on(t.spotId, t.active)],
);

// ---------- 클레임 (업주/브랜드 소유 확인) ----------

export const claims = pgTable(
  "claims",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    targetType: claimTarget("target_type").notNull(),
    spotId: bigint("spot_id", { mode: "number" }).references(() => spots.id, { onDelete: "cascade" }),
    makerId: bigint("maker_id", { mode: "number" }).references(() => makers.id, { onDelete: "cascade" }),
    claimantName: text("claimant_name").notNull(),
    contact: text("contact").notNull(), // 이메일 또는 전화 — 관리자 확인용, 공개 금지
    bizRegistrationNo: text("biz_registration_no"), // 확인용, 공개 금지
    message: text("message"),
    status: claimStatus("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("claims_status_idx").on(t.status),
    check(
      "claims_exactly_one_target",
      sql`(${t.targetType} = 'spot' AND ${t.spotId} IS NOT NULL AND ${t.makerId} IS NULL)
       OR (${t.targetType} = 'maker' AND ${t.makerId} IS NOT NULL AND ${t.spotId} IS NULL)`,
    ),
  ],
);

// ---------- 개체 단위 태깅 (claude.md 5-4) ----------
// "관련 글" 수준의 느슨한 연결이 아니라 오브젝트 단위 연결.
// 역방향 페이지("이 장난감이 언급된 글 N개")가 이 테이블에서 자동 생성된다.

export const guideItemTags = pgTable(
  "guide_item_tags",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guideId: bigint("guide_id", { mode: "number" })
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    itemId: bigint("item_id", { mode: "number" })
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    contextLabel: text("context_label"), // 예: "본문에서 사용한 노즈워크 매트"
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("guide_item_tags_uq").on(t.guideId, t.itemId),
    index("guide_item_tags_item_idx").on(t.itemId),
  ],
);

export const guideSpotTags = pgTable(
  "guide_spot_tags",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guideId: bigint("guide_id", { mode: "number" })
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    spotId: bigint("spot_id", { mode: "number" })
      .notNull()
      .references(() => spots.id, { onDelete: "cascade" }),
    contextLabel: text("context_label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("guide_spot_tags_uq").on(t.guideId, t.spotId),
    index("guide_spot_tags_spot_idx").on(t.spotId),
  ],
);

export const guideMakerTags = pgTable(
  "guide_maker_tags",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guideId: bigint("guide_id", { mode: "number" })
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    makerId: bigint("maker_id", { mode: "number" })
      .notNull()
      .references(() => makers.id, { onDelete: "cascade" }),
    contextLabel: text("context_label"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("guide_maker_tags_uq").on(t.guideId, t.makerId),
    index("guide_maker_tags_maker_idx").on(t.makerId),
  ],
);

// ---------- 크리에이터 큐레이션 (테마 단위 — /creator/ 개인 허브 금지) ----------

export const curations = pgTable("curations", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  themeSlug: text("theme_slug").notNull().unique(),
  title: text("title").notNull(),
  introMd: text("intro_md"), // 임베드를 빼도 읽을 가치가 있어야 한다 (기획서 3-3)
  status: guideStatus("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// 임베드는 공식 임베드만. 이미지 재호스팅 컬럼은 존재하지 않는다 (기획서 3-1).
// 창작자명·원본 링크는 NOT NULL — 출처 표기를 스키마로 강제 (기획서 3-4).
export const curationEntries = pgTable(
  "curation_entries",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    curationId: bigint("curation_id", { mode: "number" })
      .notNull()
      .references(() => curations.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    embedSource: embedSource("embed_source").notNull().default("none"),
    embedRef: text("embed_ref"), // youtube: videoId / instagram: 게시물 URL
    creatorName: text("creator_name").notNull(),
    originalUrl: text("original_url").notNull(),
    summaryMd: text("summary_md").notNull(), // 우리 언어로 재작성한 요약 (인용은 15단어 미만)
  },
  (t) => [
    index("curation_entries_curation_idx").on(t.curationId),
    check(
      "curation_entries_embed_ref_required",
      sql`${t.embedSource} = 'none' OR ${t.embedRef} IS NOT NULL`,
    ),
  ],
);

// ---------- 치료·진단 기기 (주어는 병원이 아니라 기기) ----------
// 보유처 목록은 기기 콘텐츠 안에서만 무료로 노출된다.
// 별도 디렉토리 페이지·광고 상품을 만들지 않는다 (기획서 SECTION 02, 4-1).

export const deviceModels = pgTable("device_models", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  makerName: text("maker_name"),
  category: deviceCategory("category").notNull().default("other"),
  // 원리·스펙은 사실 서술. "효과적" 같은 단정 표현은 에디토리얼 규칙으로 금지.
  summaryMd: text("summary_md"),
  specsMd: text("specs_md"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const guideDeviceTags = pgTable(
  "guide_device_tags",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guideId: bigint("guide_id", { mode: "number" })
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    deviceModelId: bigint("device_model_id", { mode: "number" })
      .notNull()
      .references(() => deviceModels.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("guide_device_tags_uq").on(t.guideId, t.deviceModelId),
    index("guide_device_tags_device_idx").on(t.deviceModelId),
  ],
);

// 기기 보유처 — 공공데이터에 없어 직접 확인한다. 독점 자산. 무료 노출 전용.
export const deviceSites = pgTable(
  "device_sites",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    deviceModelId: bigint("device_model_id", { mode: "number" })
      .notNull()
      .references(() => deviceModels.id, { onDelete: "cascade" }),
    facilityName: text("facility_name").notNull(),
    regionId: integer("region_id").references(() => regions.id),
    verifiedAt: date("verified_at"), // 확인 전화 일자 — 표기용
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("device_sites_device_idx").on(t.deviceModelId)],
);
