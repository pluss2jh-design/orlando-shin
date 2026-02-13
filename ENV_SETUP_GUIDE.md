# 환경 변수 설정 가이드

이 파일은 주식 선생님 프로젝트에서 필요한 모든 환경 변수의 설정 방법을 설명합니다.

## 필수 환경 변수 목록

### 1. 데이터베이스 설정

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/orlando_shin"
```

**설정 방법:**
- PostgreSQL 데이터베이스 생성
- 위 형식에 맞게 URL 작성 (사용자명, 비밀번호, 호스트, 포트, DB명 수정)

---

### 2. 이메일 서비스 설정 (SMTP)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@stockteacher.com
```

**Gmail 설정 방법:**

1. **Google 계정에서 앱 비밀번호 생성:**
   - https://myaccount.google.com/apppasswords 접속
   - 2단계 인증이 활성화되어 있어야 함
   - "앱 비밀번호" 선택
   - 앱 이름: "주식 선생님" 입력
   - 생성된 16자리 비밀번호를 `SMTP_PASS`에 복사

2. **환경 변수 설정:**
   - `SMTP_USER`: 본인 Gmail 주소
   - `SMTP_PASS`: 생성된 앱 비밀번호 (공백 없이)
   - `FROM_EMAIL`: 발송자 이메일 (noreply@stockteacher.com 권장)

**네이버 메일 설정 방법 (대안):**

```bash
SMTP_HOST=smtp.naver.com
SMTP_PORT=587
SMTP_USER=your-id@naver.com
SMTP_PASS=your-password
FROM_EMAIL=your-id@naver.com
```

---

### 3. NextAuth.js 인증 설정

```bash
AUTH_SECRET=your-secret-key-here
```

**설정 방법:**
- 무작위 문자열 생성 (최소 32자 권장)
- 또는 터미널에서 아래 명령어 실행:
  ```bash
  openssl rand -base64 32
  ```

---

### 4. Google OAuth 설정

```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**설정 방법:**

1. **Google Cloud Console 접속:**
   - https://console.cloud.google.com/

2. **프로젝트 생성 또는 선택**

3. **OAuth 동의 화면 설정:**
   - "API 및 서비스" > "OAuth 동의 화면"
   - User Type: "외부" 선택
   - 앱 이름: "주식 선생님"
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일

4. **OAuth 클라이언트 ID 생성:**
   - "사용자 인증 정보" > "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID"
   - 애플리케이션 유형: "웹 애플리케이션"
   - 이름: "주식 선생님 웹"
   - 승인된 리디렉션 URI 추가:
     - 개발: `http://localhost:3000/api/auth/callback/google`
     - 프로덕션: `https://your-domain.com/api/auth/callback/google`

5. **클이언트 ID와 시크릿 복사하여 설정**

---

### 5. 카카오 OAuth 설정

```bash
KAKAO_CLIENT_ID=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret
```

**설정 방법:**

1. **카카오 개발자 센터 접속:**
   - https://developers.kakao.com/

2. **애플리케이션 추가:**
   - "내 애플리케이션" > "애플리케이션 추가하기"
   - 앱 이름: "주식 선생님"
   - 회사명: 본인 이름 또는 회사명

3. **REST API 키 복사:**
   - 앱 설정 > 앱 키 > REST API 키를 `KAKAO_CLIENT_ID`에 설정

4. **카카오 로그인 활성화:**
   - "제품 설정" > "카카오 로그인" > "활성화"

5. **Redirect URI 등록:**
   - "제품 설정" > "카카오 로그인" > "Redirect URI"
   - 추가: `http://localhost:3000/api/auth/callback/kakao`
   - 추가: `https://your-domain.com/api/auth/callback/kakao` (프로덕션)

6. **Client Secret 설정 (선택사항):**
   - "제품 설정" > "카카오 로그인" > "보안" > "Client Secret"
   - Client Secret를 `KAKAO_CLIENT_SECRET`에 설정

---

### 6. 네이버 OAuth 설정

```bash
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

**설정 방법:**

1. **네이버 개발자 센터 접속:**
   - https://developers.naver.com/

2. **애플리케이션 등록:**
   - "내 애플리케이션" > "애플리케이션 등록"
   - 앱 이름: "주식 선생님"
   - 사용 API: "네이버 로그인"
   - 제공 정보: 이메일, 별명, 프로필 사진 선택

3. **Callback URL 설정:**
   - `http://localhost:3000/api/auth/callback/naver`
   - `https://your-domain.com/api/auth/callback/naver` (프로덕션)

