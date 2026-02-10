import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type {
  ExtractedCompanyAnalysis,
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

const KNOWLEDGE_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'knowledge')
  : './uploads/knowledge';

const KNOWLEDGE_FILE = path.join(KNOWLEDGE_DIR, 'learned-knowledge.json');

export const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true' || !process.env.OPENAI_API_KEY;

export function getOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
}

export async function runLearningPipeline(): Promise<LearnedKnowledge> {
  const syncResult = await listDriveFiles();
  const files = syncResult.files;

  if (USE_MOCK_AI) {
    console.log('Using Mock AI for learning pipeline (Enabled via environment)');
    return await saveAndReturnMock(files);
  }

  if (files.length === 0) {
    throw new Error('Google Drive 폴더에 파일이 없습니다.');
  }

  try {
    const MAX_FILES_TO_PROCESS = 50;
    const targetFiles = files
      .filter(f => 
        f.mimeType === 'application/pdf' || 
        f.mimeType.includes('document') || 
        f.mimeType.startsWith('text/')
      )
      .slice(0, MAX_FILES_TO_PROCESS);

    const textContents: { fileName: string; content: string; fileInfo: DriveFileInfo }[] = [];
    const extractionTasks = targetFiles.map(async (file) => {
      try {
        const content = await extractFileContent(file);
        if (content.trim().length > 0) {
          return { fileName: file.name, content, fileInfo: file };
        }
      } catch (error) {
        console.error(`파일 처리 실패: ${file.name}`, error);
      }
      return null;
    });

    const results = await Promise.all(extractionTasks);
    for (const r of results) {
      if (r) textContents.push(r);
    }

    if (textContents.length === 0) {
      throw new Error('처리할 수 있는 텍스트 콘텐츠가 없습니다.');
    }

    const openai = getOpenAIClient();
    const rawSummaries: { fileName: string; summary: string }[] = [];
    const allCompanies: ExtractedCompanyAnalysis[] = [];
    
    for (let i = 0; i < textContents.length; i += 5) {
      const batch = textContents.slice(i, i + 5);
      const batchPrompt = batch.map(item => `파일명: ${item.fileName}\n내용: ${item.content.substring(0, 4000)}`).join('\n\n---\n\n');

      const batchResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 세계적인 투자 분석가입니다. 자료에서 언급된 "수익률이 오를 것으로 기대되는 기업" 정보를 추출하세요.
단순 언급이 아닌, 분석가의 긍정적 견해가 포함된 경우에만 추출합니다.
JSON 형식:
{
  "companies": [{ 
    "companyName": "기업명", 
    "ticker": "티커(예: AAPL, 005930.KS)", 
    "targetPrice": 숫자, 
    "investmentThesis": "분석 자료에 명시된 구체적인 상승 이유 (100자 이내 핵심 요약)", 
    "metrics": {"per": 0, "roe": 0},
    "location": "페이지 번호 또는 영상 타임스탬프 (예: P.15, 05:20)" 
  }],
  "rules": [{ "rule": "자료에서 강조하는 투자 원칙", "category": "entry|exit|risk", "weight": 0.8 }]
}`,
          },
          { role: 'user', content: `다음 투자 자료를 분석하여 상승 후보군과 핵심 규칙을 추출하세요:\n\n${batchPrompt}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const parsed = JSON.parse(batchResponse.choices[0]?.message?.content || '{}');
      if (parsed.companies) {
        for (const c of (parsed.companies as any[])) {
          allCompanies.push(mapToExtractedCompany(c, batch[0].fileName, c.location || '전체'));
        }
      }
      if (parsed.rules) {
        
      }
    }

    const aggregatedContent = textContents.map(t => `${t.fileName}: ${t.content.substring(0, 1000)}`).join('\n\n').substring(0, 20000);
    
    const deepAnalysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `당신은 전설적인 투자 전략가입니다. 구글 드라이브의 방대한 자료를 종합하여, 향후 주가가 오를 수 있는 기업의 "핵심 특징"과 "상승 규칙"을 10개 이상 도출하세요.
단기적 모멘텀과 장기적 가치 성장 요인을 모두 포함해야 합니다.
JSON 형식:
{
  "strategy": {
    "shortTermConditions": ["구체적인 단기 상승 조건1", "..."],
    "longTermConditions": ["구체적인 장기 상승 조건1", "..."],
    "winningPatterns": ["차트 또는 재무 패턴1", "..."],
    "riskManagementRules": ["손절 및 익절 규칙1", "..."]
  },
  "criteria": {
    "goodCompanyRules": [{ "rule": "규칙", "weight": 0.1~1.0 }],
    "idealMetricRanges": [{ "metric": "per"|"pbr"|"roe"|"dividendYield"|"epsGrowth", "min": 0, "max": 0, "description": "..." }]
  }
}`,
        },
        { role: 'user', content: `다음은 수집된 투자 자료들의 발췌본입니다. 이를 바탕으로 깊이 있는 투자 전략과 기업 선정 규칙을 도출하세요:\n\n${aggregatedContent}` },
      ],
      response_format: { type: 'json_object' },
    });

    const deepData = JSON.parse(deepAnalysisResponse.choices[0]?.message?.content || '{}');
    
    const strategy: InvestmentStrategy = {
      shortTermConditions: deepData.strategy?.shortTermConditions || [],
      longTermConditions: deepData.strategy?.longTermConditions || [],
      winningPatterns: deepData.strategy?.winningPatterns || [],
      riskManagementRules: deepData.strategy?.riskManagementRules || [],
    };

    const criteria: LearnedInvestmentCriteria = {
      goodCompanyRules: (deepData.criteria?.goodCompanyRules || []).map((r: any) => ({
        ...r,
        source: { 
          fileName: targetFiles[0]?.name || '심층 전략 분석', 
          type: 'pdf' as const, 
          pageOrTimestamp: '-', 
          content: '방대한 학습 자료를 종합 분석한 결과 도출된 핵심 규칙입니다.' 
        }
      })),
      idealMetricRanges: (deepData.criteria?.idealMetricRanges || []).map((r: any) => ({
        ...r,
        source: { 
          fileName: targetFiles[0]?.name || '심층 전략 분석', 
          type: 'pdf' as const, 
          pageOrTimestamp: '-', 
          content: '자료 기반의 정규 지표 분석 결과입니다.' 
        }
      })),
      principles: strategy.winningPatterns.map(p => ({
        principle: p,
        category: 'general' as const,
        source: { 
          fileName: targetFiles[1]?.name || targetFiles[0]?.name || '전략 분석', 
          type: 'pdf' as const, 
          pageOrTimestamp: '-', 
          content: '학습된 투자 승리 패턴입니다.' 
        }
      }))
    };

    const knowledge: LearnedKnowledge = {
      companies: deduplicateCompanies(allCompanies),
      criteria,
      strategy,
      rawSummaries,
      learnedAt: new Date(),
      sourceFiles: files.map((f) => f.name),
    };

    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

    return knowledge;
  } catch (error) {
    console.error('OpenAI 학습 파이프라인 실패:', error);
    throw error;
  }
}

