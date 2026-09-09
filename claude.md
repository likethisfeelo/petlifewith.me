# petlifewith.me

반려동물과의 삶에서 **"즐거움"** 을 다루는 콘텐츠 미디어. 디렉토리(스팟·메이커)를 병렬로 둔다.

기존 서비스들이 "어디에 데려갈 수 있나"를 다룬다면, 이 서비스는 "무엇이 즐거운가"를 다룬다. 주어가 사람이 아니라 반려동물이다.

상세 기획은 `docs/기획서.md`. **작업 시작 전 반드시 읽을 것.**

---

## 1. 현재 단계 — 배포 도구 준비 완료, 첫 배포 대기

도메인·ACM 인증서(us-east-1, ARN 은 `sst.config.ts`)·IAM 사용자(프로필 `petlife`)까지 완료.
**배포 방식은 SST v4(OpenNext) 로 확정** — 정의는 루트 `sst.config.ts`. **배포 실행은
GitHub Actions**(`.github/workflows/deploy.yml`, 리눅스 러너)가 표준이다 — OpenNext 는
Windows 빌드를 지원하지 않아 로컬(Windows) `sst deploy` 는 깨진 번들을 만든다(실증:
Lambda `Cannot find package 'next'`). `deploy.ps1` 은 Windows 에서 이를 거부하는 가드가
있고 WSL/리눅스용으로만 쓴다. DB 준비는 `scripts/aws-db.ps1`, 런북은 `docs/배포.md`.

- 로컬 개발 DB는 계속 로컬 PostgreSQL/Docker. 배포 DB(RDS `petlife-db`)는 SST 밖에서
  `aws-db.ps1` 이 관리한다 — 상태 리소스를 IaC 에 넣지 않는다.
- 시크릿: 로컬 `.env.local`, 배포는 `.env.deploy.<stage>` (둘 다 gitignore). Secrets Manager
  코드는 아직 넣지 않는다. AWS 액세스 키는 코드·채팅 어디에도 넣지 않는다.
- **CloudFront + Lambda(OpenNext) 전제**로 설계한다. Vercel 전용 기능에 의존하지 않는다.
- CloudFront 인증서는 us-east-1 발급 (`petlifewith.me` + `*.petlifewith.me` 와일드카드).

```
로컬 경로  C:\petlifewithme
리포       github.com/likethisfeelo/petlifewith.me (private)
도메인     petlifewith.me (Route53 보유, 배포 대기)
호스트     메인 petlifewith.me / admin. 전체 관리자 / service. 업체 사장님 /
           product. 제품 사장님 / dev. 스테이징(preview, 전면 noindex)
           dev 의 기능 서브도메인은 하이픈: admin-dev. service-dev. product-dev.
           (2단계 서브도메인은 와일드카드 인증서 미커버 — lib/hosts.ts 하이픈 형식)
```

호스트 라우팅은 `web/src/middleware.ts` — admin/service/product 는 같은 앱에서 호스트로 갈라진다.
기획서의 "지역별 서브도메인 금지"는 콘텐츠 SEO 결정이라 이 운영용 분리와 충돌하지 않는다
(지역 URL 은 계속 서브폴더, 서브도메인 페이지는 전부 noindex).

---

## 2. 실행 환경

| 항목 | 값 |
|---|---|
| OS | Windows 11, PowerShell |
| 패키지 매니저 | **pnpm** (npm/yarn 금지) |
| Node (배포 타깃) | **22 LTS** |
| 프레임워크 | Next.js (App Router), TypeScript, Tailwind |
| DB | PostgreSQL |

로컬 Node가 LTS가 아닐 수 있다. 배포 타깃은 항상 22로 맞춘다.

---

## 3. 디렉토리

```
web/       Next.js 앱
data/      공공데이터 수집·정규화 ETL
docs/      기획서, 스키마 문서
scripts/   로컬 운영 스크립트 (PowerShell)
```

`data/raw/`는 gitignore 대상. 원본 덤프를 커밋하지 않는다.

---

## 4. URL 구조

```
/                              홈
/guide/[slug]                  개별 콘텐츠
/topic/[cluster]               토픽 허브
/item/[id]-[slug]              상품 (언급된 콘텐츠 역참조)
/spot/[시도]/[시군구]/[유형]/   지역 x 유형
/place/[id]-[slug]             개별 장소
/maker/[id]-[slug]             메이커(브랜드) 프로필
/curation/[theme]              크리에이터 큐레이션 (테마 단위)
```

