# 한 해 가계부

캘린더와 도넛 차트로 한 해의 수입·지출을 한눈에 보는 웹 가계부예요.

## 주요 기능

- 1~12월 도넛 차트와 월별 캘린더 (수익 난 날은 초록, 많이 쓴 날은 빨강)
- 통장별로 여러 가계부, 가계부 사이 이체 (수입·지출 계산에서 자동 제외)
- 신용카드 결제수단·할부, 사용일/결제일 기준 전환
- 누적 월평균 대비 ↑↓ 표시, 저축률, 카테고리별 예산
- 고정 지출·수입 자동 기록, 검색, 되돌리기
- 카드사·은행 엑셀/CSV 가져오기, 엑셀 내보내기, 백업·복원
- 말로 입력 ("어제 스타벅스 5600원 카드로"), Claude 월간 소비 리포트
- 화이트·블랙 모드, 여러 가계부 합산 보기

## 구조

```
web/                      정적 웹사이트 (그대로 호스팅하면 돼요)
  index.html              앱 전체
  config.js               Supabase 주소·공개 키 (직접 채우기)
  privacy.html            개인정보처리방침 초안 (직접 채우기)
supabase/
  schema.sql              데이터베이스 테이블과 보안 규칙
  functions/claude/       AI 기능 서버 함수 (API 키 보관, 하루 사용량 제한)
  functions/delete-account/  계정 삭제 서버 함수
```

- 로그인·저장: Supabase Auth + Postgres. 사용자는 행 수준 보안(RLS)으로 **본인 데이터만** 읽고 쓸 수 있어요.
- AI: 브라우저 → Supabase Edge Function → Anthropic API. API 키는 서버에만 있고, 정해진 두 작업(문장 정리, 월간 리포트)만 할 수 있어요.

## 설치와 배포

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 에서 가입하고 새 프로젝트를 만들어요. 한국 사용자가 대부분이면 리전은 서울(ap-northeast-2)을 추천해요.
2. **SQL Editor** 에 `supabase/schema.sql` 내용을 붙여넣고 실행해요.
3. **Authentication → Providers** 에서 Email 이 켜져 있는지 확인해요. 가입 확인 메일(Confirm email)은 켜두는 걸 추천해요.
4. **Authentication → URL Configuration** 에서 Site URL 과 Redirect URLs 에 배포할 웹 주소(예: `https://내도메인.com`)를 넣어요. 확인 메일과 비밀번호 재설정 링크가 이 주소로 돌아와요.

### 2. 서버 함수 배포 (AI 기능, 계정 삭제)
[Supabase CLI](https://supabase.com/docs/guides/cli) 를 설치한 뒤 프로젝트 폴더에서:

```bash
supabase login
supabase link --project-ref <프로젝트 REF>

# 비밀 값은 서버에만 저장돼요. 코드나 깃허브에 절대 올리지 마세요.
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGINS=https://내도메인.com
supabase secrets set AI_DAILY_LIMIT=30          # 사용자 1명당 하루 AI 호출 횟수

supabase functions deploy claude
supabase functions deploy delete-account
```

Anthropic API 키는 https://console.anthropic.com 에서 만들 수 있어요. 콘솔에서 **월 사용 한도(spend limit)** 를 꼭 걸어두세요.
AI 기능 없이 시작하려면 이 단계를 건너뛰고 `config.js` 에서 `AI_ENABLED: false` 로 두면 돼요.

### 3. 웹 설정
`web/config.js` 에 Supabase 대시보드 **Project Settings → API** 의 Project URL 과 anon public 키를 넣어요.
anon 키는 공개돼도 괜찮은 키예요. **service_role 키는 절대 넣지 마세요.**

### 4. 웹사이트 올리기
`web` 폴더를 정적 호스팅에 올리면 끝이에요. 예:
- **Vercel / Netlify**: 저장소를 연결하고 배포 폴더(Output/Publish directory)를 `web` 으로 지정
- **GitHub Pages**: Settings → Pages 에서 배포 소스를 지정 (web 폴더 내용을 루트로 두거나 Actions 사용)

배포한 주소를 1-4 단계의 URL 설정과 `ALLOWED_ORIGINS` 에 똑같이 넣어주세요.

## 공개 출시 전 체크리스트

- [ ] `privacy.html` 의 [대괄호] 부분 채우기 (개인정보보호법상 개인정보처리방침 공개 필요)
- [ ] 이메일 발송: Supabase 기본 메일은 발송량 제한이 작아요. 사용자가 늘면 Authentication → SMTP 설정에서 전용 메일 서비스를 연결하세요.
- [ ] Anthropic 콘솔 월 사용 한도 설정, `AI_DAILY_LIMIT` 조정
- [ ] Supabase 대시보드에서 데이터베이스 백업 설정 확인
- [ ] 폰에서 가입 → 기록 → 로그아웃 → 다른 기기 로그인까지 한 번 따라 해보기
- [ ] 두 계정으로 서로의 데이터가 보이지 않는지 확인하기

## 사용한 오픈소스

- [supabase-js](https://github.com/supabase/supabase-js) (MIT)
- [SheetJS Community Edition](https://sheetjs.com) (Apache 2.0) — 엑셀 가져오기·내보내기
- [IBM Plex Sans KR](https://github.com/IBM/plex) (SIL Open Font License)

## 라이선스

원하는 라이선스를 정해 `LICENSE` 파일로 추가하세요. (예: MIT)
