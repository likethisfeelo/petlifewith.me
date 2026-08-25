// ============================================================
// 지역 기준 데이터 — 시도 17 + 시군구 (2024~2025 행정구역 기준)
//
// - URL 슬러그는 국어의 로마자 표기법을 따른 통용 표기.
//   슬러그는 식별자일 뿐 사실 진술이 아니므로, 런칭 전 표기만 검수하면 된다.
// - 일반구(수원시 장안구 등)는 시 단위로 합친다. URL 깊이는 시도/시군구 2단.
// - ETL 은 이 목록에 없는 시군구를 만나면 적재하지 않고 리포트에 남긴다.
//   (지어내지 않는다 — claude.md 9)
// ============================================================

export interface SidoDef {
  name: string; // 공식 명칭 (예: 서울특별시)
  slug: string;
  aliases: string[]; // 주소 문자열에 등장하는 표기 변형
}

export interface RegionDef {
  sidoName: string;
  sidoSlug: string;
  sigunguName: string;
  sigunguSlug: string;
}

export const SIDO: SidoDef[] = [
  { name: "서울특별시", slug: "seoul", aliases: ["서울시", "서울"] },
  { name: "부산광역시", slug: "busan", aliases: ["부산시", "부산"] },
  { name: "대구광역시", slug: "daegu", aliases: ["대구시", "대구"] },
  { name: "인천광역시", slug: "incheon", aliases: ["인천시", "인천"] },
  { name: "광주광역시", slug: "gwangju", aliases: ["광주시", "광주"] },
  { name: "대전광역시", slug: "daejeon", aliases: ["대전시", "대전"] },
  { name: "울산광역시", slug: "ulsan", aliases: ["울산시", "울산"] },
  { name: "세종특별자치시", slug: "sejong", aliases: ["세종시", "세종"] },
  { name: "경기도", slug: "gyeonggi", aliases: ["경기"] },
  { name: "강원특별자치도", slug: "gangwon", aliases: ["강원도", "강원"] },
  { name: "충청북도", slug: "chungbuk", aliases: ["충북"] },
  { name: "충청남도", slug: "chungnam", aliases: ["충남"] },
  { name: "전북특별자치도", slug: "jeonbuk", aliases: ["전라북도", "전북"] },
  { name: "전라남도", slug: "jeonnam", aliases: ["전남"] },
  { name: "경상북도", slug: "gyeongbuk", aliases: ["경북"] },
  { name: "경상남도", slug: "gyeongnam", aliases: ["경남"] },
  { name: "제주특별자치도", slug: "jeju", aliases: ["제주도", "제주"] },
];

const sidoByName = new Map<string, SidoDef>();
for (const s of SIDO) {
  sidoByName.set(s.name, s);
  for (const a of s.aliases) sidoByName.set(a, s);
}

/** 주소에 등장한 시도 표기(구명칭·축약 포함)를 공식 명칭 정의로 정규화한다. 모르면 undefined. */
export function normalizeSidoName(raw: string): SidoDef | undefined {
  return sidoByName.get(raw.trim());
}

/**
 * 2026 행정구역 통합 표기 — 하나의 통합 시도명이 옛 시도 여러 개에 걸친다.
 * URL 체계(/spot/시도/시군구)는 유지하고, 시군구명으로 옛 시도에 결정적으로 귀속시킨다.
 * (광주 5개 구와 전남 22개 시·군은 이름이 겹치지 않아 모호성이 없다 — 인허가 데이터로 확인)
 */
export const MERGED_SIDO_SLUGS: Record<string, string[]> = {
  전남광주통합특별시: ["gwangju", "jeonnam"],
};

function r(sidoSlug: string, sidoName: string, list: Array<[string, string]>): RegionDef[] {
  return list.map(([sigunguName, sigunguSlug]) => ({ sidoName, sidoSlug, sigunguName, sigunguSlug }));
}

