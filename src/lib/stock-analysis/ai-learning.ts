import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { callWithModelFallback, is429Error, isBillingError, isFatalModelError } from '@/lib/utils/retry';
import { prisma } from '@/lib/db';
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
import { quotaTracker } from '@/lib/utils/quota-manager';

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
async function executeAiCall(model: string, parts: any[]): Promise<string> {
    const mLower = model.toLowerCase();
    const mainText = parts.find(p => p.text)?.text || '';

    if (mLower.includes('gpt-') || mLower.includes('o1-')) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: mainText }],
            response_format: mLower.includes('o1-') ? undefined : { type: 'json_object' }
        });
        return res.choices[0].message.content || '';
    } else if (mLower.includes('claude-')) {
        const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
        const res = await anthropic.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: mainText }]
        });
        return (res.content[0] as any).text || '';
    } else {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenAI({ apiKey: apiKey! });
        
        // 중복 재시도 루프 제거 (callWithModelFallback의 withRetry에서 이미 처리함)
        const result = await genAI.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: parts }]
        });
        return (result as any).text || '';
    }
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
 * 파일의 메타데이터를 기반으로 예상 토큰 수를 계산합니다.
 */
function estimateFileTokens(file: DriveFileInfo): number {
  const sizeBytes = parseInt(file.size || '0');
  const sizeMB = sizeBytes / (1024 * 1024);

  if (file.mimeType.startsWith('video/') || file.name.endsWith('.mp4')) {
    // 동영상은 1MB당 약 10만 토큰으로 넉넉하게 추정 (안전 마진)
    return Math.max(50000, Math.floor(sizeMB * 100000));
  }
  
  if (file.mimeType === 'application/pdf') {
    // PDF는 1MB당 약 5만 토큰 추정
    return Math.max(10000, Math.floor(sizeMB * 50000));
  }

  // 텍스트/기타: 바이트 수 기반
  return Math.max(1000, Math.floor(sizeBytes / 4));
}

/**
 * AI 학습 파이프라인 메인 오케스트레이터
 * 여러 파일을 분석하여 하나의 통합된 지식(Investment Rules)을 생성합니다.
 */
export async function runLearningPipeline(
  fileIds?: string[],
  aiModel?: string,
  options?: { forceFullAnalysis?: boolean; fallbackAiModel?: string }
): Promise<LearnedKnowledge> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다 (GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY).');

  const genAI = new GoogleGenAI({ apiKey });
  const modelName = aiModel || 'gemini-3.1-flash-lite';
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

    const CHUNK_SIZE = 5; // 한도가 넉넉할 경우 속도를 높이기 위해 5로 확대
    for (let i = 0; i < driveFiles.length; i += CHUNK_SIZE) {
      if (learningStatus.isCancelled) break;
      const chunk = driveFiles.slice(i, i + CHUNK_SIZE);

      // [할당량 체크] 청크 내 모든 파일의 예상 토큰 합산하여 한도 확인
      const chunkTokens = chunk.reduce((sum, f) => sum + estimateFileTokens(f), 0);
      
      const isWaitStarted = (quotaTracker as any).lastMinuteTokens > 0;
      
      // 할당량 상태 확인 (대기 전)
      const currentQuota = quotaTracker.getQuotaStatus(modelName, chunkTokens);
      
      try {
        await quotaTracker.waitIfNecessary(modelName, chunkTokens);
      } catch (err) {
        // ignore wait errors
      }
      
      // 만약 대기가 발생했다면 로그 및 상태 메시지 남김
      if (isWaitStarted && (quotaTracker as any).lastMinuteRequests >= 1) {
        const waitMsg = `[할당량 조절] ${currentQuota} 소모로 인해 잠시 대기 중...`;
        console.log(`[AI Learning] ${waitMsg}`);
        learningStatus.message = waitMsg;
      }

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
          const analysis = await analyzeIndividualFile(modelName, file, content, options?.fallbackAiModel);

          if (!analysis) throw new Error('분석 결과가 없습니다.');

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
          
          // [핵심] 1, 2순위 모델 모두 한도 초과이거나 치명적 오류인 경우 전체 파이프라인 중단
          if (is429Error(error) || isBillingError(error) || isFatalModelError(error)) {
            console.error(`[AI Learning] Fatal pipeline error detected while analyzing ${file.name}. Stopping all processes.`);
            throw error; // Promise.all을 즉시 실패시키고 전체 try-catch로 전파
          }

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
    const finalKnowledge = await synthesizeKnowledge(modelName, fileAnalyses, knowledgeFragments, options?.fallbackAiModel);

    finalKnowledge.sourceFiles = driveFiles.map(f => f.id);
    finalKnowledge.learnedAt = new Date();
    finalKnowledge.failedFilesCount = learningStatus.failedFiles;
    finalKnowledge.failedDetails = [...learningStatus.failedDetails];

    learningStatus.isLearning = false;
    learningStatus.message = '학습 완료';

    console.log('[AI Learning] Extraction and Synthesis complete. Returning for user tuning.');
    learningStatus.message = '원천 데이터 분석 완료. 2단계에서 지표별 비중을 설정해주세요.';
    
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
  console.log(`[AI Learning] Checking content for: ${file.name} (${file.mimeType})`);

  try {
    // 텍스트 계열은 즉시 다운로드하여 텍스트로 반환
    if (file.mimeType.startsWith('text/') || file.mimeType === 'application/vnd.google-apps.document') {
      return await downloadTextContent(file.id);
    }
    
    // PDF나 비디오는 analyzeIndividualFile에서 직접 처리하도록 메타 정보만 유지
    // 용량이 작으면 이 단계에서 base64 변환도 가능하지만, 안정성을 위해 직접 처리를 선호
    const sizeMB = parseInt(file.size || '0') / (1024 * 1024);
    if (file.mimeType === 'application/pdf' && sizeMB < 5) {
      const buffer = await downloadDriveFile(file.id, file.name);
      return `BASE64_PDF:${buffer.toString('base64')}`;
    }
    
    return `FILE_ID:${file.id}`; // 대용량/비디오는 ID만 전달하여 후속 단계에서 처리
  } catch (error) {
    console.error(`Status check failed: ${file.name}`, error);
  }

  return '';
}

