# 펫라이프위드미 측정 기획 — GA4 · GTM · 입점사 리포트

**작성일** 2026-10-16
**목적** ① 마케팅: 어디서 누가 와서 무엇을 하고 어디로 이어지는지 알기 ② 입점사(업체·브랜드·돌봄 파트너·훈련사): "펫라이프위드미에 올리면 무엇이 생기는지"를 숫자로 보여 주기 — 노출·연락·예약·**유입 검색어**.
**현재 상태** GTM `GTM-TH2GC5MP` 설치(운영만, 관리자 제외), GA4 `G-54XBW1L9KE` 는 GTM 안의 Google 태그로 페이지뷰만. 사이트가 보내는 커스텀 이벤트는 **없음**. 사이트 내 검색 기능 없음.

---

## 0. 한 장 요약

| 질문 | 어디서 답하나 |
|---|---|
| 인스타·검색·직접 중 어디서 오나, 무엇이 가입·연락으로 이어지나 | **GA4** (UTM + 커스텀 이벤트) |
| 어떤 검색어로 들어오나 (사이트 전체·페이지별) | **Google Search Console** (+ 네이버 서치어드바이저) — GA4 는 검색어를 주지 않는다 |
| 업체 한 곳이 이번 달 몇 번 보였고 몇 번 연락받았나 | **자체 집계(DB)** — 광고 차단·GA4 임계값에 영향받지 않는 숫자로 입점사에게 보여 준다 |
| 그 업체 페이지로 들어온 검색어 Top 10 | **Search Console API** 를 업체 페이지 URL 로 걸러 저장 → 사장님 대시보드 |

원칙: **GA4 = 마케팅 분석용(우리가 본다)**, **자체 집계 + Search Console = 입점사 리포트용(사장님이 본다)**. 입점사에게 보여 주는 숫자를 GA4 화면에 의존하지 않는다 — 표본·임계값·광고 차단으로 업체별 작은 숫자가 흔들리고, 사장님에게 GA 권한을 줄 수도 없다.

---

## 1. 측정 목표와 핵심 지표

### 1-1. 마케팅 (운영진)

| 단계 | 지표 | GA4 이벤트 |
|---|---|---|
| 유입 | 채널별 세션(검색·인스타·직접·추천), 랜딩 페이지 | 기본 + UTM |
| 읽기 | 토픽·부위별 글 조회, 스크롤 90%, 체류 | `page_view`(문맥 포함), `scroll` |
| 연결 | **글 → 디렉토리** 이동(태그 패널·배너·신체 지도) | `entity_click`, `body_map_click`, `directory_banner_click` |
| 행동 | 연락 버튼, 예약·상담 신청, 구매 링크 | `contact_click`, `reservation_request`, `purchase_click` |
| 참여 | 가입·로그인(방식별), 글·영상 올리기, 댓글, 저장·좋아요, 모임 | `sign_up`, `login`, `post_submit`, `comment`, `save`, `like`, `meetup_join` |
| 공급 | 업체 등록·정보 관리·상단 노출·돌봄 파트너 신청, 상담 프로필 | `request_submit`, `expert_profile_save` |

**핵심 이벤트(전환)**: `sign_up`, `contact_click`, `reservation_request`, `request_submit`, `purchase_click`.

### 1-2. 입점사 (사장님이 보는 것)

| 대상 | 월간 지표 |
|---|---|
| 업체(스팟) | 페이지 조회 · 연락 버튼 클릭(채널별: 카카오톡·전화·홈페이지·예약·인스타) · 예약 신청 · 저장 수 · **유입 검색어 Top 10(노출·클릭)** · 유입 경로 비율(검색/인스타/사이트 안 글) · 이 업체가 나온 글 경유 클릭 |
| 지역 상단 노출(유료) | 위 + **상단 슬롯 노출 수·클릭 수**, 같은 지역×유형 페이지의 전체 조회(수요) — 재계약 근거 |
| 돌봄 파트너 | 카드 노출 · 예약 신청 · 카카오톡 상담 클릭 (지역×유형 페이지 조회 = 지역 수요) |
| 브랜드·상품 | 페이지 조회 · 구매 링크 클릭(자사몰) · 언급된 글 수와 그 글 조회 |
| 훈련사·멘토 | 프로필 조회 · 바로 채팅 시작 · 상담 신청 |

