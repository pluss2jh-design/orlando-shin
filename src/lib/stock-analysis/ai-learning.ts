import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
  startTime: null as Date | null,
};

function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }
  return new GoogleGenerativeAI(apiKey);
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

function hasActualAnalysis(keyConditions: string[]): boolean {
  if (!keyConditions || keyConditions.length === 0) return false;

  const placeholderPatterns = [
    '제공된 비디오 파일의 내용을 분석할 수 없어',
    '비디오 파일의 내용을 직접 분석할 수 없',
    '영상의 내용을 분석할 수 없',
    '파일의 내용을 분석할 수 없',
    '내용을 분석할 수 없어',
    '요약본을 제공해 주셔야',
    '파악할 수 없습',
  ];

  return !keyConditions.some(condition =>
    placeholderPatterns.some(pattern => condition.includes(pattern))
  );
}

export async function runLearningPipeline(
  targetFileIds?: string[],
  aiModels?: Record<string, string>
): Promise<LearnedKnowledge> {
  if (learningStatus.isLearning) {
    throw new Error('현재 다른 학습이 진행 중입니다. 잠시 후 다시 시도해주세요.');
  }

  learningStatus.isLearning = true;
  learningStatus.startTime = new Date();

  try {
    const syncResult = await listDriveFiles();
    const allFiles = syncResult.files;

    const files = targetFileIds && targetFileIds.length > 0
      ? allFiles.filter(f => targetFileIds.includes(f.id))
      : allFiles;

    if (files.length === 0) {
      throw new Error('Google Drive 폴터에 파일이 없습니다.');
    }

    console.log('All files from Google Drive:', files.map(f => ({ name: f.name, mimeType: f.mimeType })));

    let existingKnowledge: LearnedKnowledge | null = null;
    try {
      const activeKnowledge = await getActiveKnowledgeFromDB();
      if (activeKnowledge) {
        existingKnowledge = activeKnowledge;
        console.log('Loaded existing knowledge from DB with', existingKnowledge?.fileAnalyses?.length || 0, 'analyses');
      }
    } catch {
      console.log('No existing knowledge found in DB');
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

        if (!isPDFFile(file) && !isTextOrDocumentFile(file)) {
          console.log(`Skipping unsupported file: ${file.name}`);
          continue;
        }

        let content = '';
        let inlineDataPart: any = null;

        if (isPDFFile(file)) {
          console.log(`Downloading PDF directly: ${file.name}`);
          const fileBuffer = await downloadDriveFile(file.id, file.name);
          // downloadDriveFile returns a Buffer, no need for fs.readFile
          inlineDataPart = {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: 'application/pdf'
            }
          };
          content = '[PDF CONTENTS PASSED AS INLINE DATA]';
        } else if (isTextOrDocumentFile(file)) {
          content = await extractFileContent(file);
          console.log(`Extracted file content length: ${content.length} chars`);
        }

        if (!content || content.trim().length === 0) {
          console.log(`Skipping file ${file.name}: empty content`);
          continue;
        }

        console.log(`Processing file: ${file.name}`);

        const ext = getFileExt(file.name, file.mimeType);
        let chosenModelGrp = aiModels?.[ext];
        if (!chosenModelGrp || chosenModelGrp === 'gemini') chosenModelGrp = 'gemini-1.5-pro';

        const promptText = `당신은 전문 주식 투자 분석가입니다. 제공된 자료(PDF 또는 텍스트)에서 주가 상승 및 기업 분석에 핵심적인 "모든" 규칙과 지표를 최대한 많이 추출하세요.

특히 다음 요소들을 반드시 포함하여 상세하게 추출해 주세요:
1. 재무지표: ROE, PER, PBR, EPS 성장률, EV/EBITDA, 부채비율, FCF 등
2. 기술적 지표: 스토캐스틱(Stochastic), RSI, MACD, 이동평균선, 골든크로스 등
3. 시장 분석: TAM(전체시장), SAM(목표시장), SOM(수익시장) 규모 및 성장성
4. 수익성 지표: CAC(고객획득비용), LTV(고객생애가치), 공헌이익률 등
5. 기업 생애주기: 도입기, 성장기, 성숙기, 쇠퇴기 중 현재 단계 및 특징
6. 매수/매도 타이밍: 지금 매수해도 되는 구체적인 기술적/기본적 근거

중요: 자료에 언급된 수치나 구체적인 논리가 있다면 하나도 빠짐없이 "keyConditions" 배열에 담아주세요. 최소 10개 이상의 풍부한 조건을 추출하는 것이 목표입니다.

다음 형식의 JSON으로 응답하세요:
{
  "keyConditions": [
    "조건1: 구체적인 수치와 기준",
    "조건2: 구체적인 지표와 분석 기법",
    "..."
  ]
}

파일명: ${file.name}

내용:
${isPDFFile(file) ? '(첨부된 PDF 파일 참조)' : content.substring(0, 12000)}`;

        let responseText = '';

        if (chosenModelGrp.startsWith('gpt')) {
          if (isPDFFile(file)) {
            throw new Error(`GPT 모델은 PDF 직접 분석을 완벽하게 지원하지 않을 수 있으나 텍스트 변환기를 사용해야 합니다. (선택된 파일: ${file.name})`);
          }
          const openai = getOpenAIClient();
          const res = await openai.chat.completions.create({
            model: chosenModelGrp,
            messages: [{ role: 'user', content: promptText }]
          });
          responseText = res.choices[0].message.content || '';
        } else if (chosenModelGrp.startsWith('claude')) {
          const anthropic = getAnthropicClient();
          if (inlineDataPart) {
            const res = await anthropic.beta.messages.create({
              model: chosenModelGrp as any,
              betas: ["pdfs-2024-09-25"] as any,
              max_tokens: 4096,
              messages: [{
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: inlineDataPart.inlineData.data } } as any,
                  { type: 'text', text: promptText }
                ]
              }]
            });
            responseText = (res.content[0] as any).text || '';
          } else {
            const res = await anthropic.messages.create({
              model: chosenModelGrp as any,
              max_tokens: 4096,
              messages: [{ role: 'user', content: promptText }]
            });
            responseText = (res.content[0] as any).text || '';
          }
        } else {
          let activeModel = chosenModelGrp || 'gemini-1.5-pro';
          if (ext === 'mp4') {
            // 영상 분석시 더 높은 컨텍스트 길이/버전이 요구될 수 있습니다. 
            // 현재는 front에서 넘어온 activeModel을 그대로 쓰되 mp4 대응 처리가 필요하면 추가.
            activeModel = chosenModelGrp || 'gemini-2.5-pro';
          }
          const genAI = getGeminiClient();
          const model = genAI.getGenerativeModel({ model: activeModel });
          const promptParts = inlineDataPart ? [promptText, inlineDataPart] : promptText;
          const result = await model.generateContent(promptParts);
          responseText = result.response.text();
        }

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
      throw new Error('처리할 수 있는 파일이 없습니다. Google Drive에 지원되는 파일(PDF, 텍스트, 문서, MP4 등)이 있는지 확인해주세요.');
    }

    const documentAnalyses = fileAnalyses.filter(fa =>
      !isVideoFile({ name: fa.fileName, id: fa.fileId, mimeType: '' } as any)
    );
    console.log(`Document analyses count: ${documentAnalyses.length}`);

    const docConditions = documentAnalyses
      .flatMap(fa => fa.keyConditions)
      .join('\n');

    console.log(`Total Document conditions length: ${docConditions.length} chars`);
    console.log(`Document conditions preview: ${docConditions.substring(0, 500)}...`);

    const genAI = getGeminiClient();
    const strategyModel = genAI.getGenerativeModel({ model: 'gemini-2.0-pro-exp-02-05' });
    const strategyPrompt = `전설적인 투자 전략가로서 제공된 자료에서 추출된 핵심 조건들을 종합하여 포괄적인 투자 전략과 기업 선정 규칙을 도출하세요.

추출된 핵심 조건들:
${docConditions}

위 조건들을 바탕으로 다음 JSON 구조로 정리해 주세요.
다음 카테고리별로 규칙을 최대한 많이 추출하세요 (각 카테고리당 5~15개 이상):

1. 재무지표 규칙 (goodCompanyRules): ROE, PER, PBR, EPS, EV/EBITDA, 부채비율, FCF 등
2. 기술적 분석 규칙 (technicalRules): 스토캐스틱, RSI, MACD, 이동평균선, 볼린저밴드, 거래량 등
3. 시장 규모 규칙 (marketSizeRules): TAM, SAM, SOM, 시장 성장률, 시장 점유율 등
4. 단위 경제성 규칙 (unitEconomicsRules): CAC(고객획득비용), LTV(고객생애가치), 공헌이익률 등
5. 기업 생애주기 규칙 (lifecycleRules): 도입기, 성장기, 성숙기, 쇠퇴기별 투자 기준
6. 매수 타이밍 규칙 (buyTimingRules): 지금 당장 매수하기 좋은 시점 판단 기준

JSON 형식:
{
  "strategy": {
    "shortTermConditions": ["단기 상승 조건1", "..."],
    "longTermConditions": ["장기 상승 조건1", "..."],
    "winningPatterns": ["수익 패턴1", "..."],
    "riskManagementRules": ["리스크 관리1", "..."]
  },
  "criteria": {
    "goodCompanyRules": [{ "rule": "규칙", "weight": 0.1~1.0, "category": "fundamental"|"technical"|"market"|"unit_economics"|"lifecycle"|"timing"|"risk" }],
    "idealMetricRanges": [{ "metric": "per"|"pbr"|"roe"|"dividendYield", "min": 0, "max": 0, "description": "..." }],
    "principles": [{ "principle": "원칙", "category": "entry"|"exit"|"risk"|"general" }],
    "technicalRules": [{ "indicator": "스토캐스틱|RSI|MACD", "rule": "규칙", "weight": 0.1~1.0 }],
    "marketSizeRules": [{ "rule": "규칙", "weight": 0.1~1.0 }],
    "unitEconomicsRules": [{ "metric": "CAC|LTV|공헌이익률", "rule": "규칙", "weight": 0.1~1.0 }],
    "lifecycleRules": [{ "stage": "introduction|growth|maturity|decline", "rule": "규칙", "weight": 0.1~1.0 }],
    "buyTimingRules": [{ "rule": "규칙", "weight": 0.1~1.0, "conditions": ["조건1", "..."] }]
  }
}

PDF 자료에서 추출한 주가 상승 핵심 조건들입니다:
${docConditions.substring(0, 15000)}`;

    let strategyData: any = {};

    if (docConditions.trim().length > 0) {
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
      { rule: 'ROE 15% 이상을 3년 이상 유지하며 일반 기업 평균(8~12%)을 상회하는 수익성 확보', weight: 0.9, category: 'fundamental' as const, source: defaultSource },
      { rule: 'PER 10~20배 사이의 적정가치 구간에 위치하되, 업종 평균과 비교해 저평가 상태', weight: 0.8, category: 'fundamental' as const, source: defaultSource },
      { rule: 'PBR 1~2배 범위에서 ROE와 괴리가 없는 건전한 자산 구조', weight: 0.7, category: 'fundamental' as const, source: defaultSource },
      { rule: 'EV/EBITDA 10배 이하로 부채를 고려한 실제 기업가치가 적정', weight: 0.7, category: 'fundamental' as const, source: defaultSource },
      { rule: 'EPS 성장률 15% 이상 유지하며 PER 대비 성장성이 우수(PEG 1.5 이하)', weight: 0.8, category: 'fundamental' as const, source: defaultSource },
      { rule: '부채비율 100% 이하로 재무안정성 확보 및 이자상환능력 우수', weight: 0.6, category: 'fundamental' as const, source: defaultSource },
      { rule: 'FCF(잉여현금흐름) 양호하여 실제 현금 창출능력 보유', weight: 0.7, category: 'fundamental' as const, source: defaultSource },
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

    const defaultTechnicalRules = [
      { indicator: '스토캐스틱', rule: '스토캐스틱 %K가 %D를 상향 돌파하고 20 이하에서 상승할 때 매수', weight: 0.8 },
      { indicator: 'RSI', rule: 'RSI가 30 이하 과매도 구간에서 반등 시작 시 매수', weight: 0.7 },
      { indicator: 'MACD', rule: 'MACD가 시그널 선을 상향 돌파할 때 매수', weight: 0.7 },
      { indicator: '이동평균선', rule: '단기 이동평균선(5일, 20일)이 장기 이동평균선(60일) 위에 정배열', weight: 0.8 },
      { indicator: '거래량', rule: '주가 상승 시 거래량 동반 증가 확인', weight: 0.7 },
    ];

    const defaultMarketSizeRules = [
      { rule: 'TAM(전체시장)이 100억 달러 이상이며 연평균 성장률 10% 이상', weight: 0.7 },
      { rule: 'SAM(목표시장) 내 시장점유율 10% 이상이거나 증가 추세', weight: 0.6 },
      { rule: 'SOM(획득가능시장) 대비 매출 성장률이 시장 성장률보다 높음', weight: 0.6 },
    ];

    const defaultUnitEconomicsRules = [
      { metric: 'LTV/CAC', rule: 'LTV/CAC 비율이 3:1 이상이면 건전한 단위경제', weight: 0.8 },
      { metric: 'CAC', rule: 'CAC(고객획득비용)가 LTV의 30% 이하', weight: 0.7 },
      { metric: '공헌이익률', rule: '공헌이익률이 30% 이상이며 증가 추세', weight: 0.7 },
      { metric: '매출채권회전율', rule: '매출채권회전율이 업종 평균 이상', weight: 0.6 },
    ];

    const defaultLifecycleRules = [
      { stage: 'growth' as const, rule: '성장기 기업은 매출 성장률 20% 이상, 시장점유율 확대 중', weight: 0.8 },
      { stage: 'maturity' as const, rule: '성숙기 기업은 안정적 현금흐름, 높은 배당수익률', weight: 0.7 },
      { stage: 'introduction' as const, rule: '도입기 기업은 혁신적 제품, 높은 R&D 투자, 장기적 관점 필요', weight: 0.6 },
    ];

    const defaultBuyTimingRules = [
      { rule: '스토캐스틱이 과매도 구간(20 이하)에서 상향 반전', weight: 0.8, conditions: ['%K > %D', '%K < 20에서 상승'] },
      { rule: 'RSI가 30 이하 과매도 구간에서 반등 시작', weight: 0.7, conditions: ['RSI < 30', '상승 반전 확인'] },
      { rule: 'MACD 골든크로스 발생 (MACD 선이 시그널 선 상향 돌파)', weight: 0.7, conditions: ['MACD > Signal', '히스토그램 양전환'] },
      { rule: '주가가 20일 이동평균선을 상향 돌파', weight: 0.6, conditions: ['주가 > 20일 MA', '거래량 동반 증가'] },
      { rule: '실적 발표 후 주가 조정 완료 및 재상승 시작', weight: 0.7, conditions: ['실적 양호', '주가 조정 후 반등'] },
      { rule: '대형 기관의 순매수 전환 및 보유 비중 증가', weight: 0.6, conditions: ['기관 순매수', '보유 비중 증가'] },
    ];

    const criteria: LearnedInvestmentCriteria = {
      goodCompanyRules: hasValidCriteria
        ? strategyData.criteria.goodCompanyRules.map((r: any) => ({
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
          category: r.category || 'fundamental',
        }))
        : defaultRules.map(r => ({ ...r, category: 'fundamental' as const, source: fallbackSource })),
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
      technicalRules: hasValidCriteria && strategyData.criteria?.technicalRules?.length > 0
        ? strategyData.criteria.technicalRules.map((r: any) => ({
          indicator: r.indicator,
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
        }))
        : defaultTechnicalRules.map(r => ({ ...r, source: fallbackSource })),
      marketSizeRules: hasValidCriteria && strategyData.criteria?.marketSizeRules?.length > 0
        ? strategyData.criteria.marketSizeRules.map((r: any) => ({
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
        }))
        : defaultMarketSizeRules.map(r => ({ ...r, source: fallbackSource })),
      unitEconomicsRules: hasValidCriteria && strategyData.criteria?.unitEconomicsRules?.length > 0
        ? strategyData.criteria.unitEconomicsRules.map((r: any) => ({
          metric: r.metric,
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
        }))
        : defaultUnitEconomicsRules.map(r => ({ ...r, source: fallbackSource })),
      lifecycleRules: hasValidCriteria && strategyData.criteria?.lifecycleRules?.length > 0
        ? strategyData.criteria.lifecycleRules.map((r: any) => ({
          stage: r.stage || 'growth',
          rule: r.rule,
          weight: r.weight || 0.5,
          source: fallbackSource,
        }))
        : defaultLifecycleRules.map(r => ({ ...r, source: fallbackSource })),
      buyTimingRules: hasValidCriteria && strategyData.criteria?.buyTimingRules?.length > 0
        ? strategyData.criteria.buyTimingRules.map((r: any) => ({
          rule: r.rule,
          weight: r.weight || 0.5,
          conditions: r.conditions || [],
          source: fallbackSource,
        }))
        : defaultBuyTimingRules.map(r => ({ ...r, source: fallbackSource })),
    };

    console.log(`Final criteria: ${criteria.goodCompanyRules.length} fundamental rules, ${criteria.technicalRules.length} technical rules, ${criteria.marketSizeRules.length} market rules, ${criteria.unitEconomicsRules.length} unit economics rules, ${criteria.lifecycleRules.length} lifecycle rules, ${criteria.buyTimingRules.length} buy timing rules`);
    if (usingFallbackRules) {
      console.log('✅ 기본 규칙 30+개가 성공적으로 적용되었습니다.');
    }

    const knowledge: LearnedKnowledge = {
      fileAnalyses,
      criteria,
      strategy,
      rawSummaries: files.map(f => ({ fileName: f.name, summary: '학습 완료된 자료' })),
      learnedAt: new Date(),
      sourceFiles: files.map((f) => f.name),
    };



    return knowledge;
  } finally {
    learningStatus.isLearning = false;
    learningStatus.startTime = null;
  }
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

export async function saveKnowledgeToDB(knowledge: LearnedKnowledge, title?: string): Promise<string> {
  const result = await prisma.learnedKnowledge.create({
    data: {
      title: title || `Learning Session ${new Date().toLocaleString()}`,
      content: knowledge as any,
      files: knowledge.sourceFiles as any,
      isActive: false, // 기본적으로는 비활성, 사용자가 나중에 활성화
    }
  });
  return result.id;
}

export async function getActiveKnowledgeFromDB(): Promise<LearnedKnowledge | null> {
  const active = await prisma.learnedKnowledge.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  });

  if (active) {
    return active.content as unknown as LearnedKnowledge;
  }
  return null;
}

export async function getLearnedKnowledge(): Promise<LearnedKnowledge | null> {
  // DB에서 활성화된 지식만 찾기
  try {
    const activeKnowledge = await getActiveKnowledgeFromDB();
    if (activeKnowledge) return activeKnowledge;
  } catch (error) {
    console.error('Failed to fetch active knowledge from DB:', error);
  }
  return null;
}

export async function hasLearnedKnowledge(): Promise<boolean> {
  const count = await prisma.learnedKnowledge.count({
    where: { isActive: true }
  });
  return count > 0;
}
