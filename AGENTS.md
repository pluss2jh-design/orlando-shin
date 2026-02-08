# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-08
**Commit:** a9064a8
**Branch:** master

## OVERVIEW

Next.js 16 SaaS starter — App Router, TypeScript, Tailwind CSS v4, shadcn/ui. Greenfield project with auth/billing/dashboard scaffolding ready for implementation.

## STRUCTURE

```
orlando-shin/
├── prisma/               # Prisma schema (User, Account, Session models)
├── public/               # Static assets (SVGs)
├── src/
│   ├── app/
│   │   ├── (auth)/       # Route group: login, register (centered layout)
│   │   ├── (dashboard)/  # Route group: dashboard, settings, billing (sidebar layout)
│   │   ├── (marketing)/  # Route group: landing pages (minimal layout)
│   │   └── api/auth/     # Auth API route placeholder
│   ├── components/
│   │   ├── layout/       # Header, Footer
│   │   ├── ui/           # shadcn/ui components (empty, add via `npx shadcn add`)
│   │   ├── forms/        # Form components (empty)
│   │   └── shared/       # Shared components (empty)
│   ├── config/           # Site config, pricing plans
│   ├── hooks/            # Custom React hooks
│   ├── lib/
│   │   ├── auth/         # Auth utilities (stub)
│   │   ├── db/           # Database client (stub)
│   │   ├── email/        # Email service (stub)
│   │   ├── stripe/       # Stripe billing (stub)
│   │   └── validations/  # Zod schemas (stub)
│   ├── types/            # Shared TypeScript interfaces
│   └── proxy.ts          # Next.js 16 proxy (replaces middleware)
└── .env.example          # Required env vars template
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add a page | `src/app/(group)/` | Use route groups: `(auth)`, `(dashboard)`, `(marketing)` |
| Add UI component | `npx shadcn add <name>` | Lands in `src/components/ui/` |
| Add custom component | `src/components/shared/` | Or `forms/` for form-specific |
| Configure auth | `src/lib/auth/index.ts` | Stub — wire up NextAuth/Clerk/Lucia |
| Configure DB | `src/lib/db/index.ts` + `prisma/schema.prisma` | Stub — run `npx prisma generate` after setup |
| Configure billing | `src/lib/stripe/index.ts` + `src/config/plans.ts` | Stub — add Stripe SDK |
| Add validation schema | `src/lib/validations/` | Stub — add Zod |
| Protect routes | `src/proxy.ts` | Next.js 16 uses `proxy.ts` not `middleware.ts` |
| Shared types | `src/types/index.ts` | User, Session interfaces |
| Site metadata | `src/config/site.ts` | Name, description, URLs |

## CONVENTIONS

- **Next.js 16**: Uses `proxy.ts` (not `middleware.ts`) — exports `default function proxy()`
- **Tailwind v4**: PostCSS-based, no `tailwind.config.ts` — config in `globals.css` via CSS
- **shadcn/ui**: Add components via CLI (`npx shadcn add button`), not manual creation
- **Path alias**: `@/*` maps to `./src/*`
- **Route groups**: `(auth)`, `(dashboard)`, `(marketing)` — each has its own layout
- **Lib stubs**: `lib/auth`, `lib/db`, `lib/email`, `lib/stripe` are empty stubs awaiting implementation

## ANTI-PATTERNS (THIS PROJECT)

- Do NOT create `middleware.ts` — use `proxy.ts` (Next.js 16 convention)
- Do NOT create `tailwind.config.ts` — Tailwind v4 uses CSS-based config in `globals.css`
- Do NOT manually create files in `src/components/ui/` — use `npx shadcn add`
- Do NOT put page-specific types in `src/types/` — colocate with the page/component
- Do NOT use `as any` or `@ts-ignore`

## COMMANDS

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npx shadcn add     # Add shadcn/ui components
npx prisma generate  # Generate Prisma client (after schema changes)
npx prisma db push   # Push schema to database
```

## NOTES

- All `lib/` modules are stubs — auth, db, email, stripe need provider setup
- `.env.example` documents all required environment variables
- Prisma schema includes User/Account/Session/VerificationToken (NextAuth-compatible)
- Pricing plans defined in `src/config/plans.ts` (free/pro/enterprise)


## Guide
@ 기본 컨셉
내가 업로드한 자료로 학습이 된 주식 선생님에게 조건(투자금, 투자기간)을 얘기하면 그에 맞는 수익률이 가장 높은 기업 응답과 근거 자료 제시하는 시스템

@ 고려할 점
1. 데이터 학습 및 처리 방식
자료 업데이트 방식: 특정 클라우드에 모아두고 내가 이벤트를 줄 때마다 업데이트된 전체 자료를 학습해서 내 질의에 답하도록 할거야.
MP4 처리: 영상의 소리, 영상속의 차트나 표 등 모든 것을 분석 대상으로 삼을거야.

2. 투자 논리 도출 가이드 (AI의 사고방식)
보수적 vs 공격적: 내가 업로드한 자료를 바탕으로 보수적/공격적 투자방식을 정하도록 할거야.
결과 도출의 투명성: 내가 업로드한 자료 중 어떤 부분을 이용해서 결과 도출이 되었는지 근거를 노출할거야. 참고로, 내가 업로드할 자료는 특정 기업에 대한 분석 뿐만 아니라 주식 투자에 대한 기본 개념, 주식투자를 할 때 어떤 지표를 봐야하는지 등의 교육 자료 등이 섞여 있을거야.

3. 사용자 입력값(Input)의 범위
필수 조건: 투입 금액, 투자 기간만 입력할 거고 선호 섹터/손절 라인 설정 등은 입력 안할도록 할거야.

4. 사이트의 기능적 구조 (UI/UX)
데이터 관리 페이지, 상세 분석 페이지 모두 융합된 화면을 만들고 싶어.
우선, 데이터 관리 페이지에선 pdf, mp4 등 내가 가진 파일을 업로드 및 관리할 거고,
상세 분석 페이지에선 투자 조건(투자금, 투자기간)을 입력할 수 있는 영역과 조건에 부합하는 기업 찾기 요청을 했을 땐 가장 수익률이 높은 기업과 판단 근거(pdf,mp4자료와 실시간 정보)를 나타내는 영역이 있게 만들거야.

@ 구현 시 고려할 점
1. 기술적 구현을 위한 최종 체크리스트
클라우드 저장소 선택: 구글 드라이브
실시간 정보 소스: Yahoo Finance API
멀티모달(Multimodal) AI 모델: 추후 선택 예정.

2. 사이트 화면(UI) 구성 상세
영역	주요 기능
상단 (Data Control)	파일 업로드 버튼, 클라우드 동기화 상태, '학습 시작(Event)' 버튼
중앙 (Input)	투자 금액(Input), 투자 기간(Slider/Input) 설정 영역
하단 (Analysis)	[분석하기] 버튼과 그 아래로 출력되는 추천 기업/수익률/판단 근거

3. AI의 판단 프로세스 (Back-end Logic)
지식 베이스 구축: 교육 자료를 통해 '좋은 기업의 조건'과 '지표 분석법' 학습.
기업 필터링: 기업 분석 자료(PDF/MP4)에서 추출한 데이터와 실시간 주가를 대조.
최적화: 입력된 투자금과 기간에 맞춰, 학습된 논리 중 가장 수익률이 높을 것으로 예상되는 조합 생성.
근거 매핑: 결과 도출에 사용된 자료의 파일명과 특정 타임스탬프/페이지 번호를 추출.

4. MP4 분석을 위한 '데이터 전처리' 방식
STT(Speech-to-Text): 영상의 음성을 텍스트로 변환해 검색 가능한 데이터로 만듭니다.
프레임 캡처: 영상 속 차트나 표가 나오는 순간을 이미지로 추출해 AI가 시각 정보를 분석하게 합니다.
타임스탬프 기록: 나중에 근거를 보여줄 때 "영상 05:20초 지점의 차트 기반"이라고 표시하려면 필수적입니다.

5. 실시간 주가와 내 자료의 '동기화 로직'
업데이트 규칙: "내 자료에서는 매수를 추천하지만, 실시간 주가가 이미 목표가를 넘었다면 제외하라"는 식의 최종 필터링 로직이 필요합니다.
단위 통일: 내 자료는 '원화' 기준인데 야후 파이낸스는 '달러' 기준일 경우, 실시간 환율을 반영해 단위를 맞추는 코드가 포함되어야 합니다.

@ github 주소: https://github.com/pluss2jh-design/orlando-shin

@ rules(규칙)
1. 내가 질의하면 답변 후 프로젝트에 반영된 사항을 날짜 기준으로 CONTEXT.md에 짧게 요약해서 정리해.
2. 내가 질의하면 답변 마지막에 항상 질의 횟수를 적고, 3번 째 질의 및 답변 후엔 git에 소스를 커밋해. 그리고 질의 횟수를 다시 초기화 해.
3. 수정 후엔 너가 테스트까지 성공적으로 완료한 후에 나한테 다됬다고 얘기하고, 너가 "npm run dev" 실행해. 단, 기존에 같은 포트로 실행되고 있는 프로세스가 있으면 그 프로세스 종료하고 명령어 실행해.