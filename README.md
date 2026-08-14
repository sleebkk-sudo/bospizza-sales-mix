# 보스피자 Sales Mix 대시보드

엑셀/CSV로 메뉴별 매출 데이터를 업로드해서 메뉴/카테고리별 매출 비중과
추이, 원가 대비 마진을 확인하는 대시보드입니다. Vercel에 배포해서
외부 링크로 접속합니다.

## 1. Supabase 프로젝트 준비

이미 `bospizza-sales-mix` Supabase 프로젝트가 생성되어 있습니다 (무료 플랜).

1. Supabase 프로젝트의 SQL Editor에서 [`supabase/schema.sql`](./supabase/schema.sql) 내용을 그대로 실행합니다.
2. 프로젝트 설정 > API 메뉴에서 다음 값을 확인합니다.
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (절대 외부에 노출되면 안 되는 값입니다)

## 2. 환경 변수 설정

`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SECRET=       # 임의의 긴 랜덤 문자열 (세션 쿠키 서명용)
DASHBOARD_PASSWORD= # 대시보드 접속 비밀번호
```

## 3. 로컬 실행

```bash
npm install
npm run dev
```

## 4. 배포 (Vercel)

1. 이 저장소를 [Vercel](https://vercel.com)에서 Import 합니다 (GitHub 연동, 무료 Hobby 플랜으로 충분).
2. Vercel 프로젝트 Settings > Environment Variables에 위 4개 환경 변수를 동일하게 등록합니다.
3. 배포 후 발급되는 `*.vercel.app` 링크로 모바일/PC 어디서든 접속할 수 있습니다.
4. 대표 텔레그램/카톡 등으로 공유할 때는 이 링크를 그대로 쓰면 됩니다.

## 5. 데이터 업로드

업로드 탭에서 기간(시작일~종료일)을 지정하고 엑셀/CSV 파일을 올립니다.
파일 첫 번째 시트에 아래 4개 컬럼이 헤더로 있어야 합니다 (순서 무관):

| 카테고리 | 메뉴명 | 수량 | 매출액 |
|---|---|---|---|

같은 기간(시작일~종료일)으로 재업로드하면 그 스냅샷을 덮어씁니다.
`sample-template.csv`를 참고하세요.

## 6. 메뉴 원가 관리

원가 관리 탭에서 메뉴별 원가를 입력하면, 대시보드에 매출 대비 마진표가
자동으로 표시됩니다. 메뉴명은 업로드 파일의 메뉴명과 정확히 일치해야
매칭됩니다.

## 7. 비용

- Supabase 무료 플랜: DB 500MB, 월 대역폭 5GB. **7일간 API 호출이 없으면
  프로젝트가 자동 일시정지**됩니다 (재개는 무료, Supabase 대시보드에서
  버튼 클릭 한 번이면 됩니다). 상시 운영이 필요해지면 Pro 플랜($25/월)
  검토.
- Vercel 무료 Hobby 플랜: 개인 프로젝트 기준 충분. 트래픽이 크게 늘면
  Pro 플랜($20/월) 검토.
- 현재 규모(메뉴 수십 개, 스냅샷 단위 업로드)에서는 두 서비스 모두 $0로
  운영 가능합니다.

## 8. 알려진 한계

- 아직 보스피자 매장이 오픈 전이라, 이 파일 형식은 POS/배달앱의 실제
  내보내기 포맷이 아니라 자체 정의한 4컬럼 템플릿입니다. 실제 매장이
  열리고 POS/배달앱에서 받는 리포트 샘플을 확보하면, 그 포맷에 맞춘
  전용 파서로 교체하는 걸 권장합니다 (`src/lib/parseSalesReport.ts`).
- 날짜별로 메뉴 단위를 쪼개보는 기능은 없습니다 (스냅샷 = 지정한 기간
  전체 합계).
