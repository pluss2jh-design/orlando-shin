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
        const chosenModelGrp = aiModels?.[ext];
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
    const strategyPrompt = `다음 조건들을 종합하여 투자 전략과 규칙을 도출하세요. JSON 형식 {"strategy": {}, "criteria": {}}로 응답하세요.\n\n조건들:\n${docConditions}`;

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
      goodCompanyRules: (strategyData.criteria?.goodCompanyRules || []).map((r: any) => ({ rule: r.rule, weight: r.weight || 0.5, source: defaultSource, category: r.category || 'fundamental' })),
      idealMetricRanges: (strategyData.criteria?.idealMetricRanges || []).map((r: any) => ({ metric: r.metric, min: r.min, max: r.max, description: r.description || '', source: defaultSource })),
      principles: (strategyData.criteria?.principles || []).map((p: any) => ({ principle: p.principle, category: p.category || 'general', source: defaultSource })),
      technicalRules: (strategyData.criteria?.technicalRules || []).map((r: any) => ({ indicator: r.indicator, rule: r.rule, weight: r.weight || 0.5, source: defaultSource })),
      marketSizeRules: (strategyData.criteria?.marketSizeRules || []).map((r: any) => ({ rule: r.rule, weight: r.weight || 0.5, source: defaultSource })),
      unitEconomicsRules: (strategyData.criteria?.unitEconomicsRules || []).map((r: any) => ({ metric: r.metric, rule: r.rule, weight: r.weight || 0.5, source: defaultSource })),
      lifecycleRules: (strategyData.criteria?.lifecycleRules || []).map((r: any) => ({ stage: r.stage || 'growth', rule: r.rule, weight: r.weight || 0.5, source: defaultSource })),
      buyTimingRules: (strategyData.criteria?.buyTimingRules || []).map((r: any) => ({ rule: r.rule, weight: r.weight || 0.5, conditions: r.conditions || [], source: defaultSource })),
    };

    const knowledge: LearnedKnowledge = {
      fileAnalyses,
      criteria,
      strategy,
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
      files: knowledge.sourceFiles as any,
      isActive: false,
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
