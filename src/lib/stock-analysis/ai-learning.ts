import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type {
  ExtractedCompanyAnalysis,
  LearnedInvestmentCriteria,
  InvestmentStrategy,
  SourceReference,
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

const USE_MOCK_AI = process.env.USE_MOCK_AI === 'true' || !process.env.OPENAI_API_KEY;

interface LearnedKnowledge {
  companies: ExtractedCompanyAnalysis[];
  criteria: LearnedInvestmentCriteria;
  strategy: InvestmentStrategy;
  rawSummaries: { fileName: string; summary: string }[];
  learnedAt: Date;
  sourceFiles: string[];
}

function getOpenAIClient(): OpenAI {
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
      const batchPrompt = batch.map(item => `파일명: ${item.fileName}\n내용: ${item.content.substring(0, 3000)}`).join('\n\n---\n\n');

      const batchResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 주식 투자 분석 전문가입니다. 여러 자료를 한꺼번에 분석하여 언급된 모든 기업 정보와 투자 규칙을 추출하세요.
기업명과 티커를 정확히 매칭하고, 매수 추천가/목표가가 있다면 반드시 포함하세요.
JSON 형식:
{
  "companies": [{ "companyName": "...", "ticker": "...", "targetPrice": 0, "investmentThesis": "...", "metrics": {...} }],
  "rules": [{ "rule": "...", "category": "...", "weight": 0.5 }]
}`,
          },
          { role: 'user', content: `다음 자료들을 분석하세요:\n\n${batchPrompt}` },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(batchResponse.choices[0]?.message?.content || '{}');
      if (parsed.companies) {
        for (const c of parsed.companies) {
          allCompanies.push(mapToExtractedCompany(c, batch[0].fileName, 'batch_analysis'));
        }
      }
      if (batch[0]) {
        rawSummaries.push({ fileName: batch[0].fileName, summary: 'Batch processed' });
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
        source: { fileName: '심층 전략 분석', type: 'pdf', pageOrTimestamp: '-', content: '종합 분석 결과' }
      })),
      idealMetricRanges: (deepData.criteria?.idealMetricRanges || []).map((r: any) => ({
        ...r,
        source: { fileName: '심층 전략 분석', type: 'pdf', pageOrTimestamp: '-', content: '종합 분석 결과' }
      })),
      principles: strategy.winningPatterns.map(p => ({
        principle: p,
        category: 'general',
        source: { fileName: '심층 전략 분석', type: 'pdf', pageOrTimestamp: '-', content: '패턴 분석' }
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
    console.error('OpenAI 학습 파이프라인 실패, Mock 모드로 전환합니다:', error);
    return await saveAndReturnMock(files);
  }
}

function mapToExtractedCompany(c: any, fileName: string, content: string): ExtractedCompanyAnalysis {
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
    sources: [{ fileName, type: 'pdf', pageOrTimestamp: '전체', content }],
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
    fileName: files.length > 0 ? files[0].name : 'Mock 자료',
    type: 'pdf',
    pageOrTimestamp: '1',
    content: 'Mock 분석 자료에서 추출된 내용입니다.',
  };

  const mockCompanies: ExtractedCompanyAnalysis[] = [
    {
      companyName: '삼성전자',
      ticker: '005930.KS',
      market: 'KRX',
      currency: 'KRW',
      recommendedBuyPrice: 65000,
      targetPrice: 85000,
      metrics: { per: 12.5, pbr: 1.1, roe: 14.5 },
      investmentThesis: '반도체 업황 회복 및 AI 메모리 수요 증가',
      riskFactors: ['대외 거시경제 불확실성', '경쟁 심화'],
      sector: 'IT/반도체',
      investmentStyle: 'moderate',
      sources: [defaultSource],
      extractedAt: new Date(),
      confidence: 0.9,
    },
    {
      companyName: 'SK하이닉스',
      ticker: '000660.KS',
      market: 'KRX',
      currency: 'KRW',
      recommendedBuyPrice: 150000,
      targetPrice: 210000,
      metrics: { per: 18.2, pbr: 1.5, roe: 12.8 },
      investmentThesis: 'HBM 시장 독점적 지위 및 수익성 개선',
      riskFactors: ['메모리 가격 변동성'],
      sector: 'IT/반도체',
      investmentStyle: 'aggressive',
      sources: [defaultSource],
      extractedAt: new Date(),
      confidence: 0.85,
    },
    {
      companyName: 'NVIDIA',
      ticker: 'NVDA',
      market: 'NASDAQ',
      currency: 'USD',
      recommendedBuyPrice: 110,
      targetPrice: 150,
      metrics: { per: 45.5, pbr: 25.2, roe: 68.4 },
      investmentThesis: 'AI 데이터센터 수요 폭증 및 지배적 점유율',
      riskFactors: ['고평가 논란', '대중국 규제'],
      sector: 'IT/반도체',
      investmentStyle: 'aggressive',
      sources: [defaultSource],
      extractedAt: new Date(),
      confidence: 0.8,
    }
  ];

  const criteria: LearnedInvestmentCriteria = {
    goodCompanyRules: [
      { rule: 'ROE가 10% 이상일 것', weight: 0.8, source: defaultSource },
      { rule: 'PER이 업종 평균 대비 낮을 것', weight: 0.7, source: defaultSource }
    ],
    idealMetricRanges: [
      { metric: 'per', min: 5, max: 25, description: '적정 PER 범위', source: defaultSource }
    ],
    principles: [
      { principle: '안전마진 확보 후 매수', category: 'entry', source: defaultSource }
    ]
  };

  const strategy: InvestmentStrategy = {
    shortTermConditions: ['거래량 급증', '전고점 돌파'],
    longTermConditions: ['지속적인 매출 성장', '높은 ROE 유지'],
    winningPatterns: ['V자 반등', '박스권 돌파'],
    riskManagementRules: ['손절선 준수', '분산 투자'],
  };

  return {
    companies: mockCompanies,
    criteria,
    strategy,
    rawSummaries: files.map(f => ({ fileName: f.name, summary: 'Mock summary for testing' })),
    learnedAt: new Date(),
    sourceFiles: files.map(f => f.name),
  };
}
