import { withRetry } from '@/lib/utils/retry';
import { promises as fs } from 'fs';
import path from 'path';
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
  type DriveFileInfo,
} from '@/lib/google-drive';

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
    const syncResult = await listDriveFiles();
    const allFiles = syncResult.files;

    const files = targetFileIds && targetFileIds.length > 0
      ? allFiles.filter(f => targetFileIds.includes(f.id))
      : allFiles;

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

        if (isPDFFile(file) || isVideoFile(file)) {
          const fileBuffer = await downloadDriveFile(file.id, file.name);
          const mimeType = isVideoFile(file) ? 'video/mp4' : 'application/pdf';
          inlineDataPart = {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: mimeType
            }
          };
          content = `[MEDIA_CONTENT]`;
        } else {
          content = await extractFileContent(file);
        }

        if (!content || content.trim().length === 0) continue;

        const ext = getFileExt(file.name, file.mimeType);
        const chosenModelGrp = aiModels?.[ext] || aiModels?.['전체'];
        if (!chosenModelGrp) {
          throw new Error(`${ext.toUpperCase()} 모델이 선택되지 않았습니다.`);
        }

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
            const result = await client.models.generateContent({
              model: chosenModelGrp,
              contents: contents as any
            });
            return result.text || '';
          });
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { keyConditions: [] };

        fileAnalyses.push({
          fileName: file.name,
          fileId: file.id,
          keyConditions: analysisResult.keyConditions || [],
          extractedAt: new Date(),
        });

        learningStatus.completedFiles += 1;
      } catch (error: any) {
        console.error(`파일 분석 실패: ${file.name}`, error);
        throw new Error(`파일(${file.name}) 분석 중 오류: ${error.message}`);
      }
    }

    const docConditions = fileAnalyses.flatMap(fa => fa.keyConditions).join('\n');
    const strategyModelName = aiModels?.pdf || aiModels?.docx || aiModels?.xlsx || aiModels?.other || aiModels?.mp4;
    if (!strategyModelName) {
      throw new Error('종합 전략 도출을 위한 AI 모델이 선택되지 않았습니다. PDF 또는 문서 모델을 선택해주세요.');
    }
    const strategyPrompt = `당신은 제공된 원천 자료(문서, 영상)의 내용을 단 한 줄의 왜곡 없이 완벽하게 흡수하여, 해당 자료만의 독창적인 '투자 알고리즘'을 설계하는 **제로-베이스(Zero-base) 전략 분석가**입니다.

### [1. 무제한 동적 카테고리 도출 지침]
- 자료를 분석하여 발견되는 **모든 핵심 가치와 논리를 누락 없이 각각의 카테고리로 생성**하세요.
- 카테고리 개수에 제한을 두지 않습니다. 자료에서 언급된 모든 유의미한 투자 기준을 당신이 새롭게 명명한 카테고리에 담으세요.
- (예: '폭발적 이익의 전조', '무너질 수 없는 경제적 해자', '재무적 안전핀' 등 자료의 뉘앙스를 그대로 살린 명칭 사용)

### [2. 필드별 데이터 결정 및 의무 준수 사항]

1. **description (상세 설명):**
   - **반드시 3문장 이내**로 작성하십시오.
   - 수사적인 표현은 줄이고, 저자가 말한 "조건, 이유, 결과" 위주로 핵심만 간결하게 기록하세요.

2. **weight (중요도 가중치):**
   - 저자의 수식어와 강조 횟수에 따라 엄격히 결정 (0.1~1.0).
   - **0.9~1.0**: '최우선순위', '가장 먼저 확인', '결정적 요인'
   - **0.1~0.5**: '참고용', '부가적 힌트', '도움이 되는 지표'

3. **isCritical (Critical 여부):**
   - **True**: 저자가 "이 조건이 충족되지 않으면 무조건 탈락"이라 명시하거나 "실패의 결정적 원인"이라 한 경우에만 설정.
   - **False**: 일반적인 평가 지표인 경우 무조건 False. (남발 금지)

4. **quantification (계량화):**
   - **target_metric**: 시스템 조회 명칭 (revenue_growth, debt_ratio, rsi, roe, net_income, current_ratio, quick_ratio, eps_growth, operating_margin 등)
   - **condition & benchmark**: 자료에 숫자가 있다면 그 값을, 없다면 전문가로서 적정한 수치를 직접 제안하여 기입.

추출된 핵심 조건들:
${docConditions}

### [3. 최종 출력 요구사항 - JSON 규격]
**반드시 아래 구조로만 응답하세요. 다른 텍스트는 포함하지 마십시오.**
{
  "keyConditionsSummary": "자료의 투자 철학 핵심 요약 (5문장 내외)",
  "strategyType": "aggressive|moderate|stable",
  "strategy": {
    "shortTermConditions": ["단기 조건 리스트..."],
    "longTermConditions": ["장기 조건 리스트..."],
    "winningPatterns": ["필승 패턴..."],
    "riskManagementRules": ["리스크 관리 및 매도 원칙..."]
  },
  "criterias": [
    {
      "name": "규칙 이름",
      "category": "자료에서 추출하여 당신이 명명한 카테고리",
      "weight": 0.1~1.0, 
      "description": "핵심 로직 (3문장 이내)",
      "quantification": {
        "target_metric": "지표 영문명",
        "condition": "> | < | >= | <= | ==",
        "benchmark": 0,
        "scoring_type": "binary|linear"
      },
      "isCritical": true|false, 
      "source": { "fileName": "파일명", "location": "페이지/타임라인" }
    }
  ],
  "principles": [
    { "principle": "원칙 내용", "category": "entry|exit|risk|general", "source": { "fileName": "파일명", "location": "위치" } }
  ]
}`;

    const strategyText = await withRetry(async () => {
      const strategyResult = await client.models.generateContent({
        model: strategyModelName,
        contents: [strategyPrompt]
      });
      return strategyResult.text || '';
    });

    const strategyJsonMatch = strategyText.match(/\{[\s\S]*\}/);
    const strategyData = strategyJsonMatch ? JSON.parse(strategyJsonMatch[0]) : {};

    const defaultSource: SourceReference = { fileName: '종합 분석', type: 'pdf', pageOrTimestamp: '-', content: '학습 데이터 종합 분석 결과' };

    const strategy: InvestmentStrategy = {
      shortTermConditions: strategyData.strategy?.shortTermConditions || [],
      longTermConditions: strategyData.strategy?.longTermConditions || [],
      winningPatterns: strategyData.strategy?.winningPatterns || [],
      riskManagementRules: strategyData.strategy?.riskManagementRules || [],
    };

    const criteria: LearnedInvestmentCriteria = {
      criterias: (strategyData.criterias || []).map((c: any) => ({
        name: c.name,
        category: c.category,
        weight: c.weight || 0.5,
        description: c.description || '',
        quantification: {
          target_metric: c.quantification?.target_metric || 'unknown',
          condition: c.quantification?.condition || '>=',
          benchmark: c.quantification?.benchmark || 0,
          scoring_type: c.quantification?.scoring_type || 'binary'
        },
        isCritical: !!c.isCritical,
        source: c.source ? {
          fileName: c.source.fileName || 'unknown',
          type: 'pdf',
          pageOrTimestamp: c.source.location || '-',
          content: c.description || ''
        } : defaultSource
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