**단일 도메인 + 서브폴더.** 지역별 서브도메인을 만들지 않는다. 검색엔진에 특정 호스트를 특정 지역 담당으로 지정하는 수단이 존재하지 않으므로, 도메인을 쪼개면 권위만 분산된다.

**`/creator/[handle]` 개인 허브 페이지를 만들지 않는다.** 특정 창작자 이름으로 페이지를 만들고 그 사람 콘텐츠를 모으면 내용 대부분이 타인 저작물이 되어 얇은 콘텐츠 판정과 권리 분쟁에 동시에 노출된다. 큐레이션은 테마 단위로만.

---

## 5. 확정된 결정 — 되돌리지 말 것

변경이 필요해 보이면 코드를 고치기 전에 먼저 물어볼 것.

**5-1. 위치 감지는 UX 레이어에만.**
IP·브라우저 위치로 지역을 감지해 배너로 제안한다. 강제 리다이렉트를 기본값으로 하지 않는다. **크롤러에는 위치 기반 분기를 적용하지 않는다** — 클로킹이다. 모든 지역 URL은 위치와 무관하게 독립 크롤·색인 가능해야 한다.

**5-2. 데이터 출처는 공공데이터 + 직접 발굴만.**
네이버 플레이스, 카카오맵, 경쟁 플랫폼 크롤링 금지. 카카오맵의 '반려동물 동반 가능' 속성은 API로 제공되지 않으므로 앱에 보인다고 가져오지 않는다.

**5-3. 얇은 콘텐츠 방지를 코드로 강제한다.**
- 스팟 3개 미만 지역 페이지 → `noindex`
- 정보 3항목 미만 개별 장소 → `noindex`
- 지역 페이지마다 고유 데이터 블록 (스팟 밀도, 유형 분포, 노령견 비율, 관련 콘텐츠)
- 인허가 데이터를 그대로 덤프하지 않는다. 이미 그렇게 하는 경쟁 사이트가 있고 그 방식으로는 못 이긴다. 콘텐츠와 태깅으로 연결된 스팟을 우선 노출한다.

**5-4. 콘텐츠와 디렉토리는 개체 단위로 태깅한다.**
"관련 글" 수준의 느슨한 연결이 아니다. 마사지 글의 마사지 도구에 상품 태그, 노즈워크 글의 장난감에 메이커 태그, 스파 글에 스팟 카드. 태깅이 쌓이면 "이 장난감이 언급된 글 N개" 역방향 페이지가 자동 생성된다.

**5-5. 스키마는 처음부터 최종형.**
콘텐츠, 상품, 스팟, 메이커, 태깅 관계를 런칭 시점에 전부 정의한다. 데이터가 비어 있어도 상관없다.

**5-6. 개인정보.**
메이커·스팟 프로필에 대표자 개인명과 상세 주소(동·호수)를 표시하지 않는다. 1인 브랜드는 영업장과 주거지가 같은 경우가 많아 정부 개방 데이터조차 비식별 처리해 제공한다. 동일 기준을 적용한다.

---

## 6. 콘텐츠 규칙

### 6-1. 클러스터

초반은 **노견생활 + 놀이** 두 개를 동시에 민다. 케어·힐링, 간식은 2차.

노견 클러스터는 **신체 영역별 스포크 + 4단 흐름** 구조다. 각 편은 "변화를 느낀 순간 → 무엇을 살펴볼까 → 확인하는 방법 → 도울 수 있는 것 → 일상을 편하게"로 흐른다. 상세는 기획서 SECTION 02.

### 6-2. 의료 인접 콘텐츠 — 엄격히 지킬 것

노견 콘텐츠는 필연적으로 의료에 근접한다. 다음은 타협하지 않는다.

- **일반 동물병원 디렉토리를 만들지 않는다.** 순위·추천·평점 구조 자체를 만들지 않는다. 수의사법 광고 규제 영역이다.
- **건강검진은 병원 추천이 아니라 "무엇을 물어봐야 하는가"로 쓴다.**
- **치료·진단 기기는 주어를 병원이 아니라 기기로 둔다.** 원리와 스펙까지 서술하되 **효과를 단정하지 않는다.** "관절염에 효과적"은 의료 광고다. "○○ 목적으로 사용된다"까지만.
- **기기 보유 병원 목록은 무료 노출 전용.** 광고 상품으로 만들지 않는다.
- **소비자용 모니터링 기기를 다룰 때 "이상 신호를 감지하면 병원으로"라는 결론을 반드시 포함한다.** 기기가 진단을 대체한다는 인상을 주면 진료 시기를 놓치게 만든다.
- **장묘는 광고를 붙이지 않는다.** 사실 정보만 표시하고 순위·추천을 하지 않는다.
- 의료 인접 편에는 수의사 감수 표기를 넣는다. 감수 전에는 발행하지 않는다.

