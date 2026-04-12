import { prisma } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';
import {
  listDriveFiles,
  downloadDriveFile,
  downloadTextContent,
  DriveFileInfo
} from '@/lib/google-drive';
import { videoProcessingService } from '@/lib/video-processing/processor';
import {
  LearnedKnowledge,
  LearnedInvestmentCriteria,
  FileAnalysis,
  InvestmentStrategy
} from '@/types/stock-analysis';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Constants & Utilities ──────────────────────────────────────────
const ANALYSIS_CACHE_DIR = path.join(process.cwd(), 'logs/cache/learning');

const INDIVIDUAL_ANALYSIS_PROMPT_TEMPLATE = `
  당신은 전설적인 주식 투자자들의 논리를 학습하고 데이터에서 초과 수익의 원천(Alpha)을 발굴하는 수석 데이터 과학자입니다. 
  제공된 자료에서 '훌륭한 기업을 찾는 기준'과 '매수 타이밍/패턴'을 정밀하게 추출하고 고도의 '투자 알고리즘'으로 변환하십시오.

  [분석 및 필터링 지침]
  1. 노이즈 제거: 자료의 앞이나 뒷부분에 나타나는 인사말, 공지사항 등 투자 로직과 관계없는 텍스트는 무시하십시오.
  
  2. 다차원적 규칙 발굴: 단순한 수익성 지표에 그치지 말고, 아래 관점에서 전방위적으로 포착하십시오.
     - 비즈니스 모델: 경제적 해자(Moat), 가격 결정력, 네트워크 효과, 규모의 경제.
     - 성장 모멘텀: 지속 가능한 성장률, 신시장 개척 역량, 제품 혁신 주기.
     - 재무적 건전성: 자율 효율성(ROE/ROIC), 잉여현금흐름(FCF) 창출력, 자산 경량화 여부.
     - 밸류에이션: 기업 성장 단계나 업종 평균 대비 매력적인 가격대 설정 로직.
     - 리스크 통제: 경영진 도덕성, 부채 구조, 규제 리스크 방어 기제.

  3. 맥락 인지적 수치화: 구체적인 수치가 언급될 경우, 이를 모든 기업에 일괄 적용하는지(절대 수칙), 특정 섹터나 조건에만 적용되는지(상대 수칙) 구분하십시오.
     - 섹터 특이성: 해당 지표가 특히 중요한 섹터(예: Tech, Financials 등)를 명시하십시오.
     - 벤치마크 유형: 비교 기준점(분야 평균 대비, 역사적 저점 대비 등)을 명확히 하십시오.
     - 텐베거 징후: 만약 큰 폭의 성장이 기대되는 기업(텐베거)의 특징이 언급된다면 이를 핵심 로직으로 포함하십시오.

  4. 논리적 가중치 산출 (1~5점): '신뢰도 x 영향력' 점수에 따라 부여하십시오.
     - 가중치 5: 결정적 요인. 이 요인이 없으면 투자의 근간이 무너지는 핵심 로직.
     - 가중치 1~2: 보조 지표. 긍정적인 신호 이나 다른 지표와 결합이 필요한 요안.
`;

/**
 * 프롬프트 문자열의 해시를 생성합니다.
 */
function generatePromptHash(prompt: string): string {
  return crypto.createHash('md5').update(prompt).digest('hex');
}

/**
 * DB에 저장된 분석 파편이 있는지 확인합니다.
 */
async function getDBKnowledgeFragment(fileId: string, promptHash: string) {
  return await prisma.knowledgeFragment.findFirst({
    where: { fileId, cachingHash: promptHash }
  });
}

/**
 * 분석 결과를 DB 파편으로 저장합니다.
 */
async function saveDBKnowledgeFragment(file: DriveFileInfo, promptHash: string, summary: string, criteria: any) {
  // 기존 데이터가 있다면 업데이트, 없으면 생성 (upsert는 id가 고정되어야 하므로 delete/create 추천)
  await (prisma as any).knowledgeFragment.deleteMany({
    where: { fileId: file.id, cachingHash: promptHash }
  });

  return await (prisma as any).knowledgeFragment.create({
    data: {
      fileId: file.id,
      fileName: file.name,
      summary: summary || '요약을 생성하지 못했습니다.',
      extractedRules: Array.isArray(criteria) ? criteria : [], // 항시 배열 보장 (Prisma Json 제약 조건)
      cachingHash: promptHash
    }
  });
}

