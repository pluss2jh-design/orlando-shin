# Project Context History

## Current Session Tracking
- **질의 횟수**: 1
- 카카오 로그인 시 'email' 필드 누락으로 인한 DB 생성 오류 해결 (profile fallback 추가)

## 2026-02-17

### 관리자 요금제 관리 및 사용자 멤버십 시스템 구축

#### 변경사항
1. **요금제 관리 기능 (Admin)**
   - `src/app/admin/membership-plan/page.tsx`: Free, Standard, Premium 요금제 관리 화면 추가
   - 요금제별 가격 설정 및 기능 권한(Feature Flag) 토글 기능 구현
   - `uploads/config/plans.json`: 요금제 설정 데이터 영구 저장
   - `src/app/api/admin/plans/route.ts`: 요금제 설정 CRUD API

2. **사용자 유도 및 회원가입 프로세스**
   - `src/app/pricing/page.tsx`: 시각적인 요금제 선택 카드 화면 추가
   - `src/app/(auth)/signup/page.tsx`: 선택된 요금제가 반영된 회원가입 폼 구현
   - `src/app/api/auth/signup/route.ts`: 사용자 플랜 정보와 함께 계정 생성 API

3. **권한 기반 기능 제약 (SaaS Logic)**
   - `src/lib/auth.ts`: 세션에 사용자 `plan` 및 `features` 플랜 정보 주입
   - `src/components/stock-analysis/analysis-output.tsx`: 플랜에 따라 '상세 근거 자료' 접근 제한 및 업그레이드 유도 UI 적용
   - `src/middleware.ts`: 관리자 및 회원 전용 페이지 접근 제어 로직 강화

4. **UI/UX 개선**
   - 기업 분석 화면에서 '데이터 관리' 섹션 삭제 (요청 사항 반영)
   - 헤더에 사용자 현재 요금제 등급 표시 및 '멤버십 업그레이드' 버튼 추가
   - 카카오 로그인 시 이메일 표시 문제 해결 (세션 데이터 기반 실시간 반영)

#### 변경사항
1. **카카오 QR 로그인 리다이렉트 문제 해결**
   - `src/app/(auth)/login/page.tsx`: setTimeout 추가하여 세션 로드 후 리다이렉트 보장
   - OAuth 콜백 후 100ms 지연을 두어 세션이 완전히 로드된 후 리다이렉트 실행

2. **관리자 전용 대시보드 구축**
   - **레이아웃**: 사이드바 메뉴가 포함된 다크 모드 레이아웃
   - **통합 대시보드** (`/admin/dashboard`):
     - Google Drive 연결 상태 카드
     - 전체 파일 개수 카드
     - 학습 완료 파일 개수 카드
     - AI 모델 가동 현황 카드
   - **데이터 라이브러리** (`/admin/data-library`):
     - Google Drive 파일 목록 테이블
     - 각 파일별 학습 상태 표시 (완료/대기/처리중)
     - 개별 파일 학습 버튼
     - Google Drive 동기화 버튼
   - **투자 로직 관리** (`/admin/investment-logic`):
     - learned-knowledge.json 내용 확인 및 편집
     - JSON 형식 검증
     - 전체 다시 학습하기 기능
     - 실시간 저장 기능
   - **시스템 설정** (`/admin/settings`):
     - API 키 관리 (Google API, OpenAI, Yahoo Finance)
     - 보안을 위한 마스킹 처리
     - .env 파일 자동 업데이트

3. **관리자 인증 시스템**
   - `src/app/admin/layout.tsx`: 관리자 권한 확인 및 리다이렉트
   - 관리자 이메일 화이트리스트 기반 접근 제어

4. **Google Drive 동기화 경로 수정**
   - `src/lib/google-drive/index.ts`에서 동기화 정보(`sync-info.json`)를 `uploads/gdrive/` 하위에 저장하도록 변경됨에 따라, 이를 읽어오는 API 경로(`src/app/api/admin/files/route.ts`, `src/app/api/admin/dashboard-stats/route.ts`)를 수정하여 파일 목록이 표시되지 않던 문제 해결.

5. **관리자-분석 페이지 간 이동 편의성 개선**
   - **관리자 사이드바**: '기업 조회(분석)' 메뉴 추가 (`/stock-analysis`로 연결)
   - **분석 페이지 헤더**: 관리자 계정으로 로그인 시 '관리자 대시보드' 버튼 표시 (`/admin/dashboard`로 연결)

#### 생성된 파일
- `src/app/admin/layout.tsx`: 관리자 레이아웃
- `src/components/admin/sidebar.tsx`: 사이드바 컴포넌트
- `src/app/admin/dashboard/page.tsx`: 통합 대시보드
- `src/app/admin/data-library/page.tsx`: 데이터 라이브러리
- `src/app/admin/investment-logic/page.tsx`: 투자 로직 관리
- `src/app/admin/settings/page.tsx`: 시스템 설정
- `src/app/api/admin/dashboard-stats/route.ts`: 대시보드 통계 API
- `src/app/api/admin/files/route.ts`: 파일 목록 API
- `src/app/api/admin/investment-logic/route.ts`: 투자 로직 API
- `src/app/api/admin/settings/route.ts`: 설정 API

#### 수정된 파일
- `src/app/(auth)/login/page.tsx`: 리다이렉트 타이밍 개선 및 디버깅 로그 추가
- `src/lib/auth.ts`: 카카오 프로필 이메일 추출 로직 개선 및 JWT 로그 강화
- `src/app/api/admin/files/route.ts`: GDrive 동기화 파일 경로 수정
- `src/app/api/admin/dashboard-stats/route.ts`: GDrive 동기화 데이터 경로 수정
- `src/components/admin/sidebar.tsx`: '기업 조회(분석)' 네비게이션 추가
- `src/app/stock-analysis/page.tsx`: 관리자용 '관리자 대시보드' 버튼 추가 및 헤더 레이아웃 수정





