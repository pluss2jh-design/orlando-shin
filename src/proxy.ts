import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session = await auth();
  const user = session?.user;
  const isAdmin = (user as any)?.role === 'ADMIN';
  const isAuthenticated = !!user;

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