### 6-3. 크리에이터 큐레이션 — 저작권

**금지**
- 인스타그램·유튜브의 이미지·썸네일·프레임을 다운로드해 우리 서버에 올리는 것. 스크린샷 포함.
- 자막·캡션 전문 복사
- 영상 재업로드

**허용**
- 유튜브 공식 iframe 임베드
- 인스타그램 공식 임베드 코드 (막히면 그 콘텐츠는 포기한다. 우회하지 않는다)
- 링크 + 우리 언어로 쓴 요약. 인용은 15단어 미만.

**발행 전 판정 기준**: 임베드를 전부 제거했을 때 그 페이지가 여전히 읽을 가치가 있는가? 아니면 발행하지 않는다.

모든 인용·임베드에 창작자명과 원본 링크를 **본문 내 해당 위치**에 표기한다. 하단 일괄 표기가 아니다.

### 6-4. 고지 의무

쿠팡 파트너스 링크가 포함된 모든 페이지에 수수료 고지를 노출한다. 브랜드 협찬 콘텐츠에는 광고 표기를 넣는다. 누락 시 계정 정지 및 제재 사유다.

---

## 7. 데이터 소스

모두 data.go.kr. localdata.go.kr은 공공데이터포털로 통합됐다.

**시딩** (전부 행정안전부 지방행정 인허가 — 페이지에 출처·기준일·관리번호 명시)
| 데이터 | 용도 |
|---|---|
| 동물미용업 인허가 | 스파·마사지 (2026-08 적재 완료 16,107) |
| 동물위탁관리업 인허가 | 놀이터·유치원·수영장·데이케어 |
| 동물장묘업 인허가 | 장묘 (광고 없음) |
| 동물운송업 인허가 | 반려동물 이동 (2026-08 적재 완료 4,643 — 차량 단위) |
| 동물약국 인허가 | 동물약국 찾기 — **광고·순위 없음 + 수의사 안내** (2026-08 적재 20,796) |
| 동물용의약품 도매상 / 의료용구 판매업 | **B2B 참고 디렉토리** — 광고 없음, 소비자 목록과 분리 게시 (2026-08 적재 1,316+3,345) |
| 사료제조업 인허가 | 수제간식 메이커 + 등록 확인 배지 |

2026 행정구역 개편: 전남광주통합특별시 표기는 시군구명으로 옛 시도에 귀속(URL 유지),
인천 신설 4개 구(제물포·영종·검단·서해) 지역 테이블 반영 — `data/src/regions/regions.ts`.

**통계 (지역 페이지 고유 데이터)**
- 농림축산검역본부 동물등록 현황 API — 시군구별·**출생연도별** 집계. 여기서 **지역별 노령견 비율**을 산출한다. 노견 클러스터의 핵심 근거 수치이자 지역 페이지 차별화 요소.

**직접 발굴 (경쟁 우위)**
셀프목욕시설 / 방문·출장 목욕 / 재활·수중런닝머신 보유처 / 치료 기기 보유 병원 / 장난감·용품 메이커. 공공데이터에 없어 경쟁자도 못 만든다.

직접 발굴 목록은 **큐레이션 CSV**(`data/content/**`, 커밋)로 적재한다 — `pnpm etl:direct`(스팟) /
`pnpm etl:rehab`(재활·한방·특수치료 시행처). 셀 `#` = 미확인(재적재 시 기존 값 유지), 외부키 upsert.
2026-09 적재: 숨고 정리본 48행(미용·출장목욕·셀프목욕·호텔) + 재활·한방·특수치료 123행(`/rehab`,
치료법이 주어 — 병원 디렉토리·등급 아님). 규약은 `docs/운영.md` 4-3.

**배지**: "면허 확인", "사료제조업 등록 확인" 같은 사실 진술만 쓴다. "인증"이라는 표현을 쓰지 않는다. 배지 툴팁에 검증 항목과 기준일을 명시한다.

---

## 8. 코딩 규칙

### 8-1. PowerShell 스크립트는 ASCII 전용

**`.ps1`, `.psm1`, `.bat`, `.cmd`에 ASCII(0x00-0x7F) 문자만 쓴다.** 한글, 이모지, `→`, `─` 금지. 주석과 출력 메시지 모두 영문.