**순위·평점과 충돌하지 않게**: 다른 업체와 비교하는 숫자(순위, "지역 1위")는 보여 주지 않는다. 자기 업체 숫자와 지역 전체 수요만 (claude.md 6-2, 5-8).

---

## 2. 데이터 흐름

```
 브라우저 ─ dataLayer.push(페이지 문맥·이벤트) ─→ GTM ─→ GA4 ─(일일 내보내기)→ BigQuery(선택)
     │
     └─ /api/collect (비콘: 조회·클릭, 개인정보 없음) ─→ entity_stats_daily (Postgres)
                                                              │
 Search Console ─(API 매일 / 대량 내보내기)→ search_queries_daily ┤
                                                              ▼
                                           /me/business 리포트 · /admin 통계
```

---

## 3. dataLayer 규약 (코드가 보낸다)

### 3-1. 페이지 문맥 — 모든 공개 페이지

페이지가 렌더될 때 `page_context` 를 먼저 넣고, 그다음 `page_view` 를 보낸다. 클라이언트 이동(App Router)에서도 같은 순서로 다시 보낸다 — GA4 의 "브라우저 기록 기반 페이지 변경" 자동 측정은 **끈다**(문맥 없이 페이지뷰가 먼저 나가 중복·누락이 생긴다).

```js
dataLayer.push({
  event: "page_context",
  page_type: "place",            // 아래 표
  content_group: "directory",    // content | directory | community | partner | account | portal
  topic: "senior-life",          // 글·토픽
  category: "joint",             // 노견 부위
  spot_type: "grooming",         // 디렉토리 유형
  region_sido: "서울", region_sigungu: "강남구",
  entity_type: "spot",           // spot | maker | item | device | guide | expert | meetup
  entity_id: "1234",
  is_sponsored: false,           // 협찬 글·주목 기기
  is_promoted: false,            // 지역 상단 노출 중
  is_member_post: false,
  login_state: "guest"           // guest | member | owner (닉네임·이메일은 절대 넣지 않는다)
});
```

| page_type | 경로 |
|---|---|
| home | `/` |
| topic | `/topic/[t]` · curated · challenge · `[category]` (`board` 파라미터로 구분) |
| guide | `/guide/[slug]` |
| tag / curation | `/tag/*`, `/curation/*` |
| spot_hub / spot_region / spot_region_type / spot_type | `/spot` … 4단 |
| place | `/place/[id]` |
| maker / item / device / rehab | 각 상세 |
| consult / meetup / care | 상담·모임·돌봄 |
| portal | `/portal/*`, `service.` `product.` |
| account | `/login` `/signup` `/me/*` (제목·ID 없이 page_type 만) |

### 3-2. 이벤트

| 이벤트 | 언제 | 파라미터 |
|---|---|---|
| `entity_click` | 글의 개체 태그 패널·"이 장소가 등장한 이야기"·"언급된 글" 링크 | `from_page_type`, `entity_type`, `entity_id`, `link_area` |
| `body_map_click` | 노견 신체 지도 부위 | `category` |
| `directory_banner_click` | 글 상단 유형 배너·돌봄 배너 | `spot_type`, `banner` |
| `contact_click` | 업체·브랜드 연락 버튼 | `channel`(kakao·phone·homepage·booking·instagram·naver·blog), `entity_type`, `entity_id`, `spot_type`, `region_sigungu`, `is_promoted` |
| `purchase_click` | 상품 구매 링크 | `vendor`(coupang·brand_store·other), `is_affiliate`, `item_id`, `maker_id` |
| `promo_impression` / `promo_click` | 지역 상단 노출 카드가 화면에 보임 / 클릭 | `entity_id`, `spot_type`, `region_sigungu` |
| `reservation_request` | 예약·상담 신청 완료 | `kind`(spot·care·consult), `entity_id` |
| `direct_chat_start` | 훈련사·멘토 바로 채팅 | `expert_id` |
| `sign_up` / `login` | 가입 완료·로그인 성공 | `method`(email·kakao) |
| `post_submit` | 회원 글 저장 | `topic`, `has_video` |
| `comment` / `save` / `like` | 각 동작 | `entity_type`, `entity_id` |
| `meetup_join` / `meetup_create` | 모임 | `region_sigungu` |
| `request_submit` | 요청함 접수 | `request_kind`(spot_register·spot_claim·maker_claim·promo_slot·care_partner), `plan`(A·B·C) |
| `share` | 공유 버튼(생기면) | `method` |
| `tool_action` | 뉴스 글의 도구에서 인쇄·이미지 저장·파일 저장·결과물 저장 | `kind`(print·download·download_png·save), `tool` |

