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
    당신은 전설적인 주식 투자자들의 논리를 학습하고 데이터에서 초과 수익의 원천(Alpha)을 발굴하는 수석 데이터 과학자입니다. 
    제공된 자료에서 '훌륭한 기업을 찾는 기준'과 '매수 타이밍/패턴'을 정밀하게 추출하고 고도의 '투자 알고리즘'으로 변환하십시오.

    파일명: ${file.name}
    내용 자료 (최대 100k 자): 
    ${content.substring(0, 100000)}

    [분석 및 필터링 지침]
    1. 노이즈 제거: 자료의 앞이나 뒷부분에 나타나는 인사말, 공지사항 등 투자 로직과 관계없는 텍스트는 무시하십시오.
    
    2. 다차원적 규칙 발굴: 단순한 수익성 지표에 그치지 말고, 아래 관점에서 전방위적으로 포착하십시오.
       - 비즈니스 모델: 경제적 해자(Moat), 가격 결정력, 네트워크 효과, 규모의 경제.
       - 성장 모멘텀: 지속 가능한 성장률, 신시장 개척 역량, 제품 혁신 주기.
       - 재무적 건전성: 자본 효율성(ROE/ROIC), 잉여현금흐름(FCF) 창출력, 자산 경량화 여부.
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