4. **Client ID와 Client Secret 복사:**
   - 앱 설정에서 "Client ID"를 `NAVER_CLIENT_ID`에 설정
   - "Client Secret"를 `NAVER_CLIENT_SECRET`에 설정

---

### 7. OpenAI API 설정 (AI 학습용)

```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

**설정 방법:**

1. **OpenAI API Keys 페이지 접속:**
   - https://platform.openai.com/api-keys

2. **새 API 키 생성:**
   - "Create new secret key"
   - 이름: "주식 선생님"
   - 생성된 키를 복사 (다시 볼 수 없으니 반드시 저장)

---

### 8. Google Drive API 설정 (학습 자료 동기화)

```bash
GOOGLE_API_KEY=your-google-api-key
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**설정 방법 (선택사항 - 공유 폴터만 사용 시):**

1. **Google Cloud Console:**
   - https://console.cloud.google.com/

2. **API 라이브러리에서 Google Drive API 활성화**

3. **API 키 생성:**
   - "사용자 인증 정보" > "사용자 인증 정보 만들기" > "API 키"
   - 생성된 키를 `GOOGLE_API_KEY`에 설정

**서비스 계정 설정 (비공개 폴터 접근 시):**

1. **서비스 계정 생성:**
   - "IAM 및 관리자" > "서비스 계정"
   - "서비스 계정 만들기"
   - 이름: "stock-teacher-service"

2. **키 생성:**
   - 서비스 계정 선택 > "키" > "추가" > "새 키 만들기"
   - JSON 형식 선택
   - 다운로드된 JSON 파일 내용 전체를 `GOOGLE_SERVICE_ACCOUNT_KEY`에 설정

---

### 9. 파일 업로드 설정

```bash
UPLOAD_DIR=./uploads
```

**설정 방법:**
- 파일 업로드 경로 설정 (선택사항, 기본값 사용 권장)

---

## 환경 변수 적용 방법

### 1. `.env` 파일 생성

프로젝트 루트에 `.env` 파일을 생성하고 위 내용을 복사하여 설정:

```bash
cd /path/to/orlando-shin
touch .env
```

### 2. `.env` 파일 예시

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/orlando_shin"

# Auth
AUTH_SECRET=your-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Kakao OAuth
KAKAO_CLIENT_ID=your-kakao-rest-api-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret

# Naver OAuth
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@stockteacher.com

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Google Drive API
GOOGLE_API_KEY=your-google-api-key
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# File uploads
UPLOAD_DIR=./uploads
```

### 3. 환경 변수 검증

```bash
# Next.js 개발 서버 재시작
npm run dev
```

### 4. Prisma 클라이언트 재생성 (DB 변경 시)

```bash
npx prisma generate
```

---

## 문제 해결

### 이메일 발송 실패

1. **Gmail 앱 비밀번호 확인:**
   - 2단계 인증이 활성화되어 있는지 확인
   - 앱 비밀번호가 올바르게 생성되었는지 확인

2. **보안 수준이 낮은 앱 액세스 (Gmail):**
   - 더 이상 지원되지 않음
   - 반드시 "앱 비밀번호" 사용 필요

3. **SMTP 설정 확인:**
   - 포트 587 (TLS) 또는 465 (SSL)
   - 호스트: smtp.gmail.com

### OAuth 로그인 실패

1. **Redirect URI 확인:**
   - 개발 환경: `http://localhost:3000/api/auth/callback/[provider]`
   - 프로덕션: `https://your-domain.com/api/auth/callback/[provider]`

2. **Client ID/Secret 확인:**
   - 공백이나 오타 확인
   - 환경 변수가 올바르게 로드되었는지 확인

3. **OAuth 동의 화면 설정:**
   - 테스트 모드에서는 승인된 테스트 사용자만 로그인 가능
   - 프로덕션 사용 시 "앱 검토" 필요

---

## 보안 주의사항

⚠️ **중요:**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- `.gitignore`에 `.env`가 포함되어 있는지 확인
- 실제 비밀번호나 API 키는 공유하지 마세요
- 프로덕션 환경에서는 별도의 환경 변수 관리 도구(Vercel, AWS Secrets Manager 등) 사용 권장