### 메인 페이지 개선 및 사용자 정보 표시, 로그인 디버깅 강화

#### 변경사항
1. **메인 랜딩 페이지 대폭 개선 (`src/app/page.tsx`)**
   - 고정 헤더 추가: 로고, 사용자 정보/로그인 버튼
   - Hero 섹션: 타이틀, 설명, 주요 CTA 버튼
   - 기능 카드 섹션: AI 주식 분석, 1:1 문의, AI 학습 시스템 소개
   - 로그인 상태 배너: 로그인 시 사용자 환영 메시지, 미로그인 시 로그인 유도
   - 푸터 추가

2. **사용자 정보 표시 개선**
   - Avatar 컴포넌트 추가 (`src/components/ui/avatar.tsx`)
   - 헤더에 사용자 프로필 이미지, 이름, 이메일 표시
   - 로그인 시 화면 우측 상단에 사용자 정보 표시 (Google/Kakao 스타일)
   - 주식 분석 페이지에도 동일한 사용자 정보 표시 적용

3. **로그인 디버깅 강화**
   - `auth.ts`: signIn, session 콜백에 console.log 추가
   - `login/page.tsx`: 상세 에러 메시지 표시, 환경 변수 체크 로직 추가
   - OAuth 설정 미완료 시 명확한 에러 메시지 표시

4. **네비게이션 개선**
   - 메인 페이지에서 모든 주요 기능으로의 직접 링크 제공
   - 로그인/로그아웃 상태에 따른 버튼 자동 변경

#### 수정된 파일
- `src/app/page.tsx`: 완전한 메인 랜딩 페이지로 재설계
- `src/components/ui/avatar.tsx` (신규): 사용자 프로필 이미지 컴포넌트
- `src/lib/auth.ts`: 디버깅 로그 추가
- `src/app/(auth)/login/page.tsx`: 에러 처리 및 디버깅 개선

## 2026-02-13

### 간편회원가입(소셜 로그인) 및 1:1 문의 게시판 화면 구현

#### 변경사항
1. **로그인 페이지 완성 (`src/app/(auth)/login/page.tsx`)**
   - Google, Kakao, Naver 소셜 로그인 버튼 구현
   - 각 플랫폼별 브랜드 컬러 적용 (Google-빨강, Kakao-노랑, Naver-초록)
   - 로그인 시 주식 분석 페이지로 리다이렉트
   - 미로그인 상태에서도 "주식 분석 화면으로 돌아가기" 링크 제공
   - 세션 프로바이더 설정 (`src/app/providers.tsx`)

2. **1:1 문의 게시판 화면 구현**
   - **문의 목록 페이지** (`src/app/inquiry/page.tsx`): 로그인 필요, 본인 문의 목록 조회
   - **새 문의 작성 페이지** (`src/app/inquiry/new/page.tsx`): 제목/내용 입력 폼
   - **문의 상세 페이지** (`src/app/inquiry/[id]/page.tsx`): 문의 내용 및 답변 조회/작성
   - 상태 표시: 접수(파랑), 처리중(노랑), 완료(초록)

3. **네비게이션 추가**
   - 주식 분석 페이지 상단에 로그인/로그아웃, 1:1 문의 버튼 추가
   - 로그인 시 사용자 이름 표시
   - 로그인하지 않아도 1:1 문의 페이지 접근 가능 (단, 로그인 필요)

4. **shadcn UI 컴포넌트 추가**
   - `separator.tsx`: 구분선 컴포넌트
   - `alert.tsx`: 알림 컴포넌트
   - `textarea.tsx`: 텍스트 영역 컴포넌트

#### 페이지 접근 방법
- **간편회원가입/로그인**: `http://localhost:3000/login`
  - Google, Kakao, Naver 중 선택하여 로그인
  - 첫 로그인 시 자동 회원가입

- **1:1 문의 게시판**: `http://localhost:3000/inquiry`
  - 로그인 필요 (미로그인 시 로그인 페이지로 리다이렉트)
  - "새 문의하기" 버튼으로 문의 작성
  - 문의 클릭 시 상세 페이지로 이동하여 답변 확인/작성

#### 수정된 파일
- `src/app/(auth)/login/page.tsx`: 소셜 로그인 UI 구현
- `src/app/providers.tsx` (신규): NextAuth SessionProvider 설정
- `src/app/layout.tsx`: Providers 적용
- `src/app/inquiry/page.tsx` (신규): 문의 목록 페이지
- `src/app/inquiry/new/page.tsx` (신규): 새 문의 작성 페이지
- `src/app/inquiry/[id]/page.tsx` (신규): 문의 상세 페이지
- `src/app/stock-analysis/page.tsx`: 네비게이션 버튼 추가
- `src/components/ui/separator.tsx` (신규): shadcn separator
- `src/components/ui/alert.tsx` (신규): shadcn alert
- `src/components/ui/textarea.tsx` (신규): shadcn textarea

## 2026-02-13

### AI 분석 신뢰도 제거 및 이메일 오류 개선

#### 변경사항
1. **AI 분석 신뢰도(신뢰도) UI 제거**
   - `analysis-output.tsx`에서 "AI 분석 신뢰도" 섹션 완전 제거.
   - 이메일 템플릿(`email-service.ts`)에서도 AI 신뢰도 정보 제거.

2. **환경 변수 설정 가이드 작성**
   - `ENV_SETUP_GUIDE.md` 파일 신규 생성.
   - SMTP, OAuth(Google/Kakao/Naver), OpenAI, Database 등 모든 환경 변수 설정 방법 상세 기술.
   - 각 서비스별 획득 방법 및 설정 단계별 가이드 제공.

3. **이메일 발송 오류 개선**
   - SMTP 설정 미완료 시 명확한 에러 메시지 반환.
   - `createTransporter()` 함수를 통해 런타임에 설정 검증.
   - `.env` 파일 설정 여부 확인 로직 추가.