이유: Windows PowerShell 5.1은 BOM 없는 UTF-8을 CP949로 읽는다. 파일이 다운로드되거나 재저장될 때 BOM이 사라지면 한글이 깨지고 따옴표 짝이 무너져 파서가 실패한다.

검증:
```powershell
Select-String -Path .\scripts\*.ps1 -Pattern '[^\x00-\x7F]'
```
아무것도 출력되지 않아야 한다.

`.md`, `.ts`, `.tsx`, `.sql`은 해당 없다. 한글을 쓴다.

### 8-2. 시크릿

`.env.local`에 두고 절대 커밋하지 않는다. `.env.example`에는 변수 이름만.

`.git/hooks/pre-commit`이 `AKIA` 패턴, `.env`, `.pem`, `credentials`를 차단한다. `--no-verify`로 우회하지 않는다.

### 8-3. 줄바꿈

`.gitattributes`가 관리한다. `.ps1`은 CRLF, 나머지는 LF. `core.autocrlf`는 false.

### 8-4. 커밋

Conventional Commits. 스코프는 디렉토리명.

```
feat(web): 노견 클러스터 허브 템플릿
feat(data): 동물등록 현황 출생연도별 집계 파이프라인
fix(seo): 스팟 3개 미만 지역 noindex 누락
```

---

## 9. 작업 방식

**계획 먼저.** 파일을 여러 개 건드리는 작업은 코드 작성 전에 계획을 제시하고 승인을 받는다.

**추측하지 않는다.** 공공데이터 API의 파라미터나 응답 구조를 모르면 문서를 확인하거나 물어본다. 지어내지 않는다.

**브랜드 확정: 펫라이프위드미 (반려동물의 행복한 삶, 나와 함께 - pet life with me).** 표시명은 `NEXT_PUBLIC_SITE_NAME`(기본값이 확정 브랜드), 태그라인은 `NEXT_PUBLIC_SITE_TAGLINE`(덮어쓰면 토픽 구분 없음). 놀이 클러스터(`/topic/play` 와 그 글)에서는 태그라인이 "반려동물의 즐거운 삶, 나와 함께 - pet life with me"로 바뀐다 — 문구는 `web/src/lib/tagline.ts`, 전환은 `components/site-tagline.tsx`(주소로 알거나 글 페이지가 `<TopicTagline>` 로 알린다). `package.json` name·DB 이름·패키지명에는 여전히 서비스명을 넣지 않는다 — 표기 변경 비용을 코드에 만들지 않기 위해서다.

---

---

## 10. 향후 AWS 전환 대비 — 지금부터 지킬 제약

최종 배포는 **전부 AWS**다. CloudFront + Lambda(OpenNext) + RDS PostgreSQL + S3 + Cognito, 리전은 `ap-northeast-2`(인증서만 `us-east-1`).

지금은 로컬에서 개발하지만, 아래는 **나중에 고치면 마이그레이션이 되는 것들**이라 처음부터 지킨다.

### 10-1. 파일 업로드는 처음부터 S3 전제

**로컬 파일시스템에 쓰지 않는다.** Lambda에는 영속 디스크가 없고 `public/`에 런타임 업로드가 불가능하다. 이걸 나중에 고치려면 업로드 경로 전체를 다시 짜야 한다.

- 업로드는 **presigned URL 패턴**으로 설계한다. 서버가 URL을 발급하고 클라이언트가 직접 올린다.
- 로컬 개발에서는 MinIO(S3 호환) 컨테이너를 쓰거나, S3 클라이언트를 인터페이스로 감싸고 로컬 어댑터를 둔다.
- DB에는 파일 경로가 아니라 **오브젝트 키**를 저장한다. 도메인이나 버킷명을 DB에 박지 않는다.

콘텐츠 미디어라 이미지가 많다. 이 결정이 가장 크게 물린다.

### 10-2. DB 연결은 풀링 전제

Lambda는 동시 실행마다 컨테이너가 뜨므로, 요청마다 새 커넥션을 열면 RDS 연결 수가 금방 고갈된다.

- 커넥션을 **모듈 스코프에서 재사용**한다. 핸들러 안에서 `new Client()` 하지 않는다.
- ORM 설정에 연결 수 상한을 둔다.
- 나중에 RDS Proxy를 붙일 수 있게 **연결 문자열을 한 곳에서만 읽는다.**

### 10-3. 시크릿 접근은 한 파일로 격리