function mapToExtractedCompany(c: any, fileName: string, location: string): ExtractedCompanyAnalysis {
  return {
    companyName: c.companyName || '',
    ticker: c.ticker,
    market: c.market || 'unknown',
    currency: c.currency || 'KRW',
    recommendedBuyPrice: c.recommendedBuyPrice,
    targetPrice: c.targetPrice,
    metrics: {
      per: c.metrics?.per,
      pbr: c.metrics?.pbr,
      roe: c.metrics?.roe,
      eps: c.metrics?.eps,
    },
    investmentThesis: c.investmentThesis || '',
    riskFactors: c.riskFactors || [],
    investmentStyle: c.investmentStyle || 'moderate',
    sources: [{ fileName, type: getSourceType(fileName), pageOrTimestamp: location, content: c.investmentThesis || '분석 자료 기반 추출' }],
    extractedAt: new Date(),
    confidence: 0.7,
  };
}

async function saveAndReturnMock(files: DriveFileInfo[]): Promise<LearnedKnowledge> {
  const mockKnowledge = generateMockKnowledge(files);
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(mockKnowledge, null, 2));
  return mockKnowledge;
}

export async function getLearnedKnowledge(): Promise<LearnedKnowledge | null> {
  try {
    const data = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function hasLearnedKnowledge(): Promise<boolean> {
  try {
    await fs.access(KNOWLEDGE_FILE);
    return true;
  } catch {
    return false;
  }
}

async function extractFileContent(file: DriveFileInfo): Promise<string> {
  const mimeType = file.mimeType;

  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType.startsWith('text/')
  ) {
    return downloadTextContent(file.id);
  }

  if (mimeType === 'application/pdf') {
    const filePath = await downloadDriveFile(file.id, file.name);
    return `[PDF 파일: ${file.name}] - 파일 다운로드 완료`;
  }

  if (mimeType.startsWith('video/')) {
    return `[비디오 파일: ${file.name}] - 비디오 분석은 STT/프레임캡처 파이프라인으로 처리 필요.`;
  }

  return '';
}

function getSourceType(fileName: string): 'pdf' | 'mp4' {
  if (fileName.toLowerCase().endsWith('.mp4')) return 'mp4';
  return 'pdf';
}

function deduplicateCompanies(
  companies: ExtractedCompanyAnalysis[]
): ExtractedCompanyAnalysis[] {
  const map = new Map<string, ExtractedCompanyAnalysis>();

  for (const company of companies) {
    const key = company.companyName.toLowerCase().trim();
    const existing = map.get(key);

    if (!existing) {
      map.set(key, company);
      continue;
    }

    map.set(key, {
      ...existing,
      targetPrice: company.targetPrice ?? existing.targetPrice,
      recommendedBuyPrice:
        company.recommendedBuyPrice ?? existing.recommendedBuyPrice,
      metrics: {
        ...existing.metrics,
        ...Object.fromEntries(
          Object.entries(company.metrics).filter(([, v]) => v !== undefined)
        ),
      },
      investmentThesis:
        company.investmentThesis || existing.investmentThesis,
      riskFactors: [
        ...new Set([...existing.riskFactors, ...company.riskFactors]),
      ],
      sources: [...existing.sources, ...company.sources],
      confidence: Math.max(existing.confidence, company.confidence),
    });
  }

  return Array.from(map.values());
}

function generateMockKnowledge(files: DriveFileInfo[]): LearnedKnowledge {
  const defaultSource: SourceReference = {
    fileName: '심층 전략 학습',
    type: 'pdf',
    pageOrTimestamp: '-',
    content: '구글 드라이브 자료를 종합하여 도출된 투자 전략입니다.',
  };

  const criteria: LearnedInvestmentCriteria = {
    goodCompanyRules: [
      { rule: '지속적인 매출 성장세 확인', weight: 0.8, source: defaultSource },
      { rule: '업종 평균 대비 낮은 PER 수준', weight: 0.7, source: defaultSource },
      { rule: '높은 자기자본이익률(ROE) 유지', weight: 0.9, source: defaultSource }
    ],
    idealMetricRanges: [
      { metric: 'roe', min: 15, description: '성장주 기준 ROE', source: defaultSource },
      { metric: 'per', max: 25, description: '적정 가치 평가 범위', source: defaultSource }
    ],
    principles: [
      { principle: '안전마진 확보 시 매수', category: 'entry', source: defaultSource }
    ]
  };

  const strategy: InvestmentStrategy = {
    shortTermConditions: ['거래량 급증 동반 상승', '전고점 돌파 패턴'],
    longTermConditions: ['독보적인 시장 점유율', '강력한 현금 흐름'],
    winningPatterns: ['실적 발표 후 갭상승 유지', '이동평균선 정배열'],
    riskManagementRules: ['투자금의 10% 손절 기준 준수', '섹터 분산 투자'],
  };

  return {
    companies: [],
    criteria,
    strategy,
    rawSummaries: files.map(f => ({ fileName: f.name, summary: '학습 완료된 자료' })),
    learnedAt: new Date(),
    sourceFiles: files.map(f => f.name),
  };
}