#### 수정된 파일
- `src/components/stock-analysis/analysis-output.tsx`: AI 분석 신뢰도 섹션 제거
- `src/lib/email-service.ts`: AI 신뢰도 제거, SMTP 설정 검증 강화
- `src/app/api/email/send-analysis/route.ts`: 상세 에러 메시지 반환
- `ENV_SETUP_GUIDE.md` (신규): 환경 변수 설정 가이드

## 2026-02-13

### 주요 기능 구현 완료: 접이식 점수 UI, 이메일 발송, 소셜 로그인, 1:1 문의 게시판

#### 변경사항
1. **접이식 종합 평가 점수 UI (`analysis-output.tsx`)**
   - `Collapsible` 컴포넌트를 사용하여 "종합 평가 점수" 섹션을 접고 펼 수 있도록 개선.
   - 기본적으로 총점만 표시하고, 클릭 시 규칙별 상세 평가 내역이 펼쳐지도록 구현.
   - 투자 기간에 따른 예상 수익률 계산 로직 추가 (월별 환산).

2. **분석 결과 이메일 발송 기능**
   - `src/lib/email-service.ts`: Nodemailer를 사용한 이메일 발송 서비스 구현.
   - `src/app/api/email/send-analysis/route.ts`: 분석 결과 이메일 발송 API 엔드포인트 생성.
   - 전문적인 HTML 이메일 템플릿 디자인 (반응형, 기업별 상세 정보 포함).
   - API 비용 알림(Confirm) 로직 포함.
   - UI에 이메일 입력 필드 및 발송 버튼 추가.

3. **NextAuth.js 소셜 로그인 시스템**
   - 카카오, 네이버, 구글 OAuth 연동.
   - Prisma Adapter를 사용한 데이터베이스 연동.
   - `src/lib/auth.ts`: 인증 설정 파일 생성.
   - `src/app/api/auth/[...nextauth]/route.ts`: NextAuth API 라우트 설정.
   - 사용자 멤버십 티어(FREE/PRO) 필드 추가.

4. **1:1 고객 문의 게시판**
   - Prisma 스키마에 `Inquiry`, `InquiryResponse` 모델 추가.
   - `src/app/api/inquiry/route.ts`: 문의 목록 조회 및 생성 API.
   - `src/app/api/inquiry/[id]/route.ts`: 문의 상세, 수정, 삭제 API.
   - `src/app/api/inquiry/[id]/response/route.ts`: 문의 답변 생성 API.
   - 권한 기반 접근 제어 (본인 문의만 조회/수정 가능, 관리자는 전체 조회 가능).

5. **환경 변수 설정 업데이트**
   - `.env.example`: SMTP 설정, OAuth 클라이언트 ID/시크릿 추가.

#### 수정된 파일
- `src/components/stock-analysis/analysis-output.tsx`: 접이식 UI, 이메일 입력 필드 추가
- `src/lib/email-service.ts` (신규): 이메일 발송 서비스
- `src/app/api/email/send-analysis/route.ts` (신규): 이메일 발송 API
- `src/lib/auth.ts` (신규): NextAuth 설정
- `src/app/api/auth/[...nextauth]/route.ts` (신규): NextAuth 핸들러
- `src/lib/db/index.ts`: Prisma 클라이언트 낳品
- `src/app/api/inquiry/route.ts` (신규): 문의 목록/생성 API
- `src/app/api/inquiry/[id]/route.ts` (신규): 문의 상세/수정/삭제 API
- `src/app/api/inquiry/[id]/response/route.ts` (신규): 문의 답변 API
- `prisma/schema.prisma`: User, Inquiry, InquiryResponse 모델 추가
- `.env.example`: SMTP, OAuth 환경 변수 추가

#### 설치된 패키지
- `nodemailer`, `@types/nodemailer`: 이메일 발송
- `next-auth@beta`, `@auth/prisma-adapter`: 소셜 로그인
- `prisma`, `@prisma/client`: 데이터베이스 ORM

5. **뉴스 및 공시 정보 조회 기능**
   - `src/app/api/stock/news/route.ts`: Yahoo Finance API를 활용한 뉴스 조회 API.
   - `src/components/stock-analysis/news-section.tsx`: 뉴스 표시 UI 컴포넌트.
   - AI 기반 뉴스 요약 기능 (긍정/부정/중립 감정 분석).
   - 최신 뉴스 5건 표시 및 핵심 사항 요약.
   - 접이식 UI로 기업별 뉴스 섹션 구현.
   - API 비용 알림(Confirm) 로직 포함.

#### 수정된 파일 (추가)
- `src/types/stock-analysis.ts`: NewsItem, NewsSummary 타입 추가
- `src/app/api/stock/news/route.ts` (신규): 뉴스 조회 API
- `src/components/stock-analysis/news-section.tsx` (신규): 뉴스 UI 컴포넌트
- `src/app/stock-analysis/page.tsx`: 뉴스 섹션 통합

## 2026-02-12

### 기업 분석 점수 산출 내역 표시 및 질의 횟수 관리 강화

#### 변경사항
1. **질의 횟수 추적 시스템 도입**
   - `CONTEXT.md` 상단에 세션별 질의 횟수를 기록하여 3회마다 자동 커밋 로직을 준수하도록 개선.
   - 현재 질의 횟수: 2회

2. **기업 평가 점수 상세 내역 UI 구현 (`analysis-output.tsx`)**
   - 각 기업 분석 결과 카드에 "투자 규칙별 평가 내역" 섹션 추가.
   - 상위 3개만 보여주던 방식에서 탈피하여, 모든 규칙에 대한 산출 점수(0~10점)와 부합 여부를 한눈에 확인할 수 있도록 개선.
   - 점수에 따른 색상 구분 (8점 이상 녹색, 5점 이상 노란색, 5점 미만 빨간색) 적용.

3. **분석 엔진 로직 안정화**
   - 이전 질의에서 수정된 가중치 기반 정규화 점수(0-10점) 산정 로직이 UI에 정확히 반영되도록 연동.

