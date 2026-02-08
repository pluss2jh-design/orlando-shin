import Link from "next/link";
import { ArrowRight, Brain, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-primary/10">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <TrendingUp className="h-8 w-8 text-green-500" />
      </div>
      <h1 className="text-5xl font-bold tracking-tight">주식 선생님</h1>
      <p className="max-w-lg text-center text-lg text-muted-foreground">
        AI가 학습한 자료를 바탕으로 투자 조건에 맞는 최적의 기업을 추천해드립니다
      </p>
      <div className="flex gap-4">
        <Link
          href="/stock-analysis"
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          분석 시작하기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
