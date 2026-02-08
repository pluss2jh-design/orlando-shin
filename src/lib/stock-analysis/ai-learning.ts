import { promises as fs } from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type {
  ExtractedCompanyAnalysis,
  LearnedInvestmentCriteria,
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
    console.log('Using Mock AI for learning pipeline');
    const mockKnowledge = generateMockKnowledge(files);
    
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(mockKnowledge, null, 2));
    
    return mockKnowledge;
  }

  if (files.length === 0) {
    throw new Error('Google Drive 폴더에 파일이 없습니다.');
  }

  const textContents: { fileName: string; content: string; fileInfo: DriveFileInfo }[] = [];

  for (const file of files) {
    try {
      const content = await extractFileContent(file);
      if (content.trim().length > 0) {
        textContents.push({ fileName: file.name, content, fileInfo: file });
      }
    } catch (error) {
      console.error(`파일 처리 실패: ${file.name}`, error);
    }
  }

  if (textContents.length === 0) {
    throw new Error('처리할 수 있는 텍스트 콘텐츠가 없습니다.');
  }

  const openai = getOpenAIClient();
  const rawSummaries: { fileName: string; summary: string }[] = [];
  const allCompanies: ExtractedCompanyAnalysis[] = [];

  for (const item of textContents) {
    const truncatedContent = item.content.substring(0, 15000);

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `당신은 주식 투자 분석 전문가입니다. 주어진 자료를 분석하여 핵심 정보를 추출하세요.

다음을 JSON 형식으로 응답하세요:
{
  "summary": "자료의 핵심 요약 (200자 이내)",
  "type": "education" | "company_analysis" | "market_overview",
  "companies": [
    {
      "companyName": "기업명",
      "ticker": "종목코드",
      "market": "KRX" | "NYSE" | "NASDAQ" | "unknown",
      "currency": "KRW" | "USD",
      "recommendedBuyPrice": 숫자 또는 null,
      "targetPrice": 숫자 또는 null,
      "metrics": { "per": 숫자|null, "pbr": 숫자|null, "roe": 숫자|null, "eps": 숫자|null },
      "investmentThesis": "투자 논거",
      "riskFactors": ["리스크1", "리스크2"],
      "sector": "섹터",
      "investmentStyle": "conservative" | "aggressive" | "moderate"
    }
  ],
  "investmentRules": [
    { "rule": "투자 규칙", "weight": 0.1~1.0, "category": "entry"|"exit"|"risk"|"general" }
  ],
  "metricRanges": [
    { "metric": "per"|"pbr"|"roe", "min": 숫자|null, "max": 숫자|null, "description": "설명" }
  ]
}`,
        },
        {
          role: 'user',
          content: `다음 자료를 분석하세요:\n\n파일명: ${item.fileName}\n\n${truncatedContent}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const parsed = JSON.parse(
      summaryResponse.choices[0]?.message?.content || '{}'
    );

    rawSummaries.push({
      fileName: item.fileName,
      summary: parsed.summary || '',
    });

    if (parsed.companies && Array.isArray(parsed.companies)) {
      for (const c of parsed.companies) {
        allCompanies.push({
          companyName: c.companyName || '',
          ticker: c.ticker,
          market: c.market || 'unknown',
          currency: c.currency || 'KRW',
          recommendedBuyPrice: c.recommendedBuyPrice,
          targetPrice: c.targetPrice,
          stopLossPrice: undefined,
          metrics: {
            per: c.metrics?.per,
            pbr: c.metrics?.pbr,
            roe: c.metrics?.roe,
            eps: c.metrics?.eps,
            dividendYield: c.metrics?.dividendYield,
            debtRatio: c.metrics?.debtRatio,
            revenueGrowth: c.metrics?.revenueGrowth,
          },
          investmentThesis: c.investmentThesis || '',
          riskFactors: c.riskFactors || [],
          sector: c.sector,
          investmentStyle: c.investmentStyle || 'moderate',
          sources: [
            {
              fileName: item.fileName,
              type: getSourceType(item.fileName),
              pageOrTimestamp: '전체',
              content: parsed.summary || '',
            },
          ],
          extractedAt: new Date(),
          confidence: 0.7,
        });
      }
    }
  }

  const combinedSummary = rawSummaries
    .map((s) => `[${s.fileName}] ${s.summary}`)
    .join('\n');

  const criteriaResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `당신은 주식 투자 교육 전문가입니다. 주어진 자료 요약들을 종합하여 투자 판단 기준을 JSON으로 응답하세요:
{
  "goodCompanyRules": [{ "rule": "규칙 설명", "weight": 0.1~1.0 }],
  "idealMetricRanges": [{ "metric": "per"|"pbr"|"roe"|"eps"|"dividendYield", "min": 숫자|null, "max": 숫자|null, "description": "설명" }],
  "principles": [{ "principle": "원칙", "category": "entry"|"exit"|"risk"|"general" }]
}`,
      },
      {
        role: 'user',
        content: `다음 자료 요약들을 종합하여 투자 판단 기준을 도출하세요:\n\n${combinedSummary}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const criteriaData = JSON.parse(
    criteriaResponse.choices[0]?.message?.content || '{}'
  );

  const defaultSource: SourceReference = {
    fileName: '종합 학습 결과',
    type: 'pdf',
    pageOrTimestamp: '-',
    content: '다수의 업로드 자료를 종합하여 도출된 기준',
  };

  const criteria: LearnedInvestmentCriteria = {
    goodCompanyRules: (criteriaData.goodCompanyRules || []).map(
      (r: { rule: string; weight: number }) => ({
        rule: r.rule,
        weight: r.weight || 0.5,
        source: defaultSource,
      })
    ),
    idealMetricRanges: (criteriaData.idealMetricRanges || []).map(
      (r: { metric: string; min?: number; max?: number; description: string }) => ({
        metric: r.metric,
        min: r.min,
        max: r.max,
        description: r.description || '',
        source: defaultSource,
      })
    ),
    principles: (criteriaData.principles || []).map(
      (r: { principle: string; category: string }) => ({
        principle: r.principle,
        category: r.category || 'general',
        source: defaultSource,
      })
    ),
  };

  const deduplicatedCompanies = deduplicateCompanies(allCompanies);

  const knowledge: LearnedKnowledge = {
    companies: deduplicatedCompanies,
    criteria,
    rawSummaries,
    learnedAt: new Date(),
    sourceFiles: files.map((f) => f.name),
  };

  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

  return knowledge;
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

  return {
    companies: mockCompanies,
    criteria,
    rawSummaries: files.map(f => ({ fileName: f.name, summary: 'Mock summary for testing' })),
    learnedAt: new Date(),
    sourceFiles: files.map(f => f.name),
  };
}