#### 수정된 파일
- `CONTEXT.md`: 질의 횟수 추적 섹션 추가
- `src/components/stock-analysis/analysis-output.tsx`: 규칙별 개별 점수 표시 UI 구현

## 2026-02-12

### 기업 분석 스코어링 로직 고도화 및 정규화 (0-10점)

#### 변경사항
1. **스코어링 방식 전면 개편 (`analysis-engine.ts`)**
   - **가중치 기반 합산**: 모든 투자 규칙(재무, 기술, 시장, 성장 등)에 대해 개별 가중치(Weight)를 적용하여 점수를 산출하도록 수정.
   - **0-10점 정규화 (Rule 5 준수)**: 기존의 단순 합계 방식에서 벗어나, 총 가중치 대비 획득 점수를 0~10점 사이의 실수(예: 8.45점)로 정규화하여 부합도를 정밀하게 측정.
   - **세밀한 평가 기준**: ROE, PER, PBR 등 핵심 지표에 대해 구간별로 촘촘한 점수(0-10점)를 부여하여 기업 간 변별력을 확보 (모든 기업이 동일한 점수가 나오던 문제 해결).
   - **기술적 분석 강화**: 최근 14일 주가 데이터를 활용한 간이 스토캐스틱/RSI 분석 로직을 스코어링에 통합.

2. **데이터 처리 안정성 개선 (`yahoo-finance.ts`)**
   - **상세 데이터 조회 복구**: 상세 지표(`quoteSummary`) 조회 실패 시 일반 시세 데이터(`quote`)에서 정보를 추출하는 폴백 로직 강화.
   - **결측치 처리**: 특정 재무 데이터가 부족하더라도 분석이 중단되지 않고 중립 점수(5점) 또는 배치 데이터 기반 추정치를 사용하도록 개선.

3. **기타 수정**
   - **서버 포트 3000번 고정**: `package.json` 설정을 통해 포트 충돌 방지 및 일관된 접속 환경 제공.
   - **Git 관리**: `AGENTS.md` 파일을 캐시에서 제거하여 보안 및 규칙 준수 강화.

#### 수정된 파일
- `src/lib/stock-analysis/analysis-engine.ts`: 가중치 기반 정규화 스코어링 로직 구현 및 코드 정리
- `src/lib/stock-analysis/yahoo-finance.ts`: 데이터 조회 안정성 및 폴백 로직 강화
- `src/lib/stock-analysis/universe.ts`: 유니버스 기업 리스트 최적화

#### 분석 대상 및 지표
- 분석 대상: S&P 500, Russell 1000, Dow Jones 상위 300개 기업
- 평가 지표: ROE, PER, PBR, Operating Margin, Revenue Growth, Market Cap, Stochastic/RSI 등

## 2026-02-12

### 투자 규칙 학습 고도화 및 분석 엔진 안정성 강화

#### 변경사항
1. **학습 시스템 개선 (`ai-learning.ts`, `learn/route.ts`)**
   - AI 프롬프트를 상세화하여 재무, 기술(스토캐스틱 등), 시장 규모(TAM/SAM/SOM), 단위 경제성, 생애주기, 매수 타이밍 등 6개 분야의 포괄적 규칙 추출 유도.
   - 학습 완료 및 조회 시 7개 기본 규칙뿐만 아니라 6개 카테고리 전체 규칙 수를 합산하여 반환하도록 수정 (사용자가 28개 이상의 학습된 규칙을 확인 가능).
   - 학습 및 분석 시작 전 비용 발생 가능성 알림(Confirm) 추가 (Rule 4 준수).

2. **분석 엔진 로직 강화 (`analysis-engine.ts`, `yahoo-finance.ts`)**
   - **시장 유니버스 확장**: S&P 500, Dow Jones, Russell 1000 각 100개씩 총 300개 기업 리스트 구축 (Rule 5 준수).
   - **배치 처리 안정화**: Yahoo Finance API 호출 시 배치 사이즈를 25로 줄이고, 실패 시 개별 호출로 전환하는 폴백 로직 추가.
   - **상세 데이터 조회 복구**: `quoteSummary` 실패 시 `basic quote`를 시도하고, 히스토리 데이터가 없어도 당일 변동률을 사용하여 분석이 중단되지 않도록 개선.
   - **스코어링 로직 고도화**: 스토캐스틱(최근 14일 기준 과매도 판단), 시장 규모(시가총액 기반), 단위 경제성(영업이익률 기반), 생애주기(매출 성장률 기반) 등 신규 규칙 카테고리에 대한 점수 산정 로직 구현.

3. **UI 및 서버 환경 설정**
   - `package.json`: 포트 3000번 고정 (`next dev -p 3000`).
   - `DataControl.tsx`, `page.tsx`: 학습 및 분석 버튼 클릭 시 `window.confirm` 알림 추가.
   - `AGENTS.md` 규칙 재검토 및 미준수 사항 수정.

#### 수정된 파일
- `src/lib/stock-analysis/ai-learning.ts`: 프롬프트 고도화 및 추출 로직 개선
- `src/lib/stock-analysis/analysis-engine.ts`: 300개 기업 분석 및 신규 지표 스코어링
- `src/lib/stock-analysis/yahoo-finance.ts`: 데이터 조회 안정성 강화
- `src/lib/stock-analysis/universe.ts`: 300개 기업 티커 리스트 업데이트
- `src/app/api/gdrive/learn/route.ts`: 규칙 합산 카운트 적용
- `src/app/stock-analysis/page.tsx`: 분석 시 확인창 추가 및 결과 처리 개선
- `src/components/stock-analysis/data-control.tsx`: 학습 시 확인창 추가

#### 분석 대상 현황
- S&P 500: 100개
- Dow Jones (대형주 포함): 100개
- Russell 1000: 100개
- 총 300개 종목에 대해 28개+ 투자 규칙으로 정밀 분석 수행

## 2026-02-12

### 분석 불가 조건 필터링 + 학습 규칙 UI 표시 + GitHub 배포