/**
 * 개별 파일 분석 및 핵심 인사이트 추출
 * 대용량 파일(10MB+)이나 동영상은 Gemini File API를 사용하여 안정적으로 분석합니다.
 */
async function analyzeIndividualFile(
  modelName: string,
  file: DriveFileInfo,
  content: string,
  fallbackModel?: string
): Promise<AnalysisResult | null> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');

  const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
  
  const isVideo = file.mimeType.startsWith('video/') || file.name.endsWith('.mp4');
  const sizeMB = parseInt(file.size || '0') / (1024 * 1024);
  const isLargeFile = sizeMB > 5;
  
  const hasBase64Content = content.startsWith('BASE64_PDF:');
  const actualBase64 = hasBase64Content ? content.replace('BASE64_PDF:', '') : '';

  return await callWithModelFallback(
    modelName,
    fallbackModel,
    async (m) => {
      let parts: any[] = [{ text: INDIVIDUAL_ANALYSIS_PROMPT_TEMPLATE.replace('{{fileName}}', file.name) }];
      let uploadedFile: any = null;
      let tempFilePath: string | null = null;

      try {
        if (isVideo || isLargeFile) {
          console.log(`[AI Learning] Using File API mode for: ${file.name} (${sizeMB.toFixed(1)}MB)`);
          
          const buffer = await downloadDriveFile(file.id, file.name);
          const tempDir = path.join(process.cwd(), '.temp/uploads');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          
          const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_');
          tempFilePath = path.join(tempDir, `${file.id}_${safeFileName}`);
          fs.writeFileSync(tempFilePath, buffer);

          // Next Gen SDK: genAI.files.upload({ file, config })
          uploadedFile = await genAI.files.upload({
            file: tempFilePath,
            config: {
              mimeType: file.mimeType || (isVideo ? 'video/mp4' : 'application/pdf'),
              displayName: file.name,
            }
          });

          // Next Gen SDK: genAI.files.get({ name })
          let currentFile = await genAI.files.get({ name: uploadedFile.name });
          while (currentFile.state === 'PROCESSING') {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            currentFile = await genAI.files.get({ name: uploadedFile.name });
          }

          if (currentFile.state === 'FAILED') throw new Error(`AI File processing failed: ${file.name}`);
          parts.push({ fileData: { mimeType: currentFile.mimeType, fileUri: currentFile.uri } });
        } else {
          if (actualBase64) {
            parts.push({ inlineData: { data: actualBase64, mimeType: 'application/pdf' } });
          } else if (content && !content.startsWith('FILE_ID:')) {
            parts.push({ inlineData: { data: Buffer.from(content).toString('base64'), mimeType: file.mimeType || 'text/plain' } });
          }
        }

        // Next Gen SDK: Direct call via genAI.models.generateContent
        const result = await genAI.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts }]
        });

        // Next Gen SDK: Use result.text property (getter)
        const responseText = result.text || '';
        const parsed = parseIndividualAnalysis(responseText, file.name);
        
        // metadata를 결과 객체에 첨부하여 retry.ts에서 읽을 수 있게 함
        return {
          ...parsed,
          usageMetadata: result.usageMetadata
        };

      } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
        if (uploadedFile) {
          try {
            await genAI.files.delete({ name: uploadedFile.name });
            console.log(`[AI Learning] Cleaning up: AI Studio quota freed for ${file.name}`);
          } catch (e) {
            console.warn(`[AI Learning] Cleanup failed for ${file.name}: ${e}`);
          }
        }
      }
    }
  );
}

