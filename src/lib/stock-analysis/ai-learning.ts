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
  isCancelled: false
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
  aiModels?: Record<string, string>
): Promise<LearnedKnowledge> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다 (GOOGLE_GENERATIVE_AI_API_KEY 또는 GEMINI_API_KEY).');
  
  const genAI = new GoogleGenAI({ apiKey });
  const modelName = aiModels?.전체 || 'gemini-1.5-pro';

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

  // 2. 동시성 제어 (Batch Processing)
  const CHUNK_SIZE = 3;
  for (let i = 0; i < driveFiles.length; i += CHUNK_SIZE) {
    if (learningStatus.isCancelled) break;
    
    const chunk = driveFiles.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async (file) => {
      try {
        const content = await extractFileContent(file);
        if (!content || content.trim().length === 0) {
          console.warn(`[AI Learning] Skipping file (No content): ${file.name}`);
          learningStatus.failedFiles++;
          return;
        }

        // 개별 파일 분석 및 핵심 인사이트 추출
        console.log(`[AI Learning] Analyzing file: ${file.name} (${i + chunk.indexOf(file) + 1}/${learningStatus.totalFiles})`);
        const analysis = await analyzeIndividualFile(genAI, modelName, file, content);
        fileAnalyses.push(analysis.fileAnalysis);
        knowledgeFragments.push({ 
          fileName: file.name, 
          summary: analysis.summary,
          extractedRules: analysis.rawCriteria 
        });
        
        learningStatus.completedFiles++;
        console.log(`[AI Learning] Success: ${file.name}`);
      } catch (error: any) {
        console.error(`Error analyzing file ${file.name}:`, error?.message || error);
        learningStatus.failedFiles++;
      }
    }));
  }

  if (learningStatus.isCancelled) {
    learningStatus.isLearning = false;
    throw new Error('STOPPED_BY_USER');
  }

  // 3. 종합 학습 전략 수립 (지식 파편들을 하나의 일관된 규칙으로 합성)
  console.log('[AI Learning] Synthesizing investment strategy from analyzed fragments...');
  const finalKnowledge = await synthesizeKnowledge(genAI, modelName, fileAnalyses, knowledgeFragments);
  
  // 소스 파일 기록
  finalKnowledge.sourceFiles = driveFiles.map(f => f.id);
  finalKnowledge.learnedAt = new Date();

  learningStatus.isLearning = false;
  return finalKnowledge;
}

/**
 * 파일 타입에 맞게 텍스트 내용을 추출합니다.
 */
async function extractFileContent(file: DriveFileInfo): Promise<string> {
  console.log(`[AI Learning] Extracting content from: ${file.name} (${file.mimeType})`);
  
  try {
    if (file.mimeType === 'application/pdf' || file.mimeType.startsWith('text/')) {
      return await downloadTextContent(file.id);
    } 
    
    if (file.mimeType.startsWith('video/') || file.name.endsWith('.mp4')) {
      const fileBuffer = await downloadDriveFile(file.id, file.name);
      
      // 비디오 처리 서비스 호출
      const videoId = await videoProcessingService.processVideo(fileBuffer, file.name, {
        performStt: true,
        extractAudio: true,
        captureFrames: false // 학습 단계에서는 텍스트 위주로 분석
      });

      // 완료 대기 (최대 5분)
      let attempts = 0;
      while (attempts < 60) {
        const result = videoProcessingService.getProcessingResult(videoId);
        if (result?.status === 'completed' && result.transcript) {
          // segments를 합쳐서 전체 텍스트 생성
          return result.transcript.segments.map(s => s.text).join('\n');
        }
        if (result?.status === 'error') throw new Error(`Video processing failed: ${result.error}`);
        
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
      }
      throw new Error('Video processing timed out');
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
  const prompt = `
    당신은 전설적인 주식 투자자들의 논리를 학습하는 AI입니다. 
    다음 제공된 자료(파일내용)에서 '훌륭한 기업을 찾는 기준'과 '매수 타이밍/패턴'을 추출하세요.

    파일명: ${file.name}
    내용 요약: ${content.substring(0, 15000)}...

    주의사항:
    1. 특정 기업의 고유한 기술(예: 구글 TPU)은 '상기 기업의 핵심 Moat: 수직 계열화 및 공정 효율'과 같은 일반화된 규칙으로 변환하세요.
    2. 정량적 지표가 있다면 반드시 추출하세요 (예: ROE > 15%, 부채비율 < 100%).
    3. 필수 여부(isCritical)를 참/거짓으로 설정하지 말고, 반드시 필요한 기준일수록 높은 가중치(weight)를 주세요. (1~5 사이)
    
    JSON 형식으로만 대답하세요:
    {
      "summary": "자료의 핵심 요약",
      "keyConditions": ["추출된 핵심 조건 1", "핵심 조건 2"],
      "criteria": [
        {
          "name": "규칙 이름",
          "category": "Quality/Value/Growth/Technical 등",
          "description": "규칙의 상세 설명 및 원천 사례",
          "weight": 1~5 사이 가중치,
          "isCritical": false
        }
      ]
    }
  `;

  const result = await genAI.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
  });
  
  const text = (result as any).text || '';
  
  // JSON 추출 (마크다운 가드 제거)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI response as JSON');
  const parsed = JSON.parse(jsonMatch[0]);

  const fileAnalysis: FileAnalysis = {
    fileName: file.name,
    fileId: file.id,
    keyConditions: parsed.keyConditions || [],
    extractedAt: new Date()
  };

  return {
    fileAnalysis,
    summary: parsed.summary,
    rawCriteria: parsed.criteria
  };
}

