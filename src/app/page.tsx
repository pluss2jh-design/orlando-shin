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
import { UserMenu } from "@/components/shared/user-menu";

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f3f4f6]/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-black" />
            <span className="font-bold text-lg text-black">주식 선생님</span>
          </Link>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <UserMenu />
            ) : (
              <Button variant="default" size="sm" className="bg-black text-white hover:bg-black/90 rounded-full" asChild>
                <Link href="/login">
                  시작하기
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-16 px-4 min-h-[calc(100vh-64px)]">
        {/* Empty container for future use */}
      </main>

      <footer className="border-t border-gray-200 py-8 px-4 bg-white">
        <div className="container mx-auto max-w-7xl text-center text-sm text-gray-400 font-medium">
          <p>© 2026 주식 선생님. All rights reserved.</p>
          <p className="mt-1">AI Powered Stock Investment System</p>
        </div>
      </footer>
    </div>
  );
}