**보내지 않는 것**: 이메일·닉네임·연락처·메시지 본문·예약 내용·건강 상태 서술. 의료 인접 글은 `category`(부위)까지만.

---

## 4. GTM 컨테이너 구성

| 종류 | 이름 | 설정 |
|---|---|---|
| 태그 | Google 태그 (GA4) | `G-54XBW1L9KE`, 트리거 **Initialization – All Pages**, `send_page_view: false` (페이지뷰는 아래 이벤트로) |
| 태그 | GA4 이벤트 – 공통 | 이벤트 이름 `{{Event}}`, 파라미터는 아래 데이터 영역 변수 전부, 트리거 "GA4 이벤트 목록" |
| 트리거 | GA4 이벤트 목록 | 맞춤 이벤트, 정규식 `^(page_view|entity_click|body_map_click|directory_banner_click|contact_click|purchase_click|promo_impression|promo_click|reservation_request|direct_chat_start|sign_up|login|post_submit|comment|save|like|meetup_join|meetup_create|request_submit|share|tool_action)$` |
| 변수 | DLV – page_type, content_group, topic, category, spot_type, region_sido, region_sigungu, entity_type, entity_id, is_sponsored, is_promoted, is_member_post, login_state, channel, vendor, is_affiliate, kind, method, request_kind, plan, link_area | 데이터 영역 변수(버전 2) |
| 태그(나중) | Meta 픽셀 | 인스타 광고를 집행할 때만, 개인정보처리방침 고지 후 |

- 컨테이너 JSON(가져오기 파일)을 저장소에 만들어 두면 GTM → 관리 → **컨테이너 가져오기(병합)** 한 번으로 끝난다.
- **미리보기(Tag Assistant)** 로 이벤트·파라미터가 들어가는지 확인한 뒤 게시한다.

---

## 5. GA4 속성 설정

| 항목 | 설정 |
|---|---|
| 데이터 보관 | 14개월(최대) |
| 맞춤 측정기준(이벤트) | page_type, content_group, topic, category, spot_type, region_sido, region_sigungu, entity_type, entity_id, channel, vendor, kind, method, request_kind, link_area, is_promoted |
| 맞춤 측정기준(사용자) | login_state |
| 핵심 이벤트 | sign_up, contact_click, reservation_request, request_submit, purchase_click |
| 향상된 측정 | 스크롤·외부 링크·파일 다운로드 켬 / **페이지 변경(기록 기반) 끔** / 사이트 검색 끔(검색 없음) |
| 원치 않는 추천 | `amazoncognito.com`, `kauth.kakao.com`, `accounts.kakao.com` — 카카오 로그인에서 돌아올 때 새 세션·추천 유입으로 잡히지 않게 |
| 내부 트래픽 | 운영진 IP 규칙 + 필터 "활성" (관리자 화면은 코드가 이미 제외) |
| 연결 | **Search Console 연결**(검색어·랜딩 페이지 보고서), BigQuery 연결(선택, 일일 내보내기) |
| 교차 도메인 | 불필요 — `petlifewith.me` 하위 도메인은 같은 쿠키 도메인 |

---

## 6. 유입 검색어 — 사이트 전체와 입점사별

GA4 는 검색어를 주지 않는다(구글·네이버 모두 검색어를 리퍼러로 넘기지 않음). 검색어는 검색엔진 콘솔에서 가져온다.