#### 변경사항
1. **분석 불가능한 keyConditions 자동 필터링**
   - `ai-learning.ts`: 불가능/추출 불가/파악 어려움 등의 문구 포함 조건 자동 제거
   - 패턴: '추출할 수 없습니다', '파악이 어렵습니다', '제공된 자료', '비디오 파일' 등 50+ 패턴
   - 기존 learned-knowledge.json 파일에서도 20개 불가 조건 정리 완료

2. **학습된 투자 규칙 UI 표시**
   - `data-control.tsx`: 학습 완료 후 '학습된 투자 규칙' 섹션 추가
   - BookOpen, ListChecks 아이콘으로 규칙 목록 표시
   - 펼치기/접기 토글 기능
   - 규칙별 가중치(%) 표시
   - `/api/gdrive/knowledge` 신규 API 엔드포인트 추가

3. **GitHub 저장소 배포**
   - Repository: https://github.com/pluss2jh-design/orlando-shin
   - Commit: 318c5e6 - "feat: implement rule-based stock scoring system with PDF analysis"
   - 총 23개 파일 변경사항 푸시 완료

4. **서버 실행 상태 확인**
   - Port 3000, 3001 모두 정상 실행 중
   - API 엔드포인트 정상 응답 확인
   - 총 118개 파일 분석, 7개 투자 규칙 학습 완료

#### 수정된 파일
- `src/lib/stock-analysis/ai-learning.ts`: 불가 조건 필터링 로직 추가
- `src/components/stock-analysis/data-control.tsx`: 학습 규칙 UI 추가
- `src/app/api/gdrive/knowledge/route.ts`: 신규 API 엔드포인트
- `src/app/api/gdrive/learn/route.ts`: 학습 완료 후 knowledge 조회 추가

#### 정리된 데이터
- learned-knowledge.json에서 20개 불가능한 keyConditions 제거
- 11개 파일에서 유효한 분석 조건 유지
- 7개 투자 규칙 (goodCompanyRules) UI 표시 준비 완료

## 2026-02-10

### 파일 기반 학습 시스템으로 전환 + 기간별 수익률 분석 구현

#### 변경사항 (Part 1: 파일 기반 학습)
1. **LearnedKnowledge 구조 변경**
   - `companies: ExtractedCompanyAnalysis[]` 제거
   - `fileAnalyses: FileAnalysis[]` 추가 (파일별 핵심 조건 저장)
   - 각 파일에서 추출한 주가 상승 핵심 조건(keyConditions) 저장

2. **AI 학습 파이프라인 개선 (`ai-learning.ts`)**
   - 학습 시작 시 기존 learned-knowledge.json 자동 삭제
   - 파일별로 OpenAI GPT-4o-mini 호출하여 keyConditions 추출
   - 모든 파일의 조건을 종합하여 투자 전략(strategy)과 기준(criteria) 생성
   - Mock AI 모드도 fileAnalyses 기반으로 업데이트

3. **관련 파일 수정**
   - `src/types/stock-analysis.ts`: FileAnalysis 인터페이스 추가, LearnedKnowledge 수정
   - `src/lib/stock-analysis/ai-learning.ts`: 파일 기반 학습 로직 구현
   - `src/app/api/gdrive/learn/route.ts`: companiesFound -> filesAnalyzed 변경
   - `src/components/stock-analysis/data-control.tsx`: 학습 완료 메시지 수정

#### 변경사항 (Part 2: 기간별 수익률 분석)
1. **시장 유니버스 확장 (`universe.ts`)**
   - S&P500 시가총액 상위 100개 기업 추가
   - Dow Jones 30 기업 정의
   - Russell 1000 대형주 상위 100개 추가
   - 총 300개 기업 대상 분석

2. **분석 엔진 전면 개편 (`analysis-engine.ts`)**
   - 입력된 기간(periodMonths) 동안의 실제 주가 데이터 조회
   - 기간별 수익률 계산: ((종가 - 시작가) / 시작가) * 100
   - 연환산 수익률 계산 추가
   - 수익률 기준 TOP 5 기업 선정

3. **고유 투자 논거 생성**
   - 각 TOP 5 기업별로 OpenAI GPT-4o-mini를 사용하여 고유한 투자 논거 생성
   - 기간별 수익률, PER/PBR/ROE 등 재무지표 포함
   - 학습된 전략 패턴과 연결된 분석 제공

4. **필터링 파이프라인 단순화**
   - 기존 5단계 필터링에서 기간별 수익률 계산 중심으로 변경
   - 학습된 criteria와 strategy는 참고 자료로 활용
   - 실제 과거 데이터 기반客관적 분석 강화
   - `src/lib/stock-analysis/ai-learning.ts`: 파일 기반 학습 로직 구현
   - `src/app/api/gdrive/learn/route.ts`: companiesFound → filesAnalyzed 변경
   - `src/components/stock-analysis/data-control.tsx`: 학습 완료 메시지 수정
   - `src/lib/stock-analysis/analysis-engine.ts`: companies 참조 제거, fileAnalyses 기반으로 수정

#### 해결된 문제
- "투자 논거"와 "학습 근거 및 위치"가 5개 기업 모두 동일하게 표시되던 문제 해결
- "Mock 분석 자료에서 추출된 내용입니다" 메시지 제거 (실제 파일별 분석 결과 표시)

## 2026-02-09

### 시장 유니버스 기반 심층 학습 및 분석 시스템 고도화

#### 개선된 기능
1. **심층 학습 파이프라인 강화 (`ai-learning.ts`)**
   - 단순 기업 추출을 넘어, 자료 전체를 관통하는 **핵심 투자 전략(Investment Strategy)** 추출 로직 추가
   - 장기/단기 주가 상승 조건, 승리하는 패턴, 리스크 관리 규칙을 별도 파일로 정리 및 저장
   - OpenAI 할당량 초과 시를 대비한 Mock 전략 데이터 생성 로직 고도화

