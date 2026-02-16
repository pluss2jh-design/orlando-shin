'use client';

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  ArrowRight, 
  Brain, 
  TrendingUp, 
  User, 
  LogOut, 
  MessageSquare,
  BarChart3,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">주식 선생님</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : session ? (
              <>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-muted">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user?.image || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium">{session.user?.name || session.user?.email}</p>
                    <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link href="/login">
                  <User className="h-4 w-4 mr-2" />
                  로그인
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI 기반 주식 분석 시스템
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
              주식 선생님
            </h1>
            <p className="max-w-2xl mx-auto text-xl text-muted-foreground mb-8">
              Google Drive 자료를 학습하여 S&P 500, Russell 1000, Dow Jones 기업 중
              투자 조건에 맞는 최적의 기업을 추천해드립니다
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/stock-analysis">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  주식 분석 시작하기
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            <Link href="/stock-analysis" className="group">
              <div className="h-full p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors">
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  AI 주식 분석
                </h3>
                <p className="text-muted-foreground mb-4">
                  학습된 전략을 바탕으로 시장 유니버스에서 최적의 기업을 선별합니다
                </p>
                <div className="flex items-center text-sm text-primary">
                  분석하기 <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </Link>

            <Link href="/inquiry" className="group">
              <div className="h-full p-6 rounded-xl border bg-card hover:bg-accent/50 transition-colors">
                <div className="p-3 rounded-lg bg-blue-500/10 w-fit mb-4">
                  <MessageSquare className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-500 transition-colors">
                  1:1 고객 문의
                </h3>
                <p className="text-muted-foreground mb-4">
                  궁금하신 사항이나 문제가 있으시면 문의해주세요
                </p>
                <div className="flex items-center text-sm text-blue-500">
                  문의하기 <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </div>
            </Link>

            <div className="group">
              <div className="h-full p-6 rounded-xl border bg-card">
                <div className="p-3 rounded-lg bg-green-500/10 w-fit mb-4">
                  <Brain className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  AI 학습 시스템
                </h3>
                <p className="text-muted-foreground">
                  PDF, MP4 자료를 업로드하면 AI가 자동으로 학습하여 투자 전략을 수립합니다
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-muted p-8 text-center">
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={session.user?.image || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-semibold">{session.user?.name || session.user?.email}님</p>
                    <p className="text-sm text-muted-foreground">환영합니다!</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button asChild>
                    <Link href="/stock-analysis">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      주식 분석하기
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/inquiry">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      1:1 문의
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-lg font-medium">로그인하면 더 많은 기능을 이용할 수 있습니다</p>
                <p className="text-muted-foreground">
                  Google, Kakao, Naver 계정으로 간편하게 로그인하세요
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>© 2026 주식 선생님. All rights reserved.</p>
          <p className="mt-1">AI 기반 주식 투자 분석 서비스</p>
        </div>
      </footer>
    </div>
  );
}