/**
 * 파편화된 지식들을 하나의 통합된 투자 전략 시스템(LearnedKnowledge)으로 합성합니다.
 */
async function synthesizeKnowledge(genAI: any, modelName: string, analyses: FileAnalysis[], fragments: any[]): Promise<LearnedKnowledge> {
  const synthesisPrompt = `
    당신은 여러 자료에서 추출된 투자 인사이트를 종합하여 하나의 'Alpha Intelligence RuleSet'을 완성하는 수석 분석가입니다.

    [제공된 분석 파편들 (인사이트 및 규칙)]
    ${JSON.stringify(fragments)}

    [작업 목표]
    1. 각 파일에서 추출된 규칙(extractedRules)들을 상호 보완적으로 결합하세요.
    2. 중복된 규칙을 하나로 합칩니다.
    3. 일반화된 규칙 세트를 만듭니다. (특정 기업의 지식인 경우, 보편적인 원칙으로 승화시키되 설명에 예시를 남기세요)
    4. 엔진이 구동할 수 있도록 '정량 지표 매핑'을 수행하세요.
    
    [중요: 지원 가능한 정량 지표 리스트] 
    (이 리스트에 있는 이름만 metric에 사용하세요. 다른 이름을 사용하면 분석 엔진이 인식하지 못합니다)
    - revenue_growth : 매출 성장률 (%)
    - net_income_growth : 순이익 성장률 (%)
    - roe : 자기자본이익률 (%)
    - per : 주가수익비율 (곱)
    - pbr : 주가순자산비율 (곱)
    - debt_ratio : 부채비율 (%)
    - operating_margin : 영업이익률 (%)
    - dividend_yield : 배당수익률 (%)
    - market_cap : 시가총액 (10억 달러 단위, 예: benchmark 10 -> 100억 달러 초과)
    - vix / yields / dxy : 매크로 지표

    JSON 출력 형식 (엄격 준수):
    {
      "criteria": {
        "criterias": [
          {
            "name": "규칙 이름",
            "category": "수익성/성장성/안정성/매크로 등",
            "weight": 가중치(1~5, 필수 조건일수록 높게 배정),
            "description": "일반화된 투자 논리 (예: 'TPU와 같은 독자 하드웨어 역량은 수직 계열화의 핵심임')",
            "quantification": {
              "target_metric": "위에 제공된 정량 지표 리스트 중 하나",
              "condition": "> / < / >= / <=",
              "benchmark": 수치값,
              "benchmark_type": "absolute / sector_relative",
              "scoring_type": "linear / binary"
            },
            "isCritical": false,
            "isGeneral": boolean (특정 업종에만 해당하면 false),
            "targetSectors": ["Technology", "Financial Services" 등. 전체면 빈 배열],
            "applicableContexts": ["bull_market", "recession", "volatility_high" 등. 빈 배열 가능]
          }
        ]
      },
      "strategy": {
        "shortTermConditions": ["매수 시 고려할 단기 조건"],
        "longTermConditions": ["장기 투자 보유 원칙"],
        "winningPatterns": ["자료에서 공통적으로 나타나는 승리 패턴"],
        "riskManagementRules": ["손절/위험 관리 원칙"]
      },
      "keyConditionsSummary": "전체 전략에 대한 한 문장 요약",
      "strategyType": "aggressive / moderate / stable"
    }
  `;

  const result = await genAI.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }] as any
  });
  
  const text = (result as any).text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI synthesis response as JSON');
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    fileAnalyses: analyses,
    criteria: parsed.criteria,
    strategy: parsed.strategy,
    strategyType: parsed.strategyType,
    keyConditionsSummary: parsed.keyConditionsSummary,
    rawSummaries: fragments.map(f => ({ fileName: f.fileName, summary: f.summary })),
    learnedAt: new Date(),
    sourceFiles: [] // 위에서 채움
  };
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
