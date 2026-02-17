# 로그인 리다이렉트 테스트 가이드

## 수정 사항

### 문제
- OAuth 로그인(Google, Kakao) 후 session API 호출 이후 화면 전환이 되지 않는 문제

### 해결 방법
1. **`redirect: false` 제거**
   - OAuth는 외부 인증 페이지로 리다이렉트해야 하므로 `redirect: false` 옵션 제거
   - NextAuth가 자연스럽게 OAuth 플로우를 처리하도록 변경

2. **`callbackUrl` 설정**
   - 로그인 후 `/login` 페이지로 돌아오도록 설정
   - 로그인 페이지에서 세션 확인 후 역할에 따라 리다이렉트

3. **`window.location.href` 사용**
   - `router.push` 대신 `window.location.href` 사용
   - 더 확실한 페이지 전환 보장

## 테스트 방법

### 1. 일반 사용자 로그인 테스트
1. 브라우저에서 `http://localhost:3000/login` 접속
2. "Google로 계속하기" 또는 "카카오 계정으로 계속하기" 클릭
3. OAuth 인증 페이지에서 로그인
4. **예상 결과**: 로그인 후 `/stock-analysis` 페이지로 자동 이동

### 2. 관리자 로그인 테스트
1. 브라우저에서 `http://localhost:3000/login` 접속
2. 관리자 계정(`pluss2.jh@gmail.com` 또는 `pluss2@kakao.com`)으로 로그인
3. **예상 결과**: 로그인 후 `/admin/dashboard` 페이지로 자동 이동

### 3. 디버그 로그 확인
브라우저 개발자 도구(F12) > Console 탭에서 다음 로그 확인:
```
Attempting to sign in with google...
Session authenticated: { userEmail: "...", isAdmin: true/false, role: "ADMIN"/undefined }
Redirecting to admin dashboard... 또는 Redirecting to: /stock-analysis
```

## 주요 변경 파일
- `src/app/(auth)/login/page.tsx`: OAuth 로그인 플로우 수정
- `src/lib/auth.ts`: signIn 콜백 추가

## 커밋 정보
- Commit: `808908f` - "fix: OAuth 로그인 리다이렉트 문제 해결 - redirect:false 제거 및 window.location.href 사용"
