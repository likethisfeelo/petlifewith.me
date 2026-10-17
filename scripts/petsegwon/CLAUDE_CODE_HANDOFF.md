# Claude Code 작업 지시서 — 펫세권 "업장 1곳당 등록 반려견 수" 도구

이 폴더를 petlifewith.me 저장소에 넣고, 아래 순서대로 진행한다. 기존 서비스 구조(프레임워크, 배포 방식, 디렉토리 규칙)를 먼저 파악하고 거기에 맞춰 통합한다. 이 폴더의 스크립트는 기존 서비스와 독립적으로 동작하는 데이터 파이프라인이다.

## 목표

사용자가 시도 → 시군구 → 업종을 고르면, 그 지역의 "업장 1곳당 등록 반려견 수"를 시도 평균·전국 평균과 비교해 보여주는 도구 페이지를 만든다.

## 폴더 구성

| 파일 | 역할 |
|---|---|
| `baseline_2025.json` | 농식품부 2025 실태조사 시도별 반려견·8개 업종 업장 수 (보정 기준 총량) |
| `config.example.json` | API 엔드포인트·필드명·판정 기준 설정. `config.json`으로 복사해 사용 |
| `common.py` | 설정 로딩, data.go.kr 페이지네이션, 시도·시군구 이름 정규화 |
| `collect_registrations.py` | 시군구별 반려견 등록 수 수집 → `raw/registration_sigungu.csv` |
| `collect_businesses.py` | 업종별 영업 중 업장 수집 → `raw/business_counts_<업종>.csv` |
| `build_stats.py` | 보정·평균·순위·판정 계산 → `out/stats.json`, `out/ranking_<업종>.csv`, `out/validation.csv` |
| `run.ps1` | 전체 실행 (Windows PowerShell, ASCII) |
| `NOTICE.md` | 도구 페이지에 넣을 사용자 고지 문구 |

외부 패키지 없이 Python 표준 라이브러리만 사용한다.

## 1단계: API 설정 채우기

사용자가 공공데이터포털에서 아래 API 활용신청을 마친 상태여야 한다. 서비스 키는 환경변수 `DATA_GO_KR_KEY`로만 받는다. 코드·설정 파일·커밋에 키를 넣지 않는다.

- 반려견 등록: 농림축산검역본부_동물등록 현황 — https://www.data.go.kr/data/15103156/openapi.do
- 동물미용업: 행정안전부_동물_동물미용업 조회서비스 — https://www.data.go.kr/data/15154944/openapi.do
- 위탁관리업·전시업·판매업·운송업: 같은 "행정안전부_동물_○○업 조회서비스" 계열 (공공데이터포털에서 검색)

각 API의 Swagger(활용명세)를 확인해서 `config.json`의 `TODO` 값을 채운다.

1. `base_url`, 요청 파라미터 이름(시도·축종 등), 응답의 항목 경로(`items_path`, `total_count_path`), 필드명
2. 키 1건으로 소량 호출(`numOfRows=5`)을 먼저 해서 실제 응답 구조를 출력해 보고, 그 구조에 맞게 경로를 확정한다
3. 응답이 XML로만 오면 `common.fetch_json`을 XML 파싱으로 확장한다
4. 등록 API가 시도 파라미터에 코드값을 요구하면 `sido_query_values`를 채운다

## 2단계: 수집 및 검증

```powershell
$env:DATA_GO_KR_KEY = "<디코딩 키>"
Copy-Item config.example.json config.json   # 1단계에서 채운 값 반영
.\run.ps1
```

실행 후 반드시 확인할 것:

