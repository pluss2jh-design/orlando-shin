# 작업 로그 (Analysis Pipeline Optimization)

## 2026-03-26
- AI 모델 선택 강제화: 분석 시작 전 AI 모델 선택을 필수화하고, 선택되지 않은 경우 'Scan Alpha' 버튼을 비활성화함.
- 유니버스 선택 로직 보강: InvestmentInput에서 universeType에 따라 excludeSP500 속성을 명시적으로 설정하여 백엔드 전달 시 모호함을 제거함. (S&P 500 선택 시 Russell 1000 제외 로직 충돌 방지)
- 분석 중단(Stop) 기능 구현:
  - 기업 분석 중 사용자가 실시간으로 중단할 수 있는 'STOP' 버튼 추가.
  - 원천 데이터 학습(Learning) 중 사용자가 중단할 수 있는 'STOP' 버튼 추가.
  - 백엔드 StockService 및 API(/api/analysis/cancel, /api/gdrive/learn/cancel) 연동.
- 데이터 보안 강화: 로컬 파일 업로드 기능을 완전히 제거하고 오직 Google Drive(Read-Only) 연동만 사용하도록 고정함.
- 백엔드 안정성: Prisma Client 재생성을 통해 타입 오류 해결 및 분석 엔진 중단 시 상태 관리 로직 추가.