/**
 * AI의 개별 파일 분석 결과를 파싱하여 구조화된 데이터로 변환합니다.
 */
function parseIndividualAnalysis(text: string, fileName: string): any {
  try {
    const parsed = robustJsonParse(text);
    
    // 구조 정규화
    const rawCriteria = parsed.extractedRules || parsed.criteria || parsed.rules || [];
    const summary = parsed.summary || parsed.analysisSummary || '요약을 생성하지 못했습니다.';
    
    return {
      summary,
      rawCriteria: Array.isArray(rawCriteria) ? rawCriteria : [],
      fileAnalysis: {
        fileName: fileName,
        fileId: '', // 호출측에서 보완
        keyConditions: [],
        extractedAt: new Date()
      }
    };
  } catch (error) {
    console.error(`[AI Learning] 파싱 실패 (${fileName}):`, error);
    // 최소한의 구조로 반환하여 파이프라인 유지
    return {
      summary: '데이터 파싱 중 오류가 발생했습니다.',
      rawCriteria: [],
      fileAnalysis: {
        fileName: fileName,
        fileId: '',
        keyConditions: [],
        extractedAt: new Date()
      }
    };
  }
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
async function synthesizeKnowledge(modelName: string, analyses: FileAnalysis[], fragments: any[], fallbackModel?: string): Promise<LearnedKnowledge> {
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
  const RULES_PER_CATEGORY = 12; // 4에서 12로 대폭 확대 (사용자 요청: 추출 범위 확대)

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
5. **weightRationale 작성**: 왜 해당 규칙에 특정 가중치(1~5)를 부여했는지 원천 데이터의 맥락을 바탕으로 구체적인 근거를 작성하십시오.

[필수] 각 규칙은 반드시 아래 필드를 모두 포함해야 합니다:
name(string), category(string), weight(1~5 숫자), weightRationale(한국어 string), description(한국어 string),
applicableContexts(string[] — bull_market/recession/high_inflation/high_interest/pivot_expected/low_vix 중 택일),
targetSectors(string[] 영어, 없으면 []), isGeneral(boolean), quantification(object 또는 null), isCritical(boolean)

결과는 반드시 유효한 JSON으로만 답변하십시오 (설명 없이 { 로 시작):
{ "rules": [ ...최대 ${RULES_PER_CATEGORY}개 규칙 배열... ] }

[입력 규칙 (${rules.length}개)]
${JSON.stringify(rules)}
    `;

    try {
      const text = await callWithModelFallback(modelName, fallbackModel, async (m) => {
        return await executeAiCall(m, [{ text: prompt }]);
      });
      const parsed = robustJsonParse(text);
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

[핵심 작업 지침 - 매우 중요]
1. 보존 우선 원칙: 서로 다른 논리를 가진 규칙이라면 절대로 하나로 합치거나 생략하지 마십시오. 가능한 한 많은 고유 규칙(최대 50개까지)을 결과에 포함하십시오. 사용자는 정보의 양보다 정밀도와 다양성을 원합니다.
2. 중복 제거: 완벽하게 동일한 지표와 조건을 가진 경우에만 통합하십시오.
3. 합의 점수 산출: 0~100 사이 숫자로 consensusScore를 산출하십시오 (자료 간 일관성이 높을수록 고점수).
4. 전략 유형 판단: aggressive / moderate / stable 중 하나를 선택하십시오.
6. **핵심 투자 원칙(Principles) 수립**: 전체 전략을 관통하는 5~7개의 핵심 원칙을 별도로 도출하십시오. 이는 'criterias'보다 상위 수준의 투자 철학이어야 합니다.
7. **weightRationale 작성**: 각 규칙별로 AI가 추천하는 가중치의 구체적 근거를 'weightRationale' 필드에 작성하십시오.
8. 모든 텍스트는 반드시 한국어로 작성하십시오.

[지원 가능 정량 지표]
revenue_growth, net_income_growth, roe, per, pbr, debt_ratio, operating_margin, dividend_yield, market_cap, vix, yields, dxy

[필수 출력 형식] 설명 텍스트 없이 { 로 시작해서 } 로 끝내십시오.
{
  "criteria": {
    "criterias": [
      {
        "name": "규칙 이름",
        "category": "수익성장성/영업효율성/밸류에이션/재무건전성/시장변동성대응",
        "weight": 1~5,
        "weightRationale": "추천 비중 근거",
        "description": "규칙 상세 논리",
        "quantification": { ... },
        "isCritical": boolean
      }
    ],
    "principles": [ 
      { "principle": "핵심 투자 원칙 내용 (한 문장)", "category": "general" } 
    ]
  },
  "strategy": { ... },
  "keyConditionsSummary": "전체 전략에 대한 통합 가이드라인 (서술형)",
  "strategyType": "aggressive / moderate / conservative",
  "consensusScore": 1~100
}
  `;

  const text = await callWithModelFallback(modelName, fallbackModel, async (m) => {
    return await executeAiCall(m, [{ text: synthesisPrompt }]);
  });
  const parsed = robustJsonParse(text);

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
 * [New] 사용자가 설정한 가중치를 바탕으로 지식을 합성합니다.
 */
export async function synthesizeCustomKnowledge(
  weights: Record<string, number>,
  knowledge: LearnedKnowledge,
  aiModel?: string,
  fallbackAiModel?: string
): Promise<LearnedKnowledge> {
  const modelNameForSynthesis = aiModel || 'gemini-1.5-pro';
  const fallbackModel = fallbackAiModel || 'gemini-1.5-flash';

  console.log(`[AI Learning] Starting custom synthesis with model: ${modelNameForSynthesis}...`);

  // 1. 규칙들에 사용자 가중치 주입
  const weightedRules = (knowledge.criteria.criterias || []).map(r => ({
    ...r,
    userWeight: weights[r.name] || r.weight
  }));

  // 2. 가중치가 높은 순서로 정렬하여 AI에게 전달 (중요도 인지)
  const sortedRules = [...weightedRules].sort((a, b) => (b.userWeight || 0) - (a.userWeight || 0));

  // 3. 최종 합성 프롬프트 호출 (기존 synthesizeKnowledge 로직 활용)
  const synthesisPrompt = `
    당신은 투자 전략 전문가입니다. 사용자가 직접 조정한 가중치를 바탕으로 최종 투자 전략을 수립하십시오.
    
    [사용자 설정 규칙 (${sortedRules.length}개 - 가중치 순)]
    ${JSON.stringify(sortedRules)}

    [작업 목표]
    1. 가중치가 높은 규칙들을 중심으로 핵심 투자 로직을 구성하십시오.
    2. keyConditionsSummary를 5문장 내외 한국어로 작성하여 사용자가 무엇을 중점으로 보려고 하는지 요약하십시오.
    3. 모든 텍스트는 한국어로 작성하십시오.

    [필수 출력 형식] JSON 형식
    {
      "criteria": {
        "criterias": [ ...입력된 모든 규칙 보존... ],
        "principles": [ ...핵심 원칙 3~5개... ]
      },
      "strategy": { ... },
      "keyConditionsSummary": "...",
      "strategyType": "aggressive/moderate/stable",
      "consensusScore": 85
    }
    Return ONLY JSON. All explanations and summaries must be in Korean.
  `;

  const text = await callWithModelFallback(
    modelNameForSynthesis,
    fallbackModel,
    async (m) => {
      return await executeAiCall(m, [{ text: synthesisPrompt }]);
    }
  );

  const parsed = robustJsonParse(text);

  return {
    ...knowledge,
    criteria: {
      ...knowledge.criteria,
      criterias: weightedRules,
      principles: parsed.criteria?.principles || []
    },
    strategy: parsed.strategy || knowledge.strategy,
    strategyType: parsed.strategyType || 'moderate',
    consensusScore: Number(parsed.consensusScore) || 85,
    keyConditionsSummary: parsed.keyConditionsSummary || ''
  };
}
/**
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
