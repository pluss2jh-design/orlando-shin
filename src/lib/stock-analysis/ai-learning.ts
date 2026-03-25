import { withRetry } from '@/lib/utils/retry';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import type {
  FileAnalysis,
  LearnedInvestmentCriteria,
  InvestmentStrategy,
  SourceReference,
  LearnedKnowledge,
} from '@/types/stock-analysis';
import {
  listDriveFiles,
  downloadTextContent,
  downloadDriveFile,
  getSyncInfo,
  getFilesByIds,
  type DriveFileInfo,
} from '@/lib/google-drive';
import { videoProcessingService } from '../video-processing/processor';
import { VideoProcessingResult } from '@/types/video-processing';

export const learningStatus = {
  isLearning: false,
  isCancelled: false,
  startTime: null as Date | null,
  totalFiles: 0,
  completedFiles: 0,
};

export function cancelLearningPipeline() {
  if (learningStatus.isLearning) {
    learningStatus.isCancelled = true;
  }
}

function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }
  return new GoogleGenAI({ apiKey });
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  return new OpenAI({ apiKey });
}

function getAnthropicClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY가 설정되지 않았습니다.');
  return new Anthropic({ apiKey });
}

function getFileExt(name: string, mime: string) {
  if (mime.includes('video') || name.toLowerCase().endsWith('.mp4')) return 'mp4';
  if (name.toLowerCase().endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.toLowerCase().endsWith('.docx') || name.toLowerCase().endsWith('.doc')) return 'docx';
  if (name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls') || name.toLowerCase().endsWith('.csv')) return 'xlsx';
  return 'other';
}

function isPDFFile(file: DriveFileInfo): boolean {
  return file.mimeType?.includes('pdf') ||
    file.name?.toLowerCase().endsWith('.pdf') || false;
}

function isVideoFile(file: DriveFileInfo): boolean {
  return file.mimeType?.includes('video') ||
    file.name?.toLowerCase().endsWith('.mp4') || false;
}

function isTextOrDocumentFile(file: DriveFileInfo): boolean {
  return file.mimeType?.includes('document') ||
    file.mimeType?.includes('text') ||
    file.mimeType?.includes('spreadsheet') || false;
}

async function waitForVideoProcessing(fileId: string): Promise<VideoProcessingResult | undefined> {
  let attempts = 0;
  const maxAttempts = 60; // 5분 (5초 간격)
  
  while (attempts < maxAttempts) {
    if (learningStatus.isCancelled) return undefined;
    
    const result = videoProcessingService.getProcessingResult(fileId);
    if (result && (result.status === 'completed' || result.status === 'error')) {
      return result;
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  return undefined;
}

export async function runLearningPipeline(
  targetFileIds?: string[],
  aiModels?: Record<string, string>
): Promise<LearnedKnowledge> {
  if (learningStatus.isLearning) {
    throw new Error('현재 다른 학습이 진행 중입니다. 잠시 후 다시 시도해주세요.');
  }

  learningStatus.isLearning = true;
  learningStatus.isCancelled = false;
  learningStatus.startTime = new Date();

  try {
    let allFiles: DriveFileInfo[] = [];

    // 최적화: targetFileIds가 있을 경우 전체 스캔 대신 캐시 혹은 개별 파일 조회 사용
    if (targetFileIds && targetFileIds.length > 0) {
      const syncInfo = await getSyncInfo();
      const cachedFiles = syncInfo?.files.filter(f => targetFileIds.includes(f.id)) || [];

      if (cachedFiles.length === targetFileIds.length) {
        console.log(`[Learning] Using ${cachedFiles.length} files from cache.`);
        allFiles = cachedFiles;
      } else {
        console.log(`[Learning] Fetching ${targetFileIds.length} files individually...`);
        allFiles = await getFilesByIds(targetFileIds);
      }
    } else {
      console.log(`[Learning] Scanning entire drive...`);
      const syncResult = await listDriveFiles();
      allFiles = syncResult.files;
    }

    const files = allFiles;

    if (files.length === 0) {
      throw new Error('Google Drive 폴더에 파일이 없습니다.');
    }

    const targetFiles = files.filter(f => isPDFFile(f) || isVideoFile(f) || isTextOrDocumentFile(f));
    if (targetFiles.length === 0) {
      throw new Error('지원되는 파일 형식이 없습니다.');
    }

    const fileAnalyses: FileAnalysis[] = [];
    learningStatus.totalFiles = targetFiles.length;
    learningStatus.completedFiles = 0;

    const client = getGeminiClient();

    for (const file of targetFiles) {
      if (learningStatus.isCancelled) {
        throw new Error('학습이 강제 중지되었습니다.');
      }

      try {
        let content = '';
        let inlineDataPart: any = null;
        let visualHighlights: { timestamp: string; description: string; imageUrl?: string }[] = [];

        if (isVideoFile(file)) {
          console.log(`Analyzing video: ${file.name}`);
          const fileBuffer = await downloadDriveFile(file.id, file.name);
          
          // 1. 영상 전처리 (STT + 프레임 추출)
          const fileId = await videoProcessingService.processVideo(fileBuffer, file.name, {
            extractAudio: true,
            performStt: true,
            captureFrames: true,
            frameInterval: 10,
            keyMomentDetection: true
          });

          // 상태 폴링 (최대 5분)
          let result = await waitForVideoProcessing(fileId);
          
          if (result && result.status === 'completed') {
            const sttText = result.transcript?.segments.map((s: any) => `[${s.startTime}s] ${s.text}`).join('\n') || '';
            const visualText = result.keyMoments?.filter((m: any) => m.type === 'visual').map((m: any) => `[${m.timestamp}s] ${m.description}`).join('\n') || '';
            
            content = `[VIDEO_ANALYSIS]\n${file.name}\n\nSTT Transcript:\n${sttText}\n\nVisual Analysis:\n${visualText}`;
            visualHighlights = (result.keyMoments || []).map((m: any) => ({
              timestamp: `${m.timestamp}s`,
              description: m.description
            }));

            // Gemini 멀티모달용 데이터
            inlineDataPart = {
              inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: 'video/mp4'
              }
            };
          } else {
            content = `[비디오 분석 실패: ${file.name}] STT/프레임 추출 오류`;
          }
        } else if (isPDFFile(file)) {
          const fileBuffer = await downloadDriveFile(file.id, file.name);
          inlineDataPart = {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: 'application/pdf'
            }
          };
          content = `[PDF_CONTENT]`;
        } else {
          content = await extractFileContent(file);
        }

        if (!content || content.trim().length === 0) continue;

        const ext = getFileExt(file.name, file.mimeType);
        const chosenModelGrp = aiModels?.[ext] || aiModels?.['전체'] || 'gemini-1.5-flash';
        
        const promptText = `주식 투자 분석가로서 다음 파일의 핵심 조건을 추출하세요: ${file.name}. JSON 형식 {"keyConditions": []}로 응답하세요.`;
        let responseText = '';

        if (chosenModelGrp.startsWith('gpt')) {
          responseText = await withRetry(async () => {
            const openai = getOpenAIClient();
            const res = await openai.chat.completions.create({
              model: chosenModelGrp,
              messages: [{ role: 'user', content: promptText }]
            });
            return res.choices[0].message.content || '';
          });
        } else if (chosenModelGrp.startsWith('claude')) {
          responseText = await withRetry(async () => {
            const anthropic = getAnthropicClient();
            const res = await anthropic.messages.create({
              model: chosenModelGrp as any,
              max_tokens: 4096,
              messages: [{ role: 'user', content: promptText }]
            });
            return (res.content[0] as any).text || '';
          });
        } else {
          responseText = await withRetry(async () => {
            const client = getGeminiClient();
            const contents = inlineDataPart ? [promptText, inlineDataPart] : [promptText];
            const fullModelName = chosenModelGrp.startsWith('models/') ? chosenModelGrp : `models/${chosenModelGrp}`;
            const result = await client.models.generateContent({
              model: fullModelName,
              contents: contents as any
            });
            return (result as any).text || '';
          });
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { keyConditions: [] };

        fileAnalyses.push({
          fileName: file.name,
          fileId: file.id,
          keyConditions: analysisResult.keyConditions || [],
          visualHighlights,
          extractedAt: new Date(),
        });

        learningStatus.completedFiles += 1;
      } catch (error: any) {
        console.error(`파일 분석 실패: ${file.name}`, error);
        throw new Error(`파일(${file.name}) 분석 중 오류: ${error.message}`);
      }
    }

    const docConditions = fileAnalyses.flatMap(fa => fa.keyConditions).join('\n');
    // 전략 도출용 모델 선택 (PDF/문서 모델 우선, 없으면 '전체' 또는 선택된 모델 중 아무거나)
    const strategyModelName = 
      aiModels?.pdf || 
      aiModels?.['전체'] || 
      aiModels?.docx || 
      aiModels?.xlsx || 
      aiModels?.other || 
      aiModels?.mp4 || 
      Object.values(aiModels || {})[0];

    if (!strategyModelName) {
      throw new Error('종합 전략 도출을 위한 AI 모델이 선택되지 않았습니다. 모델 탭에서 사용할 AI 모델을 선택해주세요.');
    }
    const strategyPrompt = `당신은 제공된 여러 개별 자료(문서, 영상)의 분석 결과를 완벽하게 통합하여, 하나의 일관된 '최종 투자 알고리즘'을 설계하는 **수석 전략 합성가(Head of Strategy Synthesis)**입니다.
 
 ### [1. 전문가 합의 및 논리 통합 지침]
 - **목표**: 자료에서 공통적으로 언급하거나 강조하는 "주가가 오르기 위한 핵심 조건"을 추출하세요.
 - **논리 통합**: 여러 자료에서 동일한 지표를 강조하면 가중치를 높이고, 상충되는 의견이 있으면 더 보수적이거나 논리적인 근거가 강한 쪽을 채택하세요.
 - **부재 데이터 보충**: 자료에서 구체적인 수치가 없더라도, 전문가로서 해당 지표의 보편적인 성공 기준을 제안하십시오. (예: "자료에선 수익성을 강조함" -> ROE 15% 이상 제안)
 
 ### [2. 정량 지표 매핑 가이드 (필수)]
 **target_metric** 필드에는 반드시 아래 목록 중 가장 적절한 이름을 사용하세요:
 - **revenue_growth**: 매출 성장률 (%)
 - **net_income_growth**: 순이익 성장률 (%)
 - **roe**: 자기자본이익률 (%)
 - **per**: 주가수익비율
 - **pbr**: 주가순자산비율
 - **debt_ratio**: 부채비율 (%)
 - **operating_margin**: 영업이익률 (%)
 - **dividend_yield**: 배당수익률 (%)
 - **eps_growth**: 주당순이익 성장률 (%)
 - **current_ratio**: 유동비율 (%)
 
 ### [3. 동적 계량화 지침]
 - **benchmark_type**:
   - 'absolute': 고정된 수치
   - 'sector_relative': 해당 업종 평균 대비
   - 'sector_percentile': 업종 내 상위 %
 
 ### [4. 필드별 의무 준수 사항]
 1. **description**: 반드시 3문장 이내. "왜 이 조건이 주가 상승에 필수적인지"를 자료 근거와 함께 설명.
 2. **weight**: 0.1~1.0. 핵심 조건일수록 높게 책정.
 3. **isCritical**: 필수 조건인 경우 True.
 4. **source**: 근거 파일명과 위치 명시.
 
 추출된 개별 파일 분석 결과들:
 ${docConditions}
 
 ### [5. 최종 출력 요구사항 - JSON 규격]
 **반드시 아래 구조로만 응답하세요. 다른 텍스트는 절대 포함하지 마십시오.**
 {
   "keyConditionsSummary": "통합 투자 철학 핵심 요약 (5문장 내외)",
   "consensusScore": 0~100,
   "strategyType": "aggressive|moderate|stable",
   "strategy": {
     "shortTermConditions": ["단기 조건..."],
     "longTermConditions": ["장기 조건..."],
     "winningPatterns": ["필승 패턴..."],
     "riskManagementRules": ["리스크 관리..."]
   },
   "criterias": [
     {
       "name": "규칙 이름",
       "category": "성장성|수익성|안정성|가치평가|수급",
       "weight": 0.1~1.0, 
       "description": "상세 로직",
       "quantification": {
         "target_metric": "상기 가이드의 필드명",
         "condition": ">|<|>=|<=|==",
         "benchmark": "수치(15) 또는 'sector_avg' 등",
         "benchmark_type": "absolute|sector_relative|sector_percentile",
         "scoring_type": "binary|linear"
       },
       "isCritical": true|false, 
       "visualEvidence": "시각적 근거 요약",
       "source": { "fileName": "파일명", "location": "위치" }
     }
   ],
   "principles": [
     { "principle": "원칙 내용", "category": "entry|exit|risk|general", "source": { "fileName": "파일명", "location": "위치" } }
   ]
 }`;

    const strategyText = await withRetry(async () => {
      const fullModelName = strategyModelName.startsWith('models/') ? strategyModelName : `models/${strategyModelName}`;
      const strategyResult = await client.models.generateContent({
        model: fullModelName,
        contents: [strategyPrompt]
      });
      return (strategyResult as any).text || '';
    });

    const strategyJsonMatch = strategyText.match(/\{[\s\S]*\}/);
    const strategyData = strategyJsonMatch ? JSON.parse(strategyJsonMatch[0]) : {};

    const defaultSource: SourceReference = { fileName: '합성된 투자 원칙', type: 'pdf', pageOrTimestamp: 'System', content: '종합 분석 결과' };
    const strategy: InvestmentStrategy = {
      shortTermConditions: strategyData.strategy?.shortTermConditions || [],
      longTermConditions: strategyData.strategy?.longTermConditions || [],
      winningPatterns: strategyData.strategy?.winningPatterns || [],
      riskManagementRules: strategyData.strategy?.riskManagementRules || [],
      consensusScore: strategyData.consensusScore || 80,
    };

    const criteria: LearnedInvestmentCriteria = {
      consensusScore: strategyData.consensusScore || 85,
      criterias: (strategyData.criterias || []).map((c: any) => ({
        name: c.name,
        category: c.category,
        weight: c.weight || 0.5,
        description: c.description || '',
        quantification: {
          target_metric: c.quantification?.target_metric || 'unknown',
          condition: c.quantification?.condition || '>=',
          benchmark: c.quantification?.benchmark || 0,
          benchmark_type: c.quantification?.benchmark_type || 'absolute',
          scoring_type: c.quantification?.scoring_type || 'linear',
        },
        isCritical: c.isCritical || false,
        visualEvidence: c.visualEvidence || '',
        source: c.source || defaultSource,
      })),
      principles: (strategyData.principles || []).map((p: any) => ({
        principle: p.principle,
        category: p.category || 'general',
        source: p.source ? {
          fileName: p.source.fileName || 'unknown',
          type: 'pdf',
          pageOrTimestamp: p.source.location || '-',
          content: p.principle
        } : defaultSource
      })),
    };

    const knowledge: LearnedKnowledge = {
      fileAnalyses,
      criteria,
      strategy,
      strategyType: strategyData.strategyType || 'moderate',
      keyConditionsSummary: strategyData.keyConditionsSummary || '분석 요약본입니다.',
      rawSummaries: targetFiles.map(f => ({ fileName: f.name, summary: '학습 완료' })),
      learnedAt: new Date(),
      sourceFiles: targetFiles.map(f => f.name),
    };

    return knowledge;

  } finally {
    learningStatus.isLearning = false;
    learningStatus.isCancelled = false;
    learningStatus.startTime = null;
    learningStatus.totalFiles = 0;
    learningStatus.completedFiles = 0;
  }
}

async function extractFileContent(file: DriveFileInfo): Promise<string> {
  const mimeType = file.mimeType;
  if (mimeType === 'application/vnd.google-apps.document' || mimeType === 'application/vnd.google-apps.spreadsheet' || mimeType?.startsWith('text/') || mimeType?.includes('pdf')) {
    return downloadTextContent(file.id);
  }
  if (mimeType?.startsWith('video/')) return `[비디오 파일: ${file.name}]`;
  return '';
}

export async function saveKnowledgeToDB(knowledge: LearnedKnowledge, title?: string): Promise<string> {
  const result = await prisma.learnedKnowledge.create({
    data: {
      title: title || `Learning Session ${new Date().toLocaleString()}`,
      content: knowledge as any,
      keyConditionsSummary: knowledge.keyConditionsSummary,
      strategyType: knowledge.strategyType,
      files: knowledge.sourceFiles as any,
    }
  });
  return result.id;
}


export async function getActiveKnowledgeFromDB(): Promise<LearnedKnowledge | null> {
  const active = await prisma.learnedKnowledge.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  });
  if (active) return active.content as unknown as LearnedKnowledge;
  return null;
}

export async function getLearnedKnowledge(): Promise<LearnedKnowledge | null> {
  try {
    const activeKnowledge = await getActiveKnowledgeFromDB();
    if (activeKnowledge) return activeKnowledge;
  } catch (error) {
    console.error('Failed to fetch active knowledge from DB:', error);
  }
  return null;
}

export async function hasLearnedKnowledge(): Promise<boolean> {
  const count = await prisma.learnedKnowledge.count({ where: { isActive: true } });
  return count > 0;
}