1. **`raw/business_status_values.csv`** — 응답에 나온 영업상태 값 전체 목록. `active_status_values`에 영업 중인 값만 들어갔는지 확인하고, 휴업 포함 여부를 정한다.
2. **`out/validation.csv`** — 시도별 API 영업 중 업장 수 vs 2025 실태조사 업장 수. `flag=CHECK`(차이 15% 초과)가 많으면 상태 필터나 주소 파싱을 다시 본다. API는 2026년 현재 시점, 실태조사는 2025년 말 기준이므로 몇 % 차이는 정상이다.
3. **collect 단계의 `skipped`/`address unparsed` 개수** — 시도·시군구 이름이 매칭되지 않은 행. 많으면 `common.SIDO_ALIASES`와 `region_from_address`를 보완한다.
4. **시군구 이름 일치** — build 단계의 "shops but no registration row" 경고. 등록 API와 인허가 API의 시군구 표기가 다르면 정규화 규칙을 추가한다.
5. **행정구역 변경** — 공공데이터포털에 "전남광주통합특별시" 표기의 데이터셋이 보인다. 응답에 새 시도명이 나오면 baseline(2025년 기준, 광주·전남 분리)과 어떻게 대응시킬지 사용자에게 확인한다. 대구 군위군 편입, 일반구가 있는 시(`merge_general_gu`)도 같이 확인한다.

## 3단계: 계산 규칙 (변경 시 사용자 확인 필요)

- 지표: `업장 1곳당 등록 반려견 수 = 등록 반려견 수 / 영업 중 업장 수`. 클수록 공급 부족 후보.
- 보정: 시군구 값 = (시군구 원값 / 시도 원값 합계) × 2025 실태조사 시도 총량. 반려견·업장 모두 적용. 이렇게 해야 도구의 시도·전국 평균이 릴스 원고 수치(전국 미용업 332, 서울 357)와 일치한다.
- 평균: 시도·전국 평균은 시군구 비율의 단순 평균이 아니라 `시도 총 반려견 / 시도 총 업장`.
- 판정: 시도 평균 대비 120% 이상 "공급 부족 후보", 80% 미만 "밀집 지역", 그 사이 "평균권". 원 업장 수 3곳 미만은 "표본 적음".
- 순위: 시도 안에서 1곳당 마리 수 내림차순(1위 = 가장 부족).

## 4단계: 도구 페이지 통합

`out/stats.json` 구조:

```
meta      : 생성 시각, 지표 정의, 기준 출처·기준일, 보정 설정, 판정 기준
national  : {업종: {dogs, shops, per_shop}}
sido      : {시도: {dogs, industries: {업종: {shops, per_shop, national_rank, rank_total}}}}
sigungu   : [{sido, sigungu, dogs, industries: {업종: {shops, shops_raw, per_shop,
              pct_of_sido_avg, pct_of_national_avg, label, rank_in_sido, count_in_sido}}}]
```

페이지 요구사항:

1. 입력: 시도 → 시군구 선택 박스 2단, 업종 선택(미용업 기본값)
2. 결과 카드: 내 지역 1곳당 마리 수, 시도 평균, 전국 평균, 시도 평균 대비 %, 시도 안 순위("25개 구 중 4위"), 판정 라벨
3. 업종 비교 표: 같은 시군구의 업종별 per_shop·평균 대비 %·라벨을 한 줄씩
4. 하단: `NOTICE.md`의 짧은 버전 고정, 긴 버전은 "계산 방법 자세히 보기"로 펼침. 기준일은 `meta.baseline_reference_date`에서 읽어 표시
5. 계산은 전부 클라이언트에서 stats.json 조회로 처리 (서버 연산 없음)
6. 결과 공유용 이미지 카드, 뉴스레터 구독 CTA는 기존 서비스 컴포넌트가 있으면 재사용

stats.json을 어디에 둘지(정적 경로, S3+CloudFront 등)는 기존 서비스의 배포 방식을 따른다.

## 5단계: 자동 갱신

- 월 1회 배치(GitHub Actions 스케줄 등)로 `run.ps1`과 같은 순서를 실행하고 stats.json을 갱신한다. 서비스 키는 저장소 시크릿으로 넣는다.
- `out/validation.csv`의 CHECK 개수가 직전 실행보다 크게 늘면 배포를 멈추고 알린다.
- 2026년 실태조사가 발표되면 `baseline_2025.json`을 새 연도 파일로 교체하고 NOTICE의 기준 연도 문구를 바꾼다.