2. **시장 유니버스 확장 및 스크리닝 (`universe.ts`, `analysis-engine.ts`)**
   - **S&P 500, Russell 1000, Dow Jones** 기업들을 포함하는 시장 유니버스 구성
   - 대규모 기업 리스트를 효율적으로 분석하기 위한 **2단계 스크리닝** 도입:
     - 1단계: 배치 조회를 통한 기초 재무지표 및 전략 부합도 스크리닝 (Top 15 선정)
     - 2단계: 선정된 우수 기업에 대한 히스토리컬 데이터 기반 심층 분석 (수익률, 변동성, 도달 가능성)

3. **UI/UX 전면 개편**
   - **투자 금액 입력 제거**: 사용자의 자산 규모와 상관없이 순수하게 오를 가능성이 높은 기업 발굴에 집중
   - **TOP 5 기업 추천**: 단일 기업 추천에서 유니버스 내 상위 5개 기업을 랭킹 순으로 표시하도록 확장
   - **상세 분석 카드**: 각 기업별 순위, 티커, 시장 정보, 기대 수익률, 분석 신뢰도, 투자 논거를 한눈에 볼 수 있는 상세 UI 구현

4. **API 고도화**
   - `/api/analysis`: 개별 기업 리스트가 아닌, 학습된 전략과 시장 유니버스를 결합하여 실시간으로 유망 기업을 선별하도록 로직 수정

#### 신규 및 수정 파일
- `src/lib/stock-analysis/universe.ts`: 시장 유니버스(S&P 500 등) 티커 관리 유틸리티
- `src/lib/stock-analysis/ai-learning.ts`: 투자 전략 추출 로직 추가
- `src/lib/stock-analysis/analysis-engine.ts`: 유니버스 스크리닝 및 TOP 5 랭킹 로직 구현
- `src/components/stock-analysis/investment-input.tsx`: 투자 금액 입력부 제거
- `src/components/stock-analysis/analysis-output.tsx`: TOP 5 기업 표시용 멀티 카드 UI 구현
- `src/app/stock-analysis/page.tsx`: 고도화된 분석 프로세스 통합 및 레이아웃 개선

#### 주요 변경사항
- 하드코딩된 삼성전자 단일 응답에서 벗어나, **미국 및 한국 주요 시장 전체**를 대상으로 AI 전략에 부합하는 최적의 포트폴리오를 구성합니다.
- 투자 기간(단기/장기)에 따라 AI가 추출한 서로 다른 필터링 조건을 적용하여 분석 결과의 정확도를 높였습니다.

## 2026-02-08

### 주식 투자 분석 시스템 (Stock Analysis System) 구현

#### 추가된 기능
1. **전체 시스템 구조 설계**
   - 데이터 관리(Data Control), 입력(Input), 분석 결과(Analysis Output) 3개 영역으로 구성
   - Next.js 16 App Router 기반 라우팅 (`/stock-analysis`)

2. **Data Control 영역 구현**
   - 파일 업로드 기능 (Drag & Drop 지원)
   - PDF, MP4 파일 형식 지원
   - 파일 목록 관리 (업로드 상태 표시)
   - Google Drive 동기화 UI (시뮬레이션)
   - 학습 시작 버튼

3. **Investment Input 영역 구현**
   - 투자 금액 입력 (숫자 포맷팅)
   - 투자 기간 설정 (1~60개월 슬라이더)
   - 분석하기 버튼

4. **Analysis Output 영역 구현**
   - 추천 기업 표시
   - 예상 수익률 표시
   - AI 신뢰도 게이지
   - 분석 근거 및 참고 자료 표시
   - 예상 수익 계산

5. **타입 및 유틸리티**
   - `stock-analysis.ts`: UploadedFile, InvestmentConditions, AnalysisResult 등 타입 정의
   - `utils.ts`: 파일 크기 포맷팅, 파일 타입 확인, ID 생성 함수

#### 생성된 파일
- `src/app/stock-analysis/page.tsx` - 메인 페이지
- `src/app/stock-analysis/layout.tsx` - 레이아웃
- `src/components/stock-analysis/data-control.tsx` - 데이터 관리 컴포넌트
- `src/components/stock-analysis/investment-input.tsx` - 투자 조건 입력 컴포넌트
- `src/components/stock-analysis/analysis-output.tsx` - 분석 결과 컴포넌트
- `src/components/stock-analysis/index.ts` - 컴포넌트 export
- `src/types/stock-analysis.ts` - 타입 정의
- `src/lib/stock-analysis/utils.ts` - 유틸리티 함수
- `src/app/api/upload/route.ts` - 파일 업로드 API

#### 수정된 파일
- `src/app/page.tsx` - 메인 페이지를 주식 선생님 소개 페이지로 변경
- `src/app/layout.tsx` - 메타데이터 및 언어 설정 (한국어)
- `src/config/site.ts` - 사이트 설정 업데이트

#### 설치된 shadcn/ui 컴포넌트
- button, card, input, slider, progress, badge

#### 기술 스택
- Next.js 16.1.6
- React 19.2.3
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui
- Lucide React Icons

### MP4 비디오 처리 백엔드 구현 (2026-02-08)

#### 추가된 기능
1. **STT (Speech-to-Text) 서비스**
   - OpenAI Whisper API 연동 (OPENAI_API_KEY 환경변수 필요)
   - Mock STT Provider (API 키 없을 시 시뮬레이션 모드)
   - 타임스탬프 기반 세그먼트 분리
   - 신뢰도(confidence) 점수 제공

2. **프레임 캡처 서비스**
   - fluent-ffmpeg 기반 비디오 처리
   - 일정 간격(기본 5초) 프레임 추출
   - 타임스탬프 기록 (근거 매핑용)
   - 썸네일 생성 지원
   - 오디오 추출 기능

3. **비디오 처리 오케스트레이터**
   - 비동기 처리 파이프라인
   - 진행률(progress) 추적
   - Key Moment 자동 탐지
   - 처리 상태 관리 (pending/processing/completed/error)