`.env.local` → Secrets Manager 전환이 한 파일 수정으로 끝나야 한다.

```ts
// lib/config.ts — 유일한 진입점
export async function getSecret(name: string): Promise<string>
```

`process.env`를 코드 곳곳에서 직접 읽지 않는다.

### 10-4. 캐싱·재검증 전략을 미리 정한다

콘텐츠 사이트라 ISR 비중이 크다. OpenNext에서 ISR은 S3 + 재검증 큐로 동작하므로, 페이지별 재검증 주기를 지금 정해둔다.

- 콘텐츠 상세: 길게 (수동 재검증)
- 스팟·지역 페이지: 데이터 동기화 주기에 맞춤
- 목록·홈: 짧게

`revalidate` 값을 페이지마다 흩뿌리지 말고 상수 모듈로 관리한다.

### 10-5. Cognito — 스키마와 어트리뷰트를 먼저 확정

**User Pool은 생성 후 필수 어트리뷰트를 변경할 수 없다.** 나중에 바꾸려면 풀을 새로 만들고 사용자를 이전해야 한다. 그래서 스키마 설계 시점에 결정한다.

**절대 원칙: Cognito `sub`를 DB의 기본키로 쓰지 않는다.**

```
users
  id          UUID PK          <- 내부 식별자. 모든 FK가 이걸 참조
  cognito_sub TEXT UNIQUE NULL <- Cognito 연결용. 나중에 채워도 됨
  ...
```

이렇게 두면 지금 인증 없이 개발하다가 나중에 Cognito를 붙일 때 컬럼 하나만 채우면 된다. `sub`를 PK로 쓰면 인증 공급자를 바꾸거나 풀을 재생성할 때 전체 FK가 무너진다.

**런칭 시점에 인증이 필요한 범위**는 좁다. 대부분의 콘텐츠는 비로그인으로 읽힌다. 실제로 필요한 건 스팟·메이커 **클레임**과 관리자다. 그래도 `users` 테이블은 지금 만든다.

**2026-09 갱신 — 회원 글·댓글을 켰다.** Cognito 앞에 자체 이메일·비밀번호 회원(`users.password_hash`, scrypt)과 서명 쿠키 세션을 넣었다. 원칙은 그대로다: PK 는 내부 `id`, `cognito_sub` 는 비어 있고, 인증 호출은 `lib/auth.ts`·`lib/member.ts`·`lib/password.ts` 에만 있다. Cognito 로 바꿀 때 회원 세션 발급부와 로그인 액션만 갈아 끼운다. 회원 글은 승인(pending → published) 후에만 공개된다 (`docs/운영.md` 5-7).

**소셜 로그인 주의.** 국내 서비스라 카카오 로그인이 사실상 필수가 된다. Cognito는 Google·Facebook·Apple과 SAML/OIDC 공급자를 지원하므로, 카카오·네이버는 **범용 OIDC 공급자로 연결**하는 경로를 검토해야 한다. 다만 각 사의 OIDC 표준 준수 정도가 다르고 네이버는 제약이 있을 수 있으니, **User Pool 생성 전에 실제 연동 가능 여부를 확인한다.** 표준 OIDC로 안 되면 Lambda 트리거 기반 커스텀 플로우가 필요하고, 이건 설계가 달라진다.

**인증 라이브러리.** Amplify SDK는 번들이 무거워 Lambda 콜드스타트에 불리하다. Auth.js(NextAuth)의 Cognito 프로바이더나 직접 OIDC 처리를 검토한다. **세션은 JWT 전략**을 기본으로 한다 — Lambda에서 세션 조회 DB 왕복을 줄인다.

**인증 호출을 흩뿌리지 않는다.** `lib/auth.ts` 하나로 감싸고, 컴포넌트나 라우트에서 Cognito SDK를 직접 부르지 않는다.

### 10-6. Vercel 전용 기능을 쓰지 않는다

Vercel KV, Blob, Edge Config, `@vercel/*` 패키지에 의존하지 않는다. Edge Runtime 전용 API도 피한다 — OpenNext 배포에서 동작이 달라진다.

### 10-7. 이미지 최적화

`next/image`는 쓰되, Lambda에서 이미지 최적화는 비용과 콜드스타트에 영향이 크다. **업로드 시점에 여러 사이즈를 미리 생성해 S3에 저장**하는 방향을 기본으로 검토한다. 원본만 저장하고 런타임 변환에 의존하지 않는다.

### 10-8. 지금 만들지 않는 것

