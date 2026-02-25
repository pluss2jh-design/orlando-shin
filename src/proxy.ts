import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth({
...authConfig,
secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],
});

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await auth();
  const user = session?.user;
  const isAdmin = (user as any)?.role === 'ADMIN';
  const isAuthenticated = !!user;
  const isOnboarded = !!user?.name; // 닉네임이 있으면 온보딩 완료로 간주

  // 로그인한 사용자가 온보딩이 안되어 있다면 온보딩 페이지로 강제 이동 (온보딩 페이지 자체는 제외)
  if (isAuthenticated && !isOnboarded && pathname !== '/register/onboarding' && !pathname.startsWith('/api')) {
    const onboardingUrl = new URL('/register/onboarding', request.url);
    onboardingUrl.searchParams.set('email', user?.email || '');
    onboardingUrl.searchParams.set('name', user?.name || '');
    onboardingUrl.searchParams.set('provider', (user as any)?.provider || '');
    onboardingUrl.searchParams.set('providerAccountId', (user as any)?.providerAccountId || '');
    return NextResponse.redirect(onboardingUrl);
  }

  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login?callbackUrl=' + pathname, request.url));
    }

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/?error=unauthorized', request.url));
    }

    return NextResponse.next();
  }

  if (pathname === '/stock-analysis') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/login?callbackUrl=/stock-analysis', request.url));
    }

    return NextResponse.next();
  }

  if (pathname === '/login' && isAuthenticated) {
    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/stock-analysis', request.url));
  }

  if (pathname === '/register' && isAuthenticated) {
    return NextResponse.redirect(new URL('/stock-analysis', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/stock-analysis',
    '/login',
    '/register',
    '/api/admin/:path*',
  ],
};
