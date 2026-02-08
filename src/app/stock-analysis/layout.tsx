import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주식 선생님 - AI 주식 투자 분석",
  description: "AI가 학습한 자료를 바탕으로 최적의 주식 투자 기업을 추천해드립니다",
};

export default function StockAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
