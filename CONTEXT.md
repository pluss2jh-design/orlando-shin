# Project Context History

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
- `.env.example` - GOOGLE_API_KEY, GOOGLE_SERVICE_ACCOUNT_KEY 추가

#### 설치된 패키지
- `googleapis` - Google Drive API 클라이언트

#### 환경변수 (신규)
- `GOOGLE_API_KEY` - Google Drive API Key (공개 폴터 접근)
- `GOOGLE_SERVICE_ACCOUNT_KEY` - 서비스 계정 JSON (비공개 폴터 접근)

#### 주요 변경사항
- 삼성전자 23.5% 하드코딩 제거 → 실제 Google Drive 자료 + Yahoo Finance 실시간 데이터 기반 분석
- 학습 결과 파일(`learned-knowledge.json`) 영구 저장 → 재분석 시 빠른 로딩
