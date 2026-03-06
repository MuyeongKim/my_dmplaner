# 달무 플래너

근무 패턴/일정을 월간 캘린더로 관리하는 Next.js PWA입니다.

## 실행

```bash
corepack pnpm install
corepack pnpm dev
```

## 저장소 동작 방식

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되어 있으면 Supabase를 사용합니다.
- 환경변수가 없으면 기존처럼 IndexedDB(로컬 브라우저 저장소)를 사용합니다.

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql) 실행
3. Authentication에서 사용할 계정 1개를 먼저 생성하고, `Signups`를 비활성화
4. `.env.local` 생성 후 아래 값 입력

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

5. 앱 재실행 후 로그인 화면에서 생성한 계정으로 로그인

### 보안 메모 (단일 사용자)

- 기본 스키마 정책은 `authenticated` 사용자만 접근 가능하도록 되어 있습니다.
- 단일 사용자 운영을 전제로 하므로, 반드시 회원가입을 막고 본인 계정만 사용하세요.

## 참고

- 월간 캘린더는 `일, 월, 화, 수, 목, 금, 토` 순서입니다.
- 토요일은 파란색, 일요일/임시공휴일은 빨간색으로 표시됩니다.
- 임시공휴일은 설정 탭에서 `YYYY-MM-DD` 형식으로 직접 추가할 수 있습니다.