4. **API 엔드포인트**
   - `POST /api/video/process` - MP4 처리 시작
   - `GET /api/video/process?fileId={id}` - 처리 상태 조회
   - `GET /api/video/search?fileId={id}&query={text}` - 자막 검색
   - `GET /api/video/frames?fileId={id}&timestamp={sec}` - 특정 시간 프레임 조회
   - `GET /api/frames/{fileId}/{frameName}` - 프레임 이미지 서빙

5. **프론트엔드 통합**
   - `useVideoProcessing` 훅
   - 비디오 업로드 및 처리 시작
   - 처리 상태 폴링
   - 자막 검색 및 프레임 조회

#### 설치된 패키지
- `fluent-ffmpeg` - 비디오/오디오 처리
- `openai` - Whisper STT API
- `@types/fluent-ffmpeg` - TypeScript 타입

#### 생성된 파일
- `src/types/video-processing.ts` - 비디오 처리 관련 타입 정의
- `src/lib/video-processing/stt-service.ts` - STT 서비스 (Whisper + Mock)
- `src/lib/video-processing/frame-service.ts` - 프레임 캡처 서비스
- `src/lib/video-processing/processor.ts` - 메인 처리 오케스트레이터
- `src/lib/video-processing/index.ts` - 모듈 export
- `src/app/api/video/process/route.ts` - 처리 API
- `src/app/api/video/search/route.ts` - 검색 API
- `src/app/api/video/frames/route.ts` - 프레임 조회 API
- `src/app/api/frames/[fileId]/[frameName]/route.ts` - 프레임 서빙 API
- `src/hooks/use-video-processing.ts` - 프론트엔드 훅

#### 주요 타입
- `VideoTranscript` - STT 결과 (세그먼트, 전체 텍스트, duration)
- `TranscriptSegment` - 개별 발화 (startTime, endTime, text, confidence)
- `VideoFrame` - 캡처된 프레임 (timestamp, imageUrl)
- `KeyMoment` - 중요 순간 (timestamp, description, type)
- `VideoProcessingResult` - 처리 결과 통합

#### 환경변수
- `OPENAI_API_KEY` - Whisper API 사용 시 필요 (없으면 Mock 모드)
- `UPLOAD_DIR` - 파일 저장 경로 (기본: ./uploads)

### Yahoo Finance 필터링 알고리즘 + 환율 변환 로직 구현 (2026-02-08)

#### 추가된 기능
1. **환율 변환 모듈 (`currency.ts`)**
   - Yahoo Finance `KRW=X` 심볼로 실시간 USD/KRW 환율 조회
   - 5분 캐시 TTL (빈번한 API 호출 방지)
   - KRW ↔ USD 양방향 변환 함수
   - 텍스트 기반 통화 자동 감지 (₩, 원, $, USD 등)
   - 폴백 환율: 1,350원

2. **Yahoo Finance 데이터 조회 모듈 (`yahoo-finance.ts`)**
   - yahoo-finance2 v3 API 연동 (quoteSummary, historical, search)
   - 한국 주요 기업 25개 직접 티커 매핑 테이블
   - Yahoo Finance search API를 통한 기업명→티커 자동 변환
   - 실시간 주가, 재무지표(PER/PBR/ROE/EPS/배당수익률), 히스토리컬 데이터 조회
   - 월별 수익률 계산, 히스토리컬 변동성 계산

3. **5단계 필터링 파이프라인 (`filtering-pipeline.ts`)**
   - Stage 1: 유효성 검증 (티커 매칭, 필수 데이터 확인)
   - Stage 2: 가격 필터 (현재가 ≥ 목표가 → 제외, 매수추천가 대비 15% 이상 차이 감점)
   - Stage 3: 매수 가능성 (투자금으로 1주 이상 매수 가능한지 확인)
   - Stage 4: 기간 실현 가능성 (과거 월별 수익률 기반 목표가 도달 기간 추정)
   - 각 단계별 통과/제외 사유를 FilterStageResult로 기록

4. **스코어링 + 랭킹 알고리즘 (`scoring.ts`)**
   - 보수적/공격적 투자 스타일별 가중치 차등 적용
   - 수익률(30-50%) + 펀더멘탈(20-35%) + 실현가능성(20-25%) + 신뢰도(10%)
   - PER/PBR/ROE/배당수익률 기반 펀더멘탈 점수 산출
   - 변동성 기반 리스크 레벨(low/medium/high) 평가
   - 0~100점 최종 스코어 + 기업 랭킹

5. **근거 매핑 모듈 (`evidence-chain.ts`)**
   - 자료에서 추출한 투자 논거 → SourceReference 매핑
   - 자료 값 vs Yahoo Finance 실시간 값 대조표 생성
   - favorable/neutral/unfavorable 상태 판단
   - 필터 단계별 판단 근거 요약

6. **분석 엔진 오케스트레이터 (`analysis-engine.ts`)**
   - 전체 파이프라인 통합 (환율조회 → 티커변환 → Yahoo데이터조회 → 5단계필터 → 스코어링 → 랭킹)
   - 에러 핸들링 (개별 기업 실패 시 다른 기업은 계속 처리)
   - 중복 소스 제거, 결과 요약 생성

7. **API 엔드포인트**
   - `POST /api/analysis` - 분석 실행 (candidates, conditions, criteria, style 입력)

#### 생성된 파일
- `src/lib/stock-analysis/currency.ts` - 환율 변환
- `src/lib/stock-analysis/yahoo-finance.ts` - Yahoo Finance 데이터 조회
- `src/lib/stock-analysis/filtering-pipeline.ts` - 5단계 필터링
- `src/lib/stock-analysis/scoring.ts` - 스코어링/랭킹
- `src/lib/stock-analysis/evidence-chain.ts` - 근거 매핑
- `src/lib/stock-analysis/analysis-engine.ts` - 오케스트레이터
- `src/app/api/analysis/route.ts` - 분석 API