### 6-1. Google Search Console
- 이미 메타 태그로 소유 확인 가능(배포됨). **도메인 속성**(DNS TXT, `scripts/dns-txt.ps1`)으로 등록하면 하위 도메인까지 한 번에.
- **GA4 연결** → GA4 보고서에서 "Google 자연 검색어·랜딩 페이지" 확인.
- **입점사별 검색어**: Search Console API `searchanalytics.query` 를 `page` 필터(예: `/place/1234-…`)로 매일 돌려 `search_queries_daily(entity_type, entity_id, date, query, impressions, clicks, position)` 에 저장 → 사장님 대시보드 "이 페이지로 들어온 검색어".
  - 주의: 검색량이 적은 검색어는 개인정보 보호로 빠진다(익명 검색어). 작은 업체는 "검색 노출 수" 합계가 더 의미 있다.
  - 대안: **대량 데이터 내보내기(BigQuery)** — URL·검색어 단위 전체 데이터. 페이지가 많아지면 이쪽이 쿼리 제한이 없다.
- 서비스 계정을 만들어 Search Console 속성에 "제한된 사용자"로 추가 → 서버(예약 작업 Lambda)가 매일 가져온다.

### 6-2. 네이버
- **네이버 서치어드바이저** 사이트 등록(TXT 인증) + 사이트맵 제출. 검색어·노출 리포트는 콘솔에서 본다.
- 입점사별 자동 리포트는 네이버 API 제공 범위가 좁아 **1차는 운영진 수동 확인**으로 둔다(확인 후 가능하면 추가).
- 국내 검색은 네이버 비중이 커서, "네이버 검색" 유입 세션 수는 GA4(소스 `naver`)로 꼭 따로 본다.

### 6-3. 인스타그램 (UTM 규칙)
```
utm_source=instagram
utm_medium=bio | story | reels | post | ad
utm_campaign=<캠페인 슬러그>   예) senior-day-2026-11, play-follow
utm_content=<게시물 구분>      예) joint-card-01
```
프로필 링크·스토리 링크는 전부 이 규칙. 사장님 포털 홍보는 `utm_campaign=partner-*` 로 구분.

### 6-4. AI 어시스턴트 유입 (ChatGPT · Perplexity · Gemini · Copilot · Claude …)

AI 답변 속 출처 링크로 들어오는 방문. 기본 GA4 에서는 "추천(Referral)"에 섞여 있으므로 **맞춤 채널 그룹**으로 떼어 본다.

- **GA4 관리 → 데이터 표시 → 채널 그룹 → 새로 만들기**(기본 그룹 복사) → 채널 `AI 어시스턴트` 추가
  - 조건: 세션 소스 **정규식 일치**
    `.*(chatgpt|openai|perplexity|copilot\.microsoft|gemini\.google|bard\.google|claude\.ai|deepseek|grok|meta\.ai|you\.com|phind|poe\.com|wrtn|clova-x).*`
  - **"추천" 채널보다 위로** 순서를 올린다(위에서부터 먼저 맞는 채널로 분류된다). 맞춤 채널 그룹은 지난 데이터에도 적용된다.
- 보는 곳
  - 획득 → 트래픽 획득: 기본 채널 그룹을 새 그룹으로 바꿔 AI 유입 세션·참여율·핵심 이벤트를 다른 채널과 비교
  - 탐색 분석(자유 형식): 행 = 세션 소스 · 방문 페이지, 필터 = 채널 `AI 어시스턴트` → **AI 가 어떤 글·업체 페이지를 인용하는지**
- 입점사 리포트에도 넣는다: 비콘(`/api/collect`)이 `document.referrer` 의 도메인을 위 목록으로 분류해 `entity_stats_daily.views_ai` 로 센다 → "AI 검색에서 소개돼 들어온 방문 n회".
- 한계
  - **질문(프롬프트)은 알 수 없다** — AI 서비스가 넘기지 않는다.
  - 앱·일부 브라우저는 리퍼러를 안 넘겨 "직접"으로 잡힌다(실제보다 적게 보인다). ChatGPT 는 링크에 `utm_source=chatgpt.com` 을 붙이는 경우가 많아 비교적 잘 잡힌다.
  - 구글 검색 결과 안의 AI 요약(AI 개요)은 구분되지 않고 "자연 검색(google)"으로 잡힌다.
- AI 가 사이트를 **읽어 가는 횟수**(GPTBot·OAI-SearchBot·ChatGPT-User·PerplexityBot·ClaudeBot 등)는 GA4 에 안 보인다(자바스크립트를 실행하지 않음). 필요하면 CloudFront 로그·서버에서 User-Agent 로 센다. 지금 `robots.txt` 는 이 봇들을 막지 않는다(인용되려면 열어 두는 것이 맞다).

