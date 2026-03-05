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
3. `.env.local` 생성 후 아래 값 입력

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. 앱 재실행

## 참고

- 월간 캘린더는 `일, 월, 화, 수, 목, 금, 토` 순서입니다.
- 토요일은 파란색, 일요일/임시공휴일은 빨간색으로 표시됩니다.
- 임시공휴일은 설정 탭에서 `YYYY-MM-DD` 형식으로 직접 추가할 수 있습니다.
