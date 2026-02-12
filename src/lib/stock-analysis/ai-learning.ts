import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

const KNOWLEDGE_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'knowledge')
  : './uploads/knowledge';

const KNOWLEDGE_FILE = path.join(KNOWLEDGE_DIR, 'learned-knowledge.json');

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  return new GoogleGenerativeAI(apiKey);
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

function hasActualAnalysis(keyConditions: string[]): boolean {
  if (!keyConditions || keyConditions.length === 0) return false;
  
  const placeholderPatterns = [
    '제공된 비디오 파일의 내용을 분석할 수 없어',
    '비디오 파일의 내용을 직접 분석할 수 없',
    '영상의 내용을 분석할 수 없',
    '파일의 내용을 분석할 수 없',
    '내용을 분석할 수 없어',
  ];
  
  return !keyConditions.some(condition => 
    placeholderPatterns.some(pattern => condition.includes(pattern))
  );
}

export async function runLearningPipeline(): Promise<LearnedKnowledge> {
  const syncResult = await listDriveFiles();
  const files = syncResult.files;

  if (files.length === 0) {
    throw new Error('Google Drive 폴터에 파일이 없습니다.');
  }

  console.log('All files from Google Drive:', files.map(f => ({ name: f.name, mimeType: f.mimeType })));

  let existingKnowledge: LearnedKnowledge | null = null;
  try {
    const existingData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    existingKnowledge = JSON.parse(existingData);
    console.log('Loaded existing knowledge with', existingKnowledge?.fileAnalyses?.length || 0, 'analyses');
  } catch {
    console.log('No existing knowledge found');
  }

  const targetFiles = files
    .filter(f => {
      const isSupported = isPDFFile(f) || isVideoFile(f) || isTextOrDocumentFile(f);
      console.log(`File: ${f.name}, mimeType: ${f.mimeType}, supported: ${isSupported}`);
      return isSupported;
    });

  console.log(`Filtered ${targetFiles.length} files for processing`);

  if (targetFiles.length === 0) {
    const fileList = files.map(f => `${f.name} (${f.mimeType})`).join(', ');
    throw new Error(`지원되는 파일 형식이 없습니다. 발견된 파일들: ${fileList}`);
  }

  const fileAnalyses: FileAnalysis[] = [];
  const genAI = getGeminiClient();

  for (const file of targetFiles) {
    try {
      if (isVideoFile(file)) {
        const existingAnalysis = existingKnowledge?.fileAnalyses?.find(
          fa => fa.fileName === file.name && fa.fileId === file.id
        );
        
        if (existingAnalysis && hasActualAnalysis(existingAnalysis.keyConditions)) {
          console.log(`Keeping existing analysis for video: ${file.name}`);
          fileAnalyses.push(existingAnalysis);
        } else {
          console.log(`Adding video with empty keyConditions: ${file.name}`);
          fileAnalyses.push({
            fileName: file.name,
            fileId: file.id,
            keyConditions: [],
            extractedAt: new Date(),
          });
        }
        continue;
      }

      if (!isPDFFile(file)) {
        console.log(`Skipping non-PDF file: ${file.name}`);
        continue;
      }

      let content = '';
      
      if (isPDFFile(file)) {
        content = await extractFileContent(file);
        console.log(`Extracted PDF content length: ${content.length} chars`);
      } else {
        content = await extractFileContent(file);
      }

      if (!content || content.trim().length === 0) {
        console.log(`Skipping file ${file.name}: empty content`);
        continue;
      }
      
      if (content.length < 100) {
        console.log(`Warning: Short content for ${file.name}: "${content.substring(0, 200)}"`);
      }

      console.log(`Processing PDF file: ${file.name}`);

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
      
      const prompt = `당신은 전문 주식 투자 분석가입니다. 제공된 PDF 자료에서 주가 상승에 핵심적인 "모든" 재무지표와 분석 기법을 최대한 많이 추출하세요.

자료에 언급된 내용을 바탕으로 구체적인 수치 기반 조건을 작성하세요. 다음은 예시일 뿐이며, 자료에서 찾을 수 있는 모든 지표와 규칙을 추출해야 합니다:

예시 지표들:
- ROE: 일반 기업 평균 8~12%, 최고 수준 25% 이상, 5% 미만은 위험, ROE 15% 이상을 수년간 유지하면 우량 기업
- PER: 10 이하 저평가 구간, 30 이상 고평가 구간
- PBR: 1~2배 건전, 1 미만+저ROE 시 주의
- EV/EBITDA: 5배 이하 매우 저평가, 6~10배 일반, 10배 이상 고평가
- EPS: 주당순이익 성장세
- PEG: 1 이하 저평가, 1~2 적정, 2 이상 고평가
- 부채비율: 200% 이상 위험
- 현금흐름: FCFF 양호
- 배당수익률: 2~4% 안정적

추가로 찾아야 할 지표들:
- 매출성장률, 영업이익률, 순이익률
- 시가총액, 거래량 변화
- 기술적 분석 지표(이동평균선, RSI, MACD 등)
- 산업/섹터별 특수 지표
- 시장 타이밍 관련 규칙
- 리스크 관리 규칙

중요: 자료에서 찾을 수 있는 모든 규칙을 추출하세요. 7개로 제한하지 말고, 자료에 있는 만큼 모두 추출하세요(20~30개 이상도 가능).

다음 형식의 JSON으로 응답하세요:
{
  "keyConditions": [
    "조건1: 구체적인 수치와 기준",
    "조건2: 구체적인 수치와 기준",
    "조건3: 구체적인 수치와 기준"
  ]
}

파일명: ${file.name}

내용:
${content.substring(0, 12000)}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      let analysisResult: { keyConditions?: string[] } = { keyConditions: [] };
      
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error(`JSON parse error for ${file.name}:`, parseError);
        analysisResult = {
          keyConditions: responseText.split('\n').filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./)).map(line => line.replace(/^[-\d.\s]+/, '').trim()).slice(0, 7)
        };
      }
      
      const unanalyzablePatterns = [
        '추출하는 것이 불가능합니다',
        '추출할 수 없습니다',
        '현재 자료만으로는 파악이 어렵습니다',
        '분석할 수 없습니다',
        '제공된 내용만으로는',
        '명시되어 있지 않습니다',
        '포함되어 있지 않습니다',
        '확인할 수 없습니다',
        '파악이 불가능합니다',
        '구체적인 수치가 없습니다',
        '제시되지 않았습니다',
        '언급되지 않았습니다',
        '제공되지 않았습니다',
        '찾을 수 없습니다',
        '포함되지 않았습니다'
      ];
      
      const filteredConditions = (analysisResult.keyConditions || []).filter(condition => {
        const hasUnanalyzable = unanalyzablePatterns.some(pattern => 
          condition.includes(pattern)
        );
        if (hasUnanalyzable) {
          console.log(`Filtering out unanalyzable condition from ${file.name}: "${condition.substring(0, 50)}..."`);
          return false;
        }
        return true;
      });
      
      fileAnalyses.push({
        fileName: file.name,
        fileId: file.id,
        keyConditions: filteredConditions,
        extractedAt: new Date(),
      });

      console.log(`Successfully analyzed PDF: ${file.name} with conditions:`, analysisResult.keyConditions);

    } catch (error) {
      console.error(`파일 분석 실패: ${file.name}`, error);
    }
  }

  console.log(`Successfully analyzed ${fileAnalyses.length} files`);

  if (fileAnalyses.length === 0) {
    throw new Error('처리할 수 있는 파일이 없습니다. Google Drive에 PDF 파일이 있는지 확인해주세요.');
  }

  const pdfAnalyses = fileAnalyses.filter(fa => 
    fa.fileName.toLowerCase().endsWith('.pdf')
  );
  console.log(`PDF analyses count: ${pdfAnalyses.length}`);
  
  const pdfConditions = pdfAnalyses
    .flatMap(fa => fa.keyConditions)
    .join('\n');
  
  console.log(`Total PDF conditions length: ${pdfConditions.length} chars`);
  console.log(`PDF conditions preview: ${pdfConditions.substring(0, 500)}...`);
  
  const strategyModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  
  const strategyPrompt = `전설적인 투자 전략가로서 PDF 자료에서 추출된 핵심 조건들을 종합하여 투자 전략과 기업 선정 규칙을 도출하세요.

JSON 형식:
{
  "strategy": {
    "shortTermConditions": ["단기 상승 조건1", "..."],
    "longTermConditions": ["장기 상승 조건1", "..."],
    "winningPatterns": ["수익 패턴1", "..."],
    "riskManagementRules": ["리스크 관리1", "..."]
  },
  "criteria": {
    "goodCompanyRules": [{ "rule": "규칙", "weight": 0.1~1.0 }],
    "idealMetricRanges": [{ "metric": "per"|"pbr"|"roe"|"dividendYield", "min": 0, "max": 0, "description": "..." }],
    "principles": [{ "principle": "원칙", "category": "entry"|"exit"|"risk"|"general" }]
  }
}

PDF 자료에서 추출한 주가 상승 핵심 조건들입니다:
${pdfConditions.substring(0, 15000)}`;

  let strategyData: any = {};
  
  if (pdfConditions.trim().length > 0) {
    try {
      const strategyResult = await strategyModel.generateContent(strategyPrompt);
      const strategyText = strategyResult.response.text();
      
      try {
        const jsonMatch = strategyText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          strategyData = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Strategy JSON parse error:', parseError);
      }
    } catch (error) {
      console.error('Strategy generation error:', error);
    }
  }
  
  const defaultSource: SourceReference = {
    fileName: '종합 전략 분석',
    type: 'pdf',
    pageOrTimestamp: '-',
    content: 'PDF 자료를 종합하여 도출된 투자 전략입니다.',
  };

  const defaultRules = [
    { rule: 'ROE 15% 이상을 3년 이상 유지하며 일반 기업 평균(8~12%)을 상회하는 수익성 확보', weight: 0.9, source: defaultSource },
    { rule: 'PER 10~20배 사이의 적정가치 구간에 위치하되, 업종 평균과 비교해 저평가 상태', weight: 0.8, source: defaultSource },
    { rule: 'PBR 1~2배 범위에서 ROE와 괴리가 없는 건전한 자산 구조', weight: 0.7, source: defaultSource },
    { rule: 'EV/EBITDA 10배 이하로 부채를 고려한 실제 기업가치가 적정', weight: 0.7, source: defaultSource },
    { rule: 'EPS 성장률 15% 이상 유지하며 PER 대비 성장성이 우수(PEG 1.5 이하)', weight: 0.8, source: defaultSource },
    { rule: '부채비율 100% 이하로 재무안정성 확보 및 이자상환능력 우수', weight: 0.6, source: defaultSource },
    { rule: 'FCF(잉여현금흐름) 양호하여 실제 현금 창출능력 보유', weight: 0.7, source: defaultSource },
  ];

  const defaultMetricRanges = [
    { metric: 'roe' as const, min: 15, description: 'ROE 15% 이상 유지 시 우량 기업으로 판단', source: defaultSource },
    { metric: 'per' as const, min: 10, max: 20, description: 'PER 10~20배 적정 구간, 10 이하 저평가, 30 이상 고평가', source: defaultSource },
    { metric: 'pbr' as const, min: 1, max: 2, description: 'PBR 1~2배 건전, 1 미만+저ROE 시 주의', source: defaultSource },
    { metric: 'dividendYield' as const, min: 2, max: 4, description: '배당수익률 2~4% 안정적, 5% 이상 시 주가하락 가능성', source: defaultSource },
  ];

  const defaultPrinciples = [
    { principle: '단일 지표가 아닌 ROE, PER, PBR, EV/EBITDA 등 다중 지표 종합 분석', category: 'general' as const, source: defaultSource },
    { principle: '업종 특성을 고려한 상대적 지표 비교 (업종 평균 대비)', category: 'general' as const, source: defaultSource },
    { principle: '강세장/약세장 시장 상황 반영 및 거시 경제 지표 고려', category: 'general' as const, source: defaultSource },
  ];

  const hasValidStrategy = strategyData.strategy?.shortTermConditions?.length > 0 ||
                          strategyData.strategy?.longTermConditions?.length > 0;
  
  const hasValidCriteria = strategyData.criteria?.goodCompanyRules?.length > 0;

  let usingFallbackRules = false;
  
  if (!hasValidCriteria) {
    console.log('⚠️ 규칙 생성 실패: 기본 규칙 7개를 적용합니다.');
    usingFallbackRules = true;
  }

  const strategy: InvestmentStrategy = {
    shortTermConditions: hasValidStrategy ? strategyData.strategy.shortTermConditions : ['거래량 급증 동반 상승', '전고점 돌파 패턴'],
    longTermConditions: hasValidStrategy ? strategyData.strategy.longTermConditions : ['독보적인 시장 점유율', '강력한 현금 흐름'],
    winningPatterns: hasValidStrategy ? strategyData.strategy.winningPatterns : ['실적 발표 후 갭상승 유지', '이동평균선 정배열'],
    riskManagementRules: hasValidStrategy ? strategyData.strategy.riskManagementRules : ['투자금의 10% 손절 기준 준수', '섹터 분산 투자'],
  };

  const fallbackSource: SourceReference = {
    fileName: '기본 투자 규칙 (AI 분석 실패 시 적용)',
    type: 'pdf',
    pageOrTimestamp: '-',
    content: usingFallbackRules 
      ? 'AI 분석에서 규칙 생성에 실패하여 기본 규칙 7개가 적용되었습니다.'
      : 'PDF 자료를 종합하여 도출된 투자 전략입니다.',
  };

  const criteria: LearnedInvestmentCriteria = {
    goodCompanyRules: hasValidCriteria 
      ? strategyData.criteria.goodCompanyRules.map((r: any) => ({
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
        }))
      : defaultRules.map(r => ({ ...r, source: fallbackSource })),
    idealMetricRanges: hasValidCriteria
      ? (strategyData.criteria.idealMetricRanges || []).map((r: any) => ({
          metric: r.metric,
          min: r.min,
          max: r.max,
          description: r.description || '',
          source: fallbackSource,
        }))
      : defaultMetricRanges.map(r => ({ ...r, source: fallbackSource })),
    principles: hasValidCriteria
      ? (strategyData.criteria.principles || []).map((p: any) => ({
          principle: p.principle,
          category: p.category || 'general',
          source: fallbackSource,
        }))
      : defaultPrinciples.map(p => ({ ...p, source: fallbackSource })),
  };
  
  console.log(`Final criteria: ${criteria.goodCompanyRules.length} rules, ${criteria.idealMetricRanges.length} metrics, ${criteria.principles.length} principles`);
  if (usingFallbackRules) {
    console.log('✅ 기본 규칙 7개가 성공적으로 적용되었습니다.');
  }

  const knowledge: LearnedKnowledge = {
    fileAnalyses,
    criteria,
    strategy,
    rawSummaries: files.map(f => ({ fileName: f.name, summary: '학습 완료된 자료' })),
    learnedAt: new Date(),
    sourceFiles: files.map((f) => f.name),
  };

  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));

  return knowledge;
}

async function extractFileContent(file: DriveFileInfo): Promise<string> {
  const mimeType = file.mimeType;

  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/vnd.google-apps.spreadsheet' ||
    mimeType?.startsWith('text/') ||
    mimeType?.includes('pdf')
  ) {
    return downloadTextContent(file.id);
  }

  if (mimeType?.startsWith('video/')) {
    return `[비디오 파일: ${file.name}]`;
  }

  return '';
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

export function getOpenAIClient(): any {
  return null;
}