Secrets Manager 호출 코드, Cognito User Pool, CI/CD 파이프라인(배포는 로컬 `deploy.ps1`),
VPC/RDS Proxy. 쓰지 않는 리소스를 미리 세우면 비용만 나간다.

배포 정의는 `sst.config.ts` 로 확정됐다(스테이지 prod/dev 만 허용, prod 는 protect+retain).
보안 트레이드오프(퍼블릭 RDS, `sslmode=no-verify`)와 강화 경로는 `docs/배포.md` 6장에 명시.

---

## 11. 구현 현황 (2026-08 플랫폼 구축 완료)

플랫폼 1차 구축이 끝났다. 상세는 `docs/스키마.md`(스키마·강제 규칙·가정), `docs/운영.md`(실행·ETL·콘텐츠 워크플로).

- **DB**: 22개 테이블 최종형 (Drizzle, `data/src/db/schema.ts`, 마이그레이션 `data/drizzle/`). 의료 감수 게이트·클레임 단일 대상·출처 표기 필수를 CHECK/NOT NULL 로 강제.
- **web**: 기획서의 URL 구조 전체 (홈 / guide / topic / item / spot 4단 / place / maker / curation) + 클레임 접수. AWS 전환 제약 준수 — config/db/auth/storage 단일 진입점, revalidate 상수 모듈(+일치 테스트), presigned URL 스토리지.
- **관리자**: 게시글(작성·편집·개체 태깅) / 스팟 / 메이커 / 상품 / 기기 / 큐레이션 등록·편집 + 클레임 승인 + 미디어 라이브러리. 외부 링크는 `spot_links`·`maker_links` 로 필요한 것만 선택(홈페이지·카카오톡·예약·스마트스토어 등), 상품 구매 링크는 쿠팡 파트너스 제휴 플래그와 고지 자동 연동.
- **미디어·SEO**: 이미지·영상 업로드는 presigned URL(로컬 MinIO, `docker compose up -d minio` 로 버킷 자동 생성) — DB 에는 오브젝트 키만, 본문 삽입은 `{{image:키|alt}}` 숏코드. 전 공개 페이지에 OG/Twitter 메타 자동 + 페이지별 오버라이드(seo_title/seo_description/og_image_key, 게시글·스팟·메이커·상품·큐레이션).
- **SEO**: noindex 게이트(스팟 3곳·정보 3항목·언급 0건) 코드 강제 + 사이트맵 분할 + JSON-LD + 로컬 전면 noindex 가드.
- **ETL**: 인허가 CSV 헤더 기반 정규화(미매핑은 실패·리포트, 추측 없음), 관리번호 upsert, 상세주소 제거, 동물등록 통계 → 노령견 비율.
- **실데이터 (2026-08-25)**: 행안부 인허가 5종 46,208건 적재 — 미용업·운송업·동물약국(공개, 약국은 광고 금지+수의사 안내) / 의약품 도매·의료용구 판매(`spot_types.listed=false` 비공개, 지역 인프라 집계·어드민 전용). 전 페이지에 출처(행안부)·기준일·관리번호 표기. 지역 페이지 목록 48곳 상한(전체는 유형 페이지). 어드민 스팟 검색·필터·페이지네이션. 2026 행정구역 개편 반영(전남광주 통합 귀속 + 인천 신설 4구, 지역 233).
- **회원·커뮤니티 (2026-09)**: 자체 이메일·비밀번호 회원 + 서명 쿠키(0005: users 컬럼·comments·guides.author_user_id·status pending). `/signup /login /me /write`, 헤더 메뉴는 `/api/me`(ISR 유지). 회원 글은 승인 후 공개(외부 링크 nofollow ugc, 회원 글 안내문), 댓글은 즉시(평문·시간당 20건), 관리자 `/admin/members`(차단) `/admin/comments`(숨김·삭제).
- **돌봄 파트너 디렉토리 (2026-09)**: 펫시터(보호자 집 방문)·시간제 시터(`hourly-sitter`, 시터 집에 맡기는 시간 단위, 신설)·펫산책은 주소 대신 `spot_service_areas`(0008)로 노출 — `/spot/type/pet-sitter|hourly-sitter|dog-walk` 는 시설과 같은 디렉토리 셸(좌측 타일 지도 — 배지는 서비스 지역 기준 사람 수, 시군구 타일은 `/spot/시도/시군구/pet-sitter` 지역x유형 페이지 링크), 지역x유형 페이지 우측이 **5자리**(빈 자리 "비어있습니다", `MAX_EXPOSED_PER_AREA`, `components/care/care-slots.tsx`). 카드 버튼 예약 신청(`booking_requests` + 슬랙 웹훅 `SLACK_BOOKING_WEBHOOK_URL`, `app/booking-actions.ts`)·카카오톡 상담(`spot_links.kakao`). 관리자 `/admin/care`(지역별 노출 ON/OFF, 상한 검사)·`/admin/bookings`·스팟 편집기 서비스 지역. 가상 예시 2건은 `source=sample`("예시" 배지, noindex). 통칭 "돌봄 파트너", 호칭 펫시터/시간제 시터/도그워커 (`data/src/care/care.ts`). `/topic/senior-life` 하단 돌봄 배너(`components/care/care-entry-banner.tsx`: 직접 방문 유치원·데이케어·시간제 시터 / 집으로 오는 펫시터·산책). `docs/운영.md` 5-8.
- **디렉토리 배너·돌봄 유형 (2026-09)**: 스팟 유형 `pet-sitter`·`dog-walk` 추가(직접 발굴·업체 등록). `guides.banner_spot_types`(0006·0007)로 글 상단 3열 배너(관리자 체크, 시드 `banners:`) → `/spot/type/[유형]` 디렉토리 링크. 커뮤니티 게시판이 아니라 업체 검색·등록 입구다.
- **부위별 게시판 (2026-09)**: `/topic/[토픽]/[카테고리]` — 카테고리 필터가 곧 게시판(별도 테이블 없음). 지도 패널은 글 3편 + "○○ 영역별 정보 더 보기", 패널 질문은 실제 게시글(`data/src/guides/seed-posts.ts` 시드, 본문 400자 미만 → noindex `shouldIndexGuide`). 글쓰기는 `/write?topic=&category=` 로 미리 채움.
- **글쓰기 흐름 · 블록 편집기 · 태그 (2026-09, 0011)**: 회원 글쓰기는 주제 → (카테고리가 있으면) 카테고리 → 편집 순서. 본문은 블록 편집기(`components/editor/block-editor.tsx`, 관리자·회원 공용 — 사진·영상 끌어다 놓기·섬네일, 제목/소제목/본문, 마크다운 토글, 저장은 마크다운 그대로 `lib/blocks.ts`). 태그는 `guides.tags text[]`(칩 입력 `components/editor/tag-input.tsx` + 본문 `#태그` 합본, 규칙 `lib/tags.ts`), 렌더 시 `#태그` → `/tag/[태그]` 링크, 태그 페이지는 3편 미만 noindex. `docs/운영.md` 5-11.
- **놀이 영상 피드 · 회원 미디어 업로드 (2026-09, 0010)**: `/topic/play` 는 운영진·회원 글 전체를 영상 카드(섬네일 + 호버 미리보기, `components/media/media-card.tsx`)로 보여 주고 놀이 글은 태그된 상품·브랜드 링크를 우측 패널에 둔다(다른 토픽은 그대로). 대표 영상 `guides.hero_media`(`lib/media-ref.ts`). 업로드는 관리자·회원 공용 `app/upload-actions.ts` — 영상은 브라우저에서 포스터를 잡고(`media_assets.poster_key`) 길이 상한(기본 180초) 안으로 mediabunny 코덱 복사 자르기(`components/media/use-media-uploader.tsx`), 회원 자산은 `uploader_user_id` 로 소유 검사. 편집기 툴바(사진·영상·유튜브·인스타그램 게시물/릴스만) `components/media/media-toolbar.tsx`. 한도·승인 대기는 `/admin/settings`(`site_settings.member_media`, 기본 제한 없음·승인 대기 켬). `docs/운영.md` 5-10.
- **스팟 디렉토리 셸 (2026-09)**: 유형 허브·시도·지역 허브·지역x유형이 `components/spot/spot-directory.tsx`(좌측 시도→시군구 타일 지도, 우측 서버 목록) 하나로 렌더. 시군구 타일은 지역x유형 페이지로 가는 진짜 링크 — SEO 페이지가 곧 지도 페이지, 주소·사이트맵 불변. 시도 페이지는 유형 칩으로 배지·링크 전환. 돌봄 파트너 허브·지역x유형도 같은 셸(배지 단위 "명", `countsBySido`·`total`·`unit`), 시도 칩·지역 허브 분포의 돌봄 수는 서비스 지역 기준(`listCareCountsByRegion`)이고 주소 기준 유형 집계는 돌봄 유형을 뺀다. `docs/운영.md` 5-9.
- **게시판 3분할 (2026-09)**: 큐레이션 콘텐츠(`guides.curated` + `curated_order` 1~9, 토픽 상단 9편·`/topic/[t]/curated`) / 일반 게시판(회원 글 전체, 노견생활 이름 "일반 - 노령견 생활 공유 게시판" — `lib/boards.ts`, 주소 `/topic/[t]/challenge` 유지) / 부위별 게시판(`category` + `area_order` 대표 1~3, 신체 지도 패널·`/topic/[t]/[category]`). 0009 에서 `pinned_order`→`curated_order`. 규칙·테스트 `lib/guide-order.ts`, 문서 `docs/운영.md` 5-6.
- **노견생활 신체 지도·정렬 (2026-09)**: `guides.category`(토픽별 정의 `data/src/guides/categories.ts`, 미지정 = 부위별 게시판 제외). `/topic/senior-life` 상단 SVG 신체 지도(`components/senior-body-map.tsx`) — 부위 호버·클릭 → Q&A + 관련 글.
- **AdSense (2026-09)**: `ca-pub-…` 기본값 + `NEXT_PUBLIC_ADSENSE_CLIENT`(off 가능), `web/public/ads.txt`. 운영 전용, 관리자·포털·클레임·`/rehab` 경로 제외, 장묘·약국·B2B·의료 인접 편은 `buildMeta({ ads:false })` 메타로 제외 (`docs/운영.md` 4-4).
- **직접 발굴·의료 인접 (2026-09)**: 큐레이션 CSV 로더 2종(`etl:direct`/`etl:rehab`, `#`=미확인·외부키 upsert) + `spots.external_ref`·`rehab_sites`(0004). 숨고 정리본 48행 적재, 재활·한방·특수치료 123행 → `/rehab`·`/rehab/[치료법]`(치료법이 주어, 가나다순, 확인수준·개인명 미노출, MedicalNotice) + `/admin/rehab`. 주소 정규화가 동·호수·층·건물명까지 제거.
- **배포 도구**: `sst.config.ts`(SST v4/OpenNext — prod 별칭 4개·dev 스테이지·미디어 버킷·Lambda 역할 스토리지) + `scripts/aws-profile.ps1`(프로필 확인·전환), `aws-db.ps1`(RDS+env+마이그레이션·시드), `deploy.ps1`(프리플라이트→검사→배포), `aws-destroy.ps1`. 전부 무프롬프트. 런북 `docs/배포.md`.
- **콘텐츠**: 노견 13편(발행 4·감수 대기 3·초안 6) + 놀이 5편(전부 발행) 시드. 의료 인접 편은 감수 전 발행 불가가 3중(시드·관리자·DB)으로 막혀 있다.
- **테스트**: data 15개 + web 28개 통과. `pnpm build` 통과. 관리자 등록 흐름은 브라우저로 실동작 검증.