---

## 7. 입점사 리포트 (자체 집계)

### 7-1. 수집
- 경량 비콘 `POST /api/collect` — `{ t: "view"|"contact"|"promo_impression"|"promo_click", e: "spot:1234", ch?: "kakao" }`.
  `navigator.sendBeacon` 으로 보내 페이지 이동을 막지 않는다. **쿠키·IP 저장 없음**, 봇 UA 제외, 같은 브라우저 탭에서 같은 개체 조회는 30분에 1번.
- 서버는 `entity_stats_daily(entity_type, entity_id, date, views, contact_kakao, contact_phone, …, promo_impressions, promo_clicks)` 를 upsert(+1) — 행 수가 "개체 × 일"이라 작다.
- 예약 신청·저장 수는 이미 DB 에 있는 표(`reservations`, `reactions`)에서 센다.
- 기존 `contact_logs`(로그인 회원의 연락 기록)는 회원 본인용으로 그대로 둔다.

### 7-2. 보여 주기
- `/me/business/spot/[id]` · `/me/business/maker/[id]` 에 **"이번 달 · 지난달"** 카드: 조회, 연락(채널별), 예약 신청, 저장, 검색 노출·클릭, 검색어 Top 10, 이 업체가 나온 글.
- 유료 상단 노출 업체: 슬롯 노출·클릭과 같은 지역×유형 페이지 조회(수요).
- `/admin` 통계: 유형·지역별 수요(조회) 지도, 검색어 상위, 연락이 많은 유형 — 영업·콘텐츠 기획에 쓴다.
- 월 1회 요약 메일(선택, SES 연결 후).

---

## 8. 개인정보·정책

- 개인정보처리방침에 **GA4·GTM(쿠키)·Search Console** 사용과 목적을 적는다. 광고 픽셀을 쓰게 되면 그때 추가.
- dataLayer·비콘에 개인을 식별할 값(이메일·닉네임·연락처·회원 ID)을 넣지 않는다. GA4 `user_id` 는 쓰지 않는다(필요해지면 내부 ID 해시로, 방침 고지 후).
- 의료 인접 정보는 페이지 분류(`category`)까지만, 증상 서술·상담 내용은 보내지 않는다.
- 관리자 화면은 지금처럼 수집 제외. 사장님 포털은 수집(실사용 화면).

---

## 9. 실행 순서

| 단계 | 내용 | 누가 | 기간 |
|---|---|---|---|
| **1** | GA4 속성 설정(5장), Search Console 도메인 속성 + GA4 연결, 네이버 서치어드바이저 등록 | 운영진(콘솔) | 반나절 |
| **2** | 코드: `lib/track.ts`(dataLayer 헬퍼) + 페이지 문맥 + 3-2 이벤트 심기, GTM 가져오기 JSON 생성 | 개발 | 1~2일 |
| **3** | GTM 가져오기 → 미리보기 검증 → 게시, GA4 실시간·DebugView 로 확인 | 운영진 + 개발 | 반나절 |
| **4** | 자체 집계: `/api/collect` + `entity_stats_daily`(마이그레이션) + 사장님 대시보드 카드 | 개발 | 2~3일 |
| **5** | Search Console API 일일 수집(서비스 계정, 예약 Lambda) + 검색어 카드 | 개발 + 운영진(서비스 계정 권한) | 1~2일 |
| 6 | 관리자 통계 화면, 월간 요약 메일, (광고 집행 시) Meta 픽셀 | 개발 | 이후 |

**비용**: GA4·GTM·Search Console·서치어드바이저 무료. BigQuery 내보내기는 무료 한도(저장 10GB·쿼리 월 1TB) 안에서 시작 가능. 자체 집계는 기존 RDS·Lambda 로 충분.

---

## 10. 결정할 것

1. 입점사 리포트를 **모든 업체**에 열지, **유료 상단 노출 업체 먼저**(영업 도구) 열지
2. Search Console 수집 방식 — API 일일 수집(간단, 시작용) vs 대량 내보내기 BigQuery(규모 커지면)
3. 인스타 광고(Meta 픽셀) 집행 계획 여부 — 있으면 개인정보처리방침·동의 문구를 같이 준비
4. 운영진 사무실 IP(내부 트래픽 필터용)
