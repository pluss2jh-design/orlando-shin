import nodemailer from 'nodemailer';
import { AnalysisResult } from '@/types/stock-analysis';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@stockteacher.com';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export async function sendAnalysisEmail(
  to: string,
  results: AnalysisResult[],
  conditions: { periodMonths: number }
): Promise<void> {
  const html = generateEmailTemplate(results, conditions);
  
  await transporter.sendMail({
    from: `"주식 선생님" <${FROM_EMAIL}>`,
    to,
    subject: `[주식 선생님] AI 추천 TOP 5 기업 분석 결과`,
    html,
  });
}

function generateEmailTemplate(
  results: AnalysisResult[],
  conditions: { periodMonths: number }
): string {
  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const resultsHtml = results
    .map(
      (result, idx) => `
    <div style="
      background: #f8fafc;
      border-left: 4px solid #3b82f6;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <span style="
            background: #3b82f6;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: bold;
            margin-right: 8px;
          ">#${idx + 1}</span>
          <span style="font-size: 20px; font-weight: bold; color: #1e293b;">${result.companyName}</span>
          <span style="color: #64748b; margin-left: 8px;">${result.ticker}</span>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; color: #64748b;">${conditions.periodMonths}개월 예상 수익률</div>
          <div style="font-size: 28px; font-weight: bold; color: #22c55e;">
            +${calculateExpectedReturn(result.expectedReturnRate, conditions.periodMonths).toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <span style="font-weight: bold; color: #1e293b;">평가 점수:</span>
        <span style="font-size: 18px; font-weight: bold; color: #3b82f6;">
          ${result.totalRuleScore} / ${result.maxPossibleScore}점
        </span>
      </div>
      
      <div style="margin-bottom: 12px;">
        <span style="font-weight: bold; color: #1e293b;">AI 신뢰도:</span>
        <span style="color: #3b82f6;">${result.confidenceScore}%</span>
      </div>
      
      <div style="margin-bottom: 12px;">
        <span style="font-weight: bold; color: #1e293b;">리스크 평가:</span>
        <span style="
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          ${result.riskLevel === 'low' ? 'background: #dcfce7; color: #16a34a;' : 
            result.riskLevel === 'medium' ? 'background: #fef9c3; color: #ca8a04;' : 
            'background: #fee2e2; color: #dc2626;'}
        ">
          ${result.riskLevel === 'low' ? '낮은 위험' : result.riskLevel === 'medium' ? '중간 위험' : '높은 위험'}
        </span>
      </div>
      
      <div style="background: white; padding: 12px; border-radius: 6px; margin-top: 12px;">
        <div style="font-weight: bold; color: #1e293b; margin-bottom: 8px;">투자 논거</div>
        <p style="color: #475569; line-height: 1.6; margin: 0;">${result.reasoning}</p>
      </div>
    </div>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>주식 선생님 - AI 분석 결과</title>
    </head>
    <body style="
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      margin: 0;
      padding: 20px;
    ">
      <div style="
        max-width: 600px;
        margin: 0 auto;
        background: white;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      ">
        <div style="
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          padding: 30px;
          text-align: center;
        ">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">AI 추천 TOP 5 기업</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">주식 선생님 AI 분석 결과</p>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.8;">${currentDate}</p>
        </div>
        
        <div style="padding: 30px;">
          <div style="
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          ">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>분석 조건:</strong> 투자 기간 ${conditions.periodMonths}개월 | 
              S&P 500, Russell 1000, Dow Jones 기업 중 AI가 선정한 최적의 TOP 5 기업입니다.
            </p>
          </div>
          
          ${resultsHtml}
          
          <div style="
            margin-top: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            text-align: center;
          ">
            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">
              더 자세한 분석 결과와 실시간 정보는 웹사이트에서 확인하세요.
            </p>
            <a href="http://localhost:3000/stock-analysis" style="
              display: inline-block;
              background: #3b82f6;
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: bold;
            ">웹사이트에서 보기</a>
          </div>
          
          <div style="
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #94a3b8;
            font-size: 12px;
          ">
            <p style="margin: 0;">주식 선생님 | AI 기반 주식 분석 서비스</p>
            <p style="margin: 4px 0 0 0;">본 분석 결과는 투자 참고 자료이며, 투자 책임은 본인에게 있습니다.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function calculateExpectedReturn(baseReturn: number, periodMonths: number): number {
  const monthlyRate = baseReturn / 12;
  return monthlyRate * periodMonths;
}