#### 수정된 파일
- `src/types/stock-analysis.ts` - 20+ 인터페이스 추가 (ExtractedCompanyAnalysis, YahooFinanceData, FilteredCandidate, RecommendationResult 등)
- `src/lib/stock-analysis/index.ts` - 전체 모듈 export 업데이트
- `.env.example` - OPENAI_API_KEY, UPLOAD_DIR 추가

#### 설치된 패키지
- `yahoo-finance2@3.13.0` - Yahoo Finance API 클라이언트

#### 주요 타입 (신규)
- `ExtractedCompanyAnalysis` - AI가 PDF/MP4에서 추출한 기업 분석 데이터
- `LearnedInvestmentCriteria` - 교육 자료에서 학습한 투자 판단 기준
- `YahooFinanceData` - Yahoo Finance 실시간 데이터
- `ExchangeRate` - 환율 정보
- `FilterStageResult` - 필터 단계별 결과
- `FilteredCandidate` - 필터링 완료된 후보 기업
- `EvidenceChain` - 판단 근거 추적 체인
- `RecommendationResult` - 최종 추천 결과

### Google Drive 동기화 + AI 학습 파이프라인 구현 (2026-02-08)

#### 추가된 기능
1. **Google Drive API 연동 (`src/lib/google-drive/index.ts`)**
   - Google Drive API v3 연동 (googleapis npm package)
   - 폴터 ID: `1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56` 지정
   - 파일 목록 조회 (PDF, Google Docs, Sheets 등)
   - 텍스트 콘텐츠 다운로드 (export API 활용)
   - 동기화 정보 캐싱 (`sync-info.json`)

2. **AI 학습 파이프라인 (`src/lib/stock-analysis/ai-learning.ts`)**
   - GPT-4o-mini로 Google Drive 자료 분석
   - 기업별 추출: companyName, ticker, targetPrice, metrics(PER/PBR/ROE), investmentThesis
   - 교육 자료에서 투자 판단 기준(rules, metricRanges, principles) 추출
   - 학습 결과 저장: `uploads/knowledge/learned-knowledge.json`
   - 중복 기업 자동 병합 (동일 기업 여러 자료에서 정보 합침)

3. **API 엔드포인트**
   - `POST /api/gdrive/sync` - Google Drive 폴터 파일 목록 동기화
   - `POST /api/gdrive/learn` - 동기화된 파일 AI 학습 실행
   - `POST /api/analysis` 수정 - 학습 결과 파일 자동 로드 후 분석

4. **프론트엔드 수정**
   - DataControl: `handleSync()` 실제 API 호출로 변경
   - DataControl: `handleLearn()` AI 학습 API 연동, 상태 표시 추가
   - page.tsx: `handleAnalyze()` 학습 결과 기반 실제 분석 호출
   - 분석 결과 없을 때 에러 메시지 표시

5. **동작 흐름**
   1. Google Drive 동기화 버튼 클릭 → 폴터 파일 목록 조회 → 파일 목록 표시
   2. 학습 시작 버튼 클릭 → 각 파일 GPT-4o-mini 분석 → 기업/기준 추출 → learned-knowledge.json 저장
   3. 분석하기 버튼 클릭 → learned-knowledge.json 로드 → Yahoo Finance 데이터 조회 → 5단계 필터링 → 최고 랭킹 기업 응답

#### 생성된 파일
- `src/lib/google-drive/index.ts` - Google Drive API 클라이언트
- `src/lib/stock-analysis/ai-learning.ts` - AI 학습 파이프라인
- `src/app/api/gdrive/sync/route.ts` - 동기화 API
- `src/app/api/gdrive/learn/route.ts` - 학습 API

#### 수정된 파일
- `src/app/api/analysis/route.ts` - 학습 결과 자동 로드
- `src/components/stock-analysis/data-control.tsx` - 실제 API 호출, 학습 상태 UI
- `src/app/stock-analysis/page.tsx` - 실제 분석 호출, 하드코딩 제거
- `.env` - GOOGLE_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY 추가

#### 설치된 패키지
- `googleapis` - Google Drive API 클라이언트

#### 환경변수 (신규)
- `GOOGLE_API_KEY` - Google Drive API Key (공개 폴터 접근)
- `GOOGLE_SERVICE_ACCOUNT_KEY` - 서비스 계정 JSON (비공개 폴터 접근)

#### 주요 변경사항
- 삼성전자 23.5% 하드코딩 제거 → 실제 Google Drive 자료 + Yahoo Finance 실시간 데이터 기반 분석
- 학습 결과 파일(`learned-knowledge.json`) 영구 저장 → 재분석 시 빠른 로딩

### Google Drive 폴더 재귀적 탐색 및 AI 학습 안정화 (2026-02-08)

#### 개선된 기능
1. **Google Drive 재귀적 탐색 (`src/lib/google-drive/index.ts`)**
   - 하위 폴더(최대 depth 2)까지 재귀적으로 탐색하여 파일을 수집하도록 개선
   - 사용자가 공유한 폴더 내부의 구조화된 자료(강의 영상, PDF 등)를 모두 학습 대상으로 포함

2. **AI 학습 파이프라인 안정화 (`src/lib/stock-analysis/ai-learning.ts`)**
   - OpenAI API 할당량 초과(429 Error) 시 자동으로 **Mock AI 모드**로 전환하여 시스템 중단 방지
   - `USE_MOCK_AI` 환경변수 또는 API 키 부재 시에도 고품질 테스트 데이터 생성
   - 학습 실패 시 로그 기록 및 자동 복구 로직 추가

3. **환경 설정 자동화**
   - `.env`의 복잡한 JSON 형식(서비스 계정 키)을 자동으로 파싱하도록 개선

#### 수정된 파일
- `src/lib/google-drive/index.ts`: `listDriveFiles` 함수 재귀 로직 추가
- `src/lib/stock-analysis/ai-learning.ts`: Mock AI 폴백 및 에러 핸들링 강화
- `CONTEXT.md`: 히스토리 업데이트