export const REGIONS: RegionDef[] = [
  ...r("seoul", "서울특별시", [
    ["종로구", "jongno-gu"], ["중구", "jung-gu"], ["용산구", "yongsan-gu"],
    ["성동구", "seongdong-gu"], ["광진구", "gwangjin-gu"], ["동대문구", "dongdaemun-gu"],
    ["중랑구", "jungnang-gu"], ["성북구", "seongbuk-gu"], ["강북구", "gangbuk-gu"],
    ["도봉구", "dobong-gu"], ["노원구", "nowon-gu"], ["은평구", "eunpyeong-gu"],
    ["서대문구", "seodaemun-gu"], ["마포구", "mapo-gu"], ["양천구", "yangcheon-gu"],
    ["강서구", "gangseo-gu"], ["구로구", "guro-gu"], ["금천구", "geumcheon-gu"],
    ["영등포구", "yeongdeungpo-gu"], ["동작구", "dongjak-gu"], ["관악구", "gwanak-gu"],
    ["서초구", "seocho-gu"], ["강남구", "gangnam-gu"], ["송파구", "songpa-gu"],
    ["강동구", "gangdong-gu"],
  ]),
  ...r("busan", "부산광역시", [
    ["중구", "jung-gu"], ["서구", "seo-gu"], ["동구", "dong-gu"], ["영도구", "yeongdo-gu"],
    ["부산진구", "busanjin-gu"], ["동래구", "dongnae-gu"], ["남구", "nam-gu"], ["북구", "buk-gu"],
    ["해운대구", "haeundae-gu"], ["사하구", "saha-gu"], ["금정구", "geumjeong-gu"],
    ["강서구", "gangseo-gu"], ["연제구", "yeonje-gu"], ["수영구", "suyeong-gu"],
    ["사상구", "sasang-gu"], ["기장군", "gijang-gun"],
  ]),
  ...r("daegu", "대구광역시", [
    ["중구", "jung-gu"], ["동구", "dong-gu"], ["서구", "seo-gu"], ["남구", "nam-gu"],
    ["북구", "buk-gu"], ["수성구", "suseong-gu"], ["달서구", "dalseo-gu"],
    ["달성군", "dalseong-gun"], ["군위군", "gunwi-gun"],
  ]),
  ...r("incheon", "인천광역시", [
    ["중구", "jung-gu"], ["동구", "dong-gu"], ["미추홀구", "michuhol-gu"], ["연수구", "yeonsu-gu"],
    ["남동구", "namdong-gu"], ["부평구", "bupyeong-gu"], ["계양구", "gyeyang-gu"], ["서구", "seo-gu"],
    ["강화군", "ganghwa-gun"], ["옹진군", "ongjin-gun"],
    // 2026-07 인천 행정구역 개편 신설 (행안부 인허가 데이터에서 확인).
    // 제물포구=중구+동구 내륙 재편, 영종구=영종도, 검단구=옛 서구 북부, 서해구=옛 서구 잔여(청라·가좌).
    // 동구·서구는 기존 적재분·URL 보존을 위해 남겨둔다 — 신규 데이터는 새 구로 귀속된다.
    ["제물포구", "jemulpo-gu"], ["영종구", "yeongjong-gu"], ["검단구", "geomdan-gu"], ["서해구", "seohae-gu"],
  ]),
  ...r("gwangju", "광주광역시", [
    ["동구", "dong-gu"], ["서구", "seo-gu"], ["남구", "nam-gu"], ["북구", "buk-gu"],
    ["광산구", "gwangsan-gu"],
  ]),
  ...r("daejeon", "대전광역시", [
    ["동구", "dong-gu"], ["중구", "jung-gu"], ["서구", "seo-gu"], ["유성구", "yuseong-gu"],
    ["대덕구", "daedeok-gu"],
  ]),
  ...r("ulsan", "울산광역시", [
    ["중구", "jung-gu"], ["남구", "nam-gu"], ["동구", "dong-gu"], ["북구", "buk-gu"],
    ["울주군", "ulju-gun"],
  ]),
  // 세종은 시군구가 없다. 주소 파싱 시 세종특별자치시 → 이 한 행으로 귀속.
  ...r("sejong", "세종특별자치시", [["세종시", "sejong-si"]]),
  ...r("gyeonggi", "경기도", [
    ["수원시", "suwon-si"], ["성남시", "seongnam-si"], ["고양시", "goyang-si"], ["용인시", "yongin-si"],
    ["부천시", "bucheon-si"], ["안산시", "ansan-si"], ["안양시", "anyang-si"], ["남양주시", "namyangju-si"],
    ["화성시", "hwaseong-si"], ["평택시", "pyeongtaek-si"], ["의정부시", "uijeongbu-si"], ["시흥시", "siheung-si"],
    ["파주시", "paju-si"], ["광명시", "gwangmyeong-si"], ["김포시", "gimpo-si"], ["군포시", "gunpo-si"],
    ["광주시", "gwangju-si"], ["이천시", "icheon-si"], ["양주시", "yangju-si"], ["오산시", "osan-si"],
    ["구리시", "guri-si"], ["안성시", "anseong-si"], ["포천시", "pocheon-si"], ["의왕시", "uiwang-si"],
    ["하남시", "hanam-si"], ["여주시", "yeoju-si"], ["동두천시", "dongducheon-si"], ["과천시", "gwacheon-si"],
    ["양평군", "yangpyeong-gun"], ["가평군", "gapyeong-gun"], ["연천군", "yeoncheon-gun"],
  ]),
  ...r("gangwon", "강원특별자치도", [
    ["춘천시", "chuncheon-si"], ["원주시", "wonju-si"], ["강릉시", "gangneung-si"], ["동해시", "donghae-si"],
    ["태백시", "taebaek-si"], ["속초시", "sokcho-si"], ["삼척시", "samcheok-si"], ["홍천군", "hongcheon-gun"],
    ["횡성군", "hoengseong-gun"], ["영월군", "yeongwol-gun"], ["평창군", "pyeongchang-gun"],
    ["정선군", "jeongseon-gun"], ["철원군", "cheorwon-gun"], ["화천군", "hwacheon-gun"],
    ["양구군", "yanggu-gun"], ["인제군", "inje-gun"], ["고성군", "goseong-gun"], ["양양군", "yangyang-gun"],
  ]),
  ...r("chungbuk", "충청북도", [
    ["청주시", "cheongju-si"], ["충주시", "chungju-si"], ["제천시", "jecheon-si"], ["보은군", "boeun-gun"],
    ["옥천군", "okcheon-gun"], ["영동군", "yeongdong-gun"], ["증평군", "jeungpyeong-gun"],
    ["진천군", "jincheon-gun"], ["괴산군", "goesan-gun"], ["음성군", "eumseong-gun"], ["단양군", "danyang-gun"],
  ]),
  ...r("chungnam", "충청남도", [
    ["천안시", "cheonan-si"], ["공주시", "gongju-si"], ["보령시", "boryeong-si"], ["아산시", "asan-si"],
    ["서산시", "seosan-si"], ["논산시", "nonsan-si"], ["계룡시", "gyeryong-si"], ["당진시", "dangjin-si"],
    ["금산군", "geumsan-gun"], ["부여군", "buyeo-gun"], ["서천군", "seocheon-gun"], ["청양군", "cheongyang-gun"],
    ["홍성군", "hongseong-gun"], ["예산군", "yesan-gun"], ["태안군", "taean-gun"],
  ]),
  ...r("jeonbuk", "전북특별자치도", [
    ["전주시", "jeonju-si"], ["군산시", "gunsan-si"], ["익산시", "iksan-si"], ["정읍시", "jeongeup-si"],
    ["남원시", "namwon-si"], ["김제시", "gimje-si"], ["완주군", "wanju-gun"], ["진안군", "jinan-gun"],
    ["무주군", "muju-gun"], ["장수군", "jangsu-gun"], ["임실군", "imsil-gun"], ["순창군", "sunchang-gun"],
    ["고창군", "gochang-gun"], ["부안군", "buan-gun"],
  ]),
  ...r("jeonnam", "전라남도", [
    ["목포시", "mokpo-si"], ["여수시", "yeosu-si"], ["순천시", "suncheon-si"], ["나주시", "naju-si"],
    ["광양시", "gwangyang-si"], ["담양군", "damyang-gun"], ["곡성군", "gokseong-gun"], ["구례군", "gurye-gun"],
    ["고흥군", "goheung-gun"], ["보성군", "boseong-gun"], ["화순군", "hwasun-gun"], ["장흥군", "jangheung-gun"],
    ["강진군", "gangjin-gun"], ["해남군", "haenam-gun"], ["영암군", "yeongam-gun"], ["무안군", "muan-gun"],
    ["함평군", "hampyeong-gun"], ["영광군", "yeonggwang-gun"], ["장성군", "jangseong-gun"],
    ["완도군", "wando-gun"], ["진도군", "jindo-gun"], ["신안군", "sinan-gun"],
  ]),
  ...r("gyeongbuk", "경상북도", [
    ["포항시", "pohang-si"], ["경주시", "gyeongju-si"], ["김천시", "gimcheon-si"], ["안동시", "andong-si"],
    ["구미시", "gumi-si"], ["영주시", "yeongju-si"], ["영천시", "yeongcheon-si"], ["상주시", "sangju-si"],
    ["문경시", "mungyeong-si"], ["경산시", "gyeongsan-si"], ["의성군", "uiseong-gun"],
    ["청송군", "cheongsong-gun"], ["영양군", "yeongyang-gun"], ["영덕군", "yeongdeok-gun"],
    ["청도군", "cheongdo-gun"], ["고령군", "goryeong-gun"], ["성주군", "seongju-gun"],
    ["칠곡군", "chilgok-gun"], ["예천군", "yecheon-gun"], ["봉화군", "bonghwa-gun"],
    ["울진군", "uljin-gun"], ["울릉군", "ulleung-gun"],
  ]),
  ...r("gyeongnam", "경상남도", [
    ["창원시", "changwon-si"], ["진주시", "jinju-si"], ["통영시", "tongyeong-si"], ["사천시", "sacheon-si"],
    ["김해시", "gimhae-si"], ["밀양시", "miryang-si"], ["거제시", "geoje-si"], ["양산시", "yangsan-si"],
    ["의령군", "uiryeong-gun"], ["함안군", "haman-gun"], ["창녕군", "changnyeong-gun"],
    ["고성군", "goseong-gun"], ["남해군", "namhae-gun"], ["하동군", "hadong-gun"],
    ["산청군", "sancheong-gun"], ["함양군", "hamyang-gun"], ["거창군", "geochang-gun"],
    ["합천군", "hapcheon-gun"],
  ]),
  ...r("jeju", "제주특별자치도", [
    ["제주시", "jeju-si"], ["서귀포시", "seogwipo-si"],
  ]),
];