### 다음 작업

1. data.go.kr 활용신청 승인 후 실제 인허가 CSV/API 적재 (헤더 불일치 시 mappings.ts 후보 추가 → 리포트 확인 루프)
2. 동물등록 현황 실데이터 적재 → 지역 페이지 노령견 비율 활성화
3. 의료 인접 편 수의사 감수 → review_pending 해제. 초안 스포크(심장·인지·눈귀·치아·체중·마지막 시간) 본문 완성
4. 직접 발굴 보강: 숨고 정리본의 `#`(이름·유형 미확인 8행) 채워 재적재, 재활 시행처 확인 전화 후 확인수준·기준일 갱신 (`docs/운영.md` 4-3)
5. 메이커 1차 발굴 10+10, 큐레이션 첫 테마 (샘플 픽스처 교체)
6. GSC·네이버 서치어드바이저 등록, 쿠팡 파트너스 실링크 연동 (배포 후)
7. 첫 배포 실행: `.\scripts\aws-db.ps1 -DevFixtures` → `.\scripts\deploy.ps1 -Stage dev` → 검증 → `-Stage prod` (`docs/배포.md`). 사장님 포털(service./product.)은 랜딩+클레임 연결 상태 — 업주 셀프 편집은 Cognito 이후

확정: 브랜드 펫라이프위드미(pet life with me), 도메인·서브도메인 구조(`docs/배포준비.md`),
배포 방식 SST v4(OpenNext)·RDS db.t4g.micro 퍼블릭(강화 경로 문서화, `docs/배포.md` 6장).
미확정: 카카오·네이버 OIDC 연동 가능 여부 (Cognito 단계에서 확인)