/**
 * AI 모델 호출에 지수 백오프 기반 재시도 로직을 적용합니다.
 */
async function generateContentWithRetry(genAI: any, modelName: string, promptParts: any[], maxRetries = 3): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: promptParts }]
      });
      return result;
    } catch (error: any) {
      lastError = error;
      const statusCode = error?.status || error?.code || 0;
      // 503 (High Demand) 또는 429 (Rate Limit) 에러 시 재시도
      if (statusCode === 503 || statusCode === 429 || statusCode === 500) {
        const delay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s...
        console.warn(`[AI Learning] API Error ${statusCode}. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // 다른 에러는 즉시 중단
    }
  }
  throw lastError;
}

// ─── Global Learning Status (Persistence) ───────────────────────────
interface GlobalLearningStatus {
  isLearning: boolean;
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  startTime: string | null;
  error: string | null;
  message: string | null;
  isCancelled: boolean;
  failedDetails: { fileName: string; reason: string }[];
}

declare global {
  // eslint-disable-next-line no-var
  var learningStatus: GlobalLearningStatus | undefined;
}

export const learningStatus = globalThis.learningStatus || {
  isLearning: false,
  totalFiles: 0,
  completedFiles: 0,
  failedFiles: 0,
  startTime: null,
  error: null,
  message: null,
  isCancelled: false,
  failedDetails: []
};
globalThis.learningStatus = learningStatus;

export function resetLearningStatus(total: number) {
  learningStatus.isLearning = true;
  learningStatus.totalFiles = total;
  learningStatus.completedFiles = 0;
  learningStatus.failedFiles = 0;
  learningStatus.startTime = new Date().toISOString();
  learningStatus.error = null;
  learningStatus.message = '학습을 시작합니다...';
  learningStatus.isCancelled = false;
  learningStatus.failedDetails = [];
}

export function stopLearning() {
  learningStatus.isLearning = false;
  learningStatus.isCancelled = true;
  learningStatus.error = '학습이 사용자에 의해 중단되었습니다.';
  learningStatus.message = '중단됨';
}

export const cancelLearningPipeline = stopLearning;

// ─── Learning Pipeline Logic ──────────────────────────────────────────

/**
 * AI 학습 파이프라인 메인 오케스트레이터
 * 여러 파일을 분석하여 하나의 통합된 지식(Investment Rules)을 생성합니다.
 */
export async function runLearningPipeline(
  fileIds?: string[],
  aiModel?: string,
  options?: { forceFullAnalysis?: boolean }
): Promise<LearnedKnowledge> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다 (GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY).');

  const genAI = new GoogleGenAI({ apiKey });
  const modelName = aiModel || 'gemini-1.5-pro';
  console.log(`[AI Learning] Starting pipeline with model: ${modelName}`);
  learningStatus.message = '구글 드라이브 파일 목록 분석 중... (이 단계는 파일 갯수에 따라 수 분이 소요될 수 있습니다)';

  // 1. 대상 파일 식별
  let driveFiles: DriveFileInfo[] = [];
  if (fileIds && fileIds.length > 0) {
    const { getFilesByIds } = await import('@/lib/google-drive');
    driveFiles = await getFilesByIds(fileIds);
  } else {
    // ID가 없으면 연구 폴더 전체 스캔
    const syncResult = await listDriveFiles(undefined, 0, () => learningStatus.isCancelled);
    driveFiles = syncResult.files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
  }

  if (learningStatus.isCancelled) throw new Error('STOPPED_BY_USER');
  resetLearningStatus(driveFiles.length);

  const fileAnalyses: FileAnalysis[] = [];
  const knowledgeFragments: any[] = [];

  try {
    // 2. 개별 파일 분석 및 핵심 인사이트 추출
    const promptHash = generatePromptHash(INDIVIDUAL_ANALYSIS_PROMPT_TEMPLATE);

    const CHUNK_SIZE = 10;
    for (let i = 0; i < driveFiles.length; i += CHUNK_SIZE) {
      if (learningStatus.isCancelled) break;
      const chunk = driveFiles.slice(i, i + CHUNK_SIZE);

      await Promise.all(chunk.map(async (file) => {
        try {
          const currentIdx = i + chunk.indexOf(file) + 1;

          // 1. DB 파편 확인 (강제 전체 분석이 아닌 경우에만)
          const existingFragment = options?.forceFullAnalysis ? null : await getDBKnowledgeFragment(file.id, promptHash);

          if (existingFragment) {
            console.log(`[AI Learning] [${currentIdx}/${learningStatus.totalFiles}] Found in DB: ${file.name}`);
            fileAnalyses.push({
              fileName: file.name,
              fileId: file.id,
              keyConditions: [], // Fragment에는 keyConditions가 요약으로 녹아있음
              extractedAt: existingFragment.learnedAt
            });
            knowledgeFragments.push({
              fileName: file.name,
              summary: existingFragment.summary,
              extractedRules: existingFragment.extractedRules as any
            });
            learningStatus.completedFiles++;
            return;
          }

          console.log(`[AI Learning] [${currentIdx}/${learningStatus.totalFiles}] Analyzing (New): ${file.name}`);
          learningStatus.message = `${file.name} 추출 중... (${currentIdx}/${learningStatus.totalFiles})`;

          const content = await extractFileContent(file);
          if (!content || content.trim().length === 0) {
            learningStatus.failedFiles++;
            learningStatus.failedDetails.push({ fileName: file.name, reason: '내용 없음' });
            return;
          }

          // 2. 실제 분석 수행
          const analysis = await analyzeIndividualFile(genAI, modelName, file, content);

          const knowledgeFragment = {
            fileName: file.name,
            summary: analysis.summary,
            extractedRules: analysis.rawCriteria
          };

          // DB에 개별 파편 저장
          await saveDBKnowledgeFragment(file, promptHash, analysis.summary, analysis.rawCriteria);

          fileAnalyses.push(analysis.fileAnalysis);
          knowledgeFragments.push(knowledgeFragment);

          learningStatus.completedFiles++;
        } catch (error: any) {
          console.error(`Error analyzing file ${file.name}:`, error);
          learningStatus.failedFiles++;
          learningStatus.failedDetails.push({ fileName: file.name, reason: error?.message || String(error) });
        }
      }));
    }

    if (learningStatus.isCancelled) {
      learningStatus.isLearning = false;
      throw new Error('STOPPED_BY_USER');
    }

    // 3. 종합 학습 전략 수립
    console.log('[AI Learning] Synthesizing investment strategy...');
    learningStatus.message = '종합 투자 전략 수립 중 (계층적 분석 실행)...';
    const finalKnowledge = await synthesizeKnowledge(genAI, modelName, fileAnalyses, knowledgeFragments);

    finalKnowledge.sourceFiles = driveFiles.map(f => f.id);
    finalKnowledge.learnedAt = new Date();
    finalKnowledge.failedFilesCount = learningStatus.failedFiles;
    finalKnowledge.failedDetails = [...learningStatus.failedDetails];

    learningStatus.isLearning = false;
    learningStatus.message = '학습 완료';
    return finalKnowledge;
  } catch (error: any) {
    learningStatus.isLearning = false;
    learningStatus.error = error?.message || '알 수 없는 학습 오류가 발생했습니다.';
    console.error('[AI Learning] Pipeline failed:', error);
    throw error;
  }
}

/**
 * 파일 타입에 맞게 텍스트 내용을 추출합니다.
 */
async function extractFileContent(file: DriveFileInfo): Promise<string> {
  console.log(`[AI Learning] Extracting content from: ${file.name} (${file.mimeType})`);

  try {
    if (file.mimeType === 'application/pdf') {
      const fileBuffer = await downloadDriveFile(file.id, file.name);
      return `BASE64_PDF:${fileBuffer.toString('base64')}`;
    }

    if (file.mimeType.startsWith('text/')) {
      return await downloadTextContent(file.id);
    }

    if (file.mimeType.startsWith('video/') || file.name.endsWith('.mp4')) {
      const fileBuffer = await downloadDriveFile(file.id, file.name);
      return `BASE64_VIDEO:${fileBuffer.toString('base64')}`;
    }
  } catch (error) {
    console.error(`Extraction failed: ${file.name}`, error);
  }

  return '';
}


/**
 * 개별 파일 내용을 분석하여 핵심 지식 파편을 추출합니다.
 */
async function analyzeIndividualFile(genAI: any, modelName: string, file: DriveFileInfo, content: string) {
  const isBase64Pdf = content.startsWith('BASE64_PDF:');
  const isBase64Video = content.startsWith('BASE64_VIDEO:');
  const pdfData = isBase64Pdf ? content.split('BASE64_PDF:')[1] : null;
  const videoData = isBase64Video ? content.split('BASE64_VIDEO:')[1] : null;
  const textContent = (isBase64Pdf || isBase64Video) ? "" : content.substring(0, 100000);

  const prompt = `
    당신은 전설적인 주식 투자자들의 논리를 학습하고 데이터에서 초과 수익의 원천(Alpha)을 발굴하는 수석 데이터 과학자입니다. 
    제공된 자료에서 '훌륭한 기업을 찾는 기준'과 '매수 타이밍/패턴'을 정밀하게 추출하고 고도의 '투자 알고리즘'으로 변환하십시오.

    파일명: ${file.name}
    ${isBase64Pdf ? "[안내] 이 파일은 PDF 형식 문서입니다. 첨부된 문서를 직접 분석하여 내용을 파악하십시오." :
      isBase64Video ? "[안내] 이 파일은 동영상 형식입니다. 첨부된 영상과 오디오를 직접 분석하여 핵심 내용을 파악하십시오." :
        `내용 자료 (최대 100k 자):\n${textContent}`}

    [분석 및 필터링 지침]
    1. 노이즈 제거: 자료의 앞이나 뒷부분에 나타나는 인사말, 공지사항 등 투자 로직과 관계없는 텍스트는 무시하십시오.
    
    2. 다차원적 규칙 발굴: 단순한 수익성 지표에 그치지 말고, 아래 관점에서 전방위적으로 포착하십시오.
       - 비즈니스 모델: 경제적 해자(Moat), 가격 결정력, 네트워크 효과, 규모의 경제.
       - 성장 모멘텀: 지속 가능한 성장률, 신시장 개척 역량, 제품 혁신 주기.
       - 재무적 건전성: 자율 효율성(ROE/ROIC), 잉여현금흐름(FCF) 창출력, 자산 경량화 여부.
       - 밸류에이션: 기업 성장 단계나 업종 평균 대비 매력적인 가격대 설정 로직.
       - 리스크 통제: 경영진 도덕성, 부채 구조, 규제 리스크 방어 기제.

    3. 맥락 인지적 수치화: 구체적인 수치가 언급될 경우, 이를 모든 기업에 일괄 적용하는지(절대 수칙), 특정 섹터나 조건에만 적용되는지(상대 수칙) 구분하십시오.
       - 섹터 특이성: 해당 지표가 특히 중요한 섹터(예: Tech, Financials 등)를 명시하십시오.
       - 벤치마크 유형: 비교 기준점(분야 평균 대비, 역사적 저점 대비 등)을 명확히 하십시오.
       - 텐베거 징후: 만약 큰 폭의 성장이 기대되는 기업(텐베거)의 특징이 언급된다면 이를 핵심 로직으로 포함하십시오.

    4. 논리적 가중치 산출 (1~5점): '신뢰도 x 영향력' 점수에 따라 부여하십시오.
       - 가중치 5: 결정적 요인. 이 요인이 없으면 투자의 근간이 무너지는 핵심 로직.
       - 가중치 1~2: 보조 지표. 긍정적인 신호이나 다른 지표와 결합이 필요한 요인.

    결과는 반드시 유효한 JSON 형식으로만 답변하십시오:
    {
      "summary": "자료의 핵심 투자 철학 요약",
      "keyConditions": ["추출된 핵심 조건 1", "핵심 조건 2"],
      "criteria": [
        {
          "name": "규칙 이름",
          "category": "수익성/성장성/해자/섹터특화 등",
          "description": "규칙의 상세 설명 (노이즈가 섞이지 않은 핵심 논리)",
          "quantification": {
            "target_metric": "대상 지표명 (영어)",
            "benchmark_type": "absolute / sector_relative / sector_percentile",
            "condition": "> / < / >= / <= / ==",
            "value": "적용할 수치 또는 설명"
          },
          "targetSectors": ["Technology", "Industrial" 등 관련 섹터 목록, 범용이면 ["General"]],
          "applicableContexts": ["Growth Phase", "Recession" 등 상황],
          "weight": 1~5 사이 가중치,
          "weightRationale": "이 가중치를 부여한 논리적 근거",
          "isCritical": boolean (핵심 킬러 지표 여부)
        }
      ]
    }
  `;

  const parts: any[] = [{ text: prompt }];

  if (isBase64Pdf && pdfData) {
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfData
      }
    });
  } else if (isBase64Video && videoData) {
    parts.push({
      inlineData: {
        mimeType: 'video/mp4',
        data: videoData
      }
    });
  } else if (textContent) {
    parts.push({ text: textContent });
  }

  const result = await generateContentWithRetry(
    genAI,
    modelName,
    parts
  );

  const text = (result as any).text || '';
  const parsed = robustJsonParse(text);

  // AI가 필드명을 다르게 줄 경우를 대비한 유연한 맵핑 (criteria, criterias, rules, extractedRules 등)
  const rawCriteria = parsed.criteria || parsed.criterias || parsed.rules || parsed.extractedRules || [];

  const fileAnalysis: FileAnalysis = {
    fileName: file.name,
    fileId: file.id,
    keyConditions: [],
    extractedAt: new Date()
  };

  return {
    fileAnalysis,
    summary: parsed.summary || '요약 없음',
    rawCriteria: Array.isArray(rawCriteria) ? rawCriteria : [] // 반드시 배열 형태 유지
  };
}

/**
 * 카테고리별 병렬 합성 (Category-Aware Parallel Synthesis)
 *
 * [전략]
 * 936개 규칙을 5개 투자 카테고리로 분류한 뒤, 각 카테고리 내에서 독립적으로 핵심 규칙을 추려냅니다.
 * - 입력: 카테고리당 평균 ~187개 규칙 (Gemini 1M 입력 컨텍스트로 충분)
 * - 출력: 카테고리당 4개 규칙 (~2,000자, 출력 토큰 한계 내)
 * - 최종: 5 카테고리 × 4개 = ~20개 규칙 → 최종 합성 (~10,000자 입력, ~8,000자 출력 → 안전)
 */
async function synthesizeKnowledge(genAI: any, modelName: string, analyses: FileAnalysis[], fragments: any[]): Promise<LearnedKnowledge> {
  // ── Step 0: 파편에서 순수 규칙 배열 평탄화 ──────────────────────────
  const flatRules: any[] = fragments.flatMap(f =>
    Array.isArray(f.extractedRules) ? f.extractedRules : []
  );
  console.log(`[AI Learning] Total flat rules for synthesis: ${flatRules.length}`);

  // ── Step 1: 카테고리별 그룹화 ────────────────────────────────────────
  const CATEGORIES = ['수익성장성', '영업효율성', '밸류에이션', '재무건전성', '시장변동성대응'];
  const grouped: Record<string, any[]> = {};
  for (const cat of CATEGORIES) grouped[cat] = [];
  grouped['기타'] = [];

  for (const rule of flatRules) {
    const cat = rule.category?.trim();
    if (cat && grouped[cat]) {
      grouped[cat].push(rule);
    } else {
      // 카테고리명이 약간 다르게 왔을 경우 유사 매핑
      const matched = CATEGORIES.find(c => cat?.includes(c) || c.includes(cat || ''));
      if (matched) grouped[matched].push(rule);
      else grouped['기타'].push(rule);
    }
  }

  for (const [cat, rules] of Object.entries(grouped)) {
    console.log(`[AI Learning] Category "${cat}": ${rules.length} rules`);
  }

  // ── Step 2: 카테고리별 독립 압축 (병렬 실행) ─────────────────────────
  // 각 카테고리에서 최대 4개의 핵심 규칙 추출
  // 출력 크기: 4 rules × ~500자 = ~2,000자 → 출력 토큰 한계 내 (안전)
  const RULES_PER_CATEGORY = 4;

  const categoryPromise = async (category: string, rules: any[]): Promise<any[]> => {
    if (rules.length === 0) return [];

    const prompt = `
당신은 투자 전략 전문가입니다. 아래는 "${category}" 카테고리에 속하는 투자 규칙 ${rules.length}개입니다.
이 중 가장 핵심적이고 실전에서 검증된 규칙 최대 ${RULES_PER_CATEGORY}개만 선별하여 응답하십시오.

[선별 기준]
1. weight가 높을수록 우선
2. 여러 원천에서 반복 등장하는 규칙 우선
3. 정량화(quantification)가 명확한 규칙 우선
4. 중복되는 규칙은 하나로 통합하여 description을 더 풍부하게 만드십시오

[필수] 각 규칙은 반드시 아래 필드를 모두 포함해야 합니다:
name(string), category(string), weight(1~5 숫자), description(한국어 string),
applicableContexts(string[] — bull_market/recession/high_inflation/high_interest/pivot_expected/low_vix 중 택일),
targetSectors(string[] 영어, 없으면 []), isGeneral(boolean), quantification(object 또는 null), isCritical(boolean)

결과는 반드시 유효한 JSON으로만 답변하십시오 (설명 없이 { 로 시작):
{ "rules": [ ...최대 ${RULES_PER_CATEGORY}개 규칙 배열... ] }

[입력 규칙 (${rules.length}개)]
${JSON.stringify(rules)}
    `;

    try {
      const result = await generateContentWithRetry(genAI, modelName, [{ text: prompt }]);
      const parsed = robustJsonParse((result as any).text || '');
      const selectedRules = parsed.rules || parsed.summarizedRules || parsed.criterias || [];
      console.log(`[AI Learning] Category "${category}": ${rules.length} → ${selectedRules.length} rules selected`);
      return Array.isArray(selectedRules) ? selectedRules : [];
    } catch (err) {
      console.warn(`[AI Learning] Category "${category}" synthesis failed, using top-weight fallback:`, err);
      // 실패 시 weight 기준 상위 N개를 fallback으로 사용
      return rules
        .sort((a, b) => (b.weight || 0) - (a.weight || 0))
        .slice(0, RULES_PER_CATEGORY);
    }
  };

  // 카테고리별 병렬 압축 실행
  const categoryEntries = Object.entries(grouped);
  const categoryResults = await Promise.all(
    categoryEntries.map(([cat, rules]) => categoryPromise(cat, rules))
  );

  // 결과 수집: 최대 5 카테고리 × 4개 + 기타 4개 = 최대 24개
  const compressedRules: any[] = categoryResults.flat();
  console.log(`[AI Learning] After category compression: ${compressedRules.length} rules total`);

  // ── Step 3: 최종 마스터 합성 ──────────────────────────────────────────
  // 입력: ~20개 규칙 × 500자 = ~10,000자 (안전)
  // 출력: 전체 JSON ~15,000자 ≈ 3,750 토큰 (8k 한계의 절반 이하 — 안전)
  const synthesisPrompt = `
당신의 목표는 카테고리별로 선별된 투자 규칙들을 최종 정리하여 'Alpha Intelligence RuleSet'을 완성하는 것입니다.

[제공된 카테고리별 핵심 규칙 (${compressedRules.length}개)]
${JSON.stringify(compressedRules)}

[작업 목표]
1. 중복 제거: 카테고리 간 유사 규칙이 있다면 통합하십시오.
2. 합의 점수 산출: 0~100 사이 숫자로 consensusScore를 산출하십시오 (자료 간 일관성이 높을수록 고점수).
3. 전략 유형 판단: aggressive / moderate / stable 중 하나를 선택하십시오.
4. 핵심 요약: keyConditionsSummary를 300자 내외 한국어로 작성하십시오.
5. 핵심 원칙: principles를 3~5개 작성하십시오.
6. 언어: 모든 텍스트는 반드시 한국어로 작성하십시오.

[지원 가능 정량 지표]
revenue_growth, net_income_growth, roe, per, pbr, debt_ratio, operating_margin, dividend_yield, market_cap, vix, yields, dxy

[필수 출력 형식] 설명 텍스트 없이 { 로 시작해서 } 로 끝내십시오.
각 criteria 규칙에는 반드시 name, category, weight(1~5), description, applicableContexts([]), targetSectors([]), isGeneral(bool), quantification(object|null), isCritical(bool) 포함.

{
  "criteria": {
    "criterias": [ ...규칙 배열 (중복 제거 후)... ],
    "principles": [ { "principle": "핵심 원칙", "category": "general" } ]
  },
  "strategy": {
    "shortTermConditions": [],
    "longTermConditions": [],
    "winningPatterns": [],
    "riskManagementRules": []
  },
  "keyConditionsSummary": "300자 내외 한국어 요약",
  "strategyType": "aggressive",
  "consensusScore": 85
}
  `;

  const result = await generateContentWithRetry(genAI, modelName, [{ text: synthesisPrompt }]);
  const parsed = robustJsonParse((result as any).text || '');

  // UI가 기대하는 정확한 구조로 정규화
  const rawCriterias = parsed.criteria?.criterias || parsed.criterias || parsed.criteria || [];
  const normalizedCriterias = Array.isArray(rawCriterias) ? rawCriterias : [];
  const normalizedPrinciples = parsed.criteria?.principles || parsed.principles || [];

  const normalizedCriteria = {
    criterias: normalizedCriterias,
    principles: Array.isArray(normalizedPrinciples) ? normalizedPrinciples : []
  };

  console.log(`[AI Learning] Synthesis complete: ${normalizedCriterias.length} rules, consensusScore: ${parsed.consensusScore}`);

  return {
    fileAnalyses: analyses,
    criteria: normalizedCriteria,
    strategy: parsed.strategy || { shortTermConditions: [], longTermConditions: [], winningPatterns: [], riskManagementRules: [] },
    strategyType: parsed.strategyType || 'moderate',
    consensusScore: Number(parsed.consensusScore) || 0,
    keyConditionsSummary: parsed.keyConditionsSummary || '',
    rawSummaries: fragments.map(f => ({ fileName: f.fileName, summary: f.summary })),
    learnedAt: new Date(),
    sourceFiles: []
  };
}

/**
 * 텍스트에서 JSON을 안전하게 추출하고 파싱합니다.
 * AI가 응답 중 누락된 콤마, 트레일링 콤마, 혹은 구조를 망가뜨리는 텍스트를 포함할 경우 이를 보정합니다.
 */
function robustJsonParse(text: string): any {
  if (!text || text.trim().length === 0) throw new Error('응답 내용이 비어있습니다.');

  // 1. JSON 후보 추출 (가장 바깥쪽 { } 찾기)
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('AI 답변에서 유효한 JSON 구조를 찾을 수 없습니다.');
  }

  let jsonStr = text.substring(firstBrace, lastBrace + 1);

  // 2. 기본 파싱 시도
  try {
    return JSON.parse(jsonStr);
  } catch (initialError) {
    console.warn('[robustJsonParse] Initial parse failed, attempting structural repairs...');

    try {
      // 3. 단계별 보정
      let repaired = jsonStr
        .replace(/,\s*([\}\]])/g, '$1')           // 트레일링 콤마 제거 ( ,} -> } )
        .replace(/(\})\s*(\{)/g, '$1,$2')         // 객체 사이 누락된 콤마 삽입 ( } { -> },{ )
        .replace(/(\])\s*(\[)/g, '$1,$2')         // 배열 사이 누락된 콤마 삽입 ( ] [ -> ],[ )
        .replace(/(\d+)\s+(\d+)/g, '$1,$2')       // 숫자 사이 누락된 콤마 ( [1 2] -> [1,2] )
        .replace(/\"(\s*):(\s*)\"/g, '":"')       // 잘못된 따옴표 보정
        .replace(/\\n/g, ' ')                     // 문자열 내 줄바꿈 제거
        .replace(/\n/g, ' ');                     // 실제 줄바꿈 제거

      return JSON.parse(repaired);
    } catch (repairError) {
      console.warn('[robustJsonParse] Repair attempt failed, trying aggressive balancing/backtracking...');

      /**
       * 4. Dangling Key 제거 + 괄호 밸런싱 + 역추적
       *
       * "isCritical": 처럼 키는 있고 값이 없는 상태(dangling key-value)로 잘린 경우,
       * 단순 괄호 닫기로는 유효한 JSON을 만들 수 없으므로
       * 먼저 불완전한 끝부분을 제거한 뒤 닫기를 시도합니다.
       */
      function tryBalance(s: string): any | null {
        // 4a. 끝의 dangling key-colon 제거:
        //   - "key": <불완전한 값>  → 해당 쌍 전체 제거
        //   - 처리 순서: 후행 콤마/공백 포함 제거
        let trimmed = s
          // "key": "incomplete  (열린 문자열)
          .replace(/,?\s*"[^"]*"\s*:\s*"[^"]*$/, '')
          // "key": [ 또는 "key": { (값 일부)
          .replace(/,?\s*"[^"]*"\s*:\s*[\[{][^}\]]*$/, '')
          // "key": (값 자체가 없음)
          .replace(/,?\s*"[^"]*"\s*:\s*$/, '')
          // "key": 123 (불완전 숫자)
          .replace(/,?\s*"[^"]*"\s*:\s*\d+$/, '')
          // 끝의 고아 콤마 제거
          .replace(/,\s*$/, '');

        // 4b. 괄호 수 맞추기
        const ob = (trimmed.match(/\{/g) || []).length;
        const cb = (trimmed.match(/\}/g) || []).length;
        const oB = (trimmed.match(/\[/g) || []).length;
        const cB = (trimmed.match(/\]/g) || []).length;
        trimmed += '}'.repeat(Math.max(0, ob - cb));
        trimmed += ']'.repeat(Math.max(0, oB - cB));

        try { return JSON.parse(trimmed); } catch { return null; }
      }

      // 먼저 현재 jsonStr 전체에 적용
      const directResult = tryBalance(jsonStr);
      if (directResult !== null) return directResult;

      // 역추적: 끝에서부터 } / ] 를 기점으로 잘라가며 시도
      for (let i = jsonStr.length - 1; i > 0; i--) {
        if (jsonStr[i] === '}' || jsonStr[i] === ']') {
          const candidate = jsonStr.substring(0, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            const balanced = tryBalance(candidate);
            if (balanced !== null) return balanced;
          }
        }
      }

      // 모든 시도 실패 시 주변 텍스트 로깅 (디버깅용)
      const errorPos = (repairError as any).message?.match(/at position (\d+)/)?.[1];
      if (errorPos) {
        const pos = parseInt(errorPos);
        console.error('[robustJsonParse] Failure context:', jsonStr.substring(Math.max(0, pos - 80), Math.min(jsonStr.length, pos + 80)));
      }
      throw repairError;
    }
  }
}

/**
 * 학습된 지식을 데이터베이스에 저장하고 이전 지식을 비활성화합니다.
 */
export async function saveKnowledgeToDB(knowledge: LearnedKnowledge, title?: string): Promise<string> {
  // 1. 기존 활성 지식 비활성화
  await prisma.learnedKnowledge.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });

  // 2. 새 지식 저장
  const record = await prisma.learnedKnowledge.create({
    data: {
      title: title || `AI Strategy - ${new Date().toLocaleDateString()}`,
      content: knowledge as any,
      isActive: true
    }
  });

  return record.id;
}

/**
 * 현재 활성화된 지식을 가져옵니다.
 */
export async function getLearnedKnowledge(): Promise<LearnedKnowledge | null> {
  const active = await prisma.learnedKnowledge.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!active) return null;
  return active.content as unknown as LearnedKnowledge;
}
