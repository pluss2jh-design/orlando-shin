import NextAuth from "next-auth";
import { prisma } from "@/lib/db";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";


export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  // Providers are merged from authConfig in auth.config.ts
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'kakao' || account?.provider === 'naver') {
        const dbUser = await prisma.user.findFirst({
          where: {
            provider: account.provider,
            providerAccountId: account.providerAccountId
          }
        });

        if (dbUser) {
          if (dbUser.suspendedUntil && new Date(dbUser.suspendedUntil) > new Date()) {
            return `/login?error=Suspended`;
          }
          // 이메일이나 프로필 사진이 변경되었다면 DB 업데이트
          if (user.email && (dbUser.email !== user.email || dbUser.image !== user.image)) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { email: user.email as string, image: user.image as string }
            });
          }
        } else {
          // dbUser가 없으면 최초 소셜 로그인으로 간주하고 필수 정보 입력 페이지로 이동
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          return `${baseUrl}/register/onboarding?email=${encodeURIComponent(user.email as string)}&name=${encodeURIComponent(user.name || '')}&provider=${account.provider}&providerAccountId=${encodeURIComponent(account.providerAccountId)}`;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // 1. 초기 로그인 시
      if (user && account) {
        token.sub = user.id;
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }

      // 2. 세션 업데이트 요청 시 (클라이언트에서 update() 호출)
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image) token.picture = session.image;
        if (session.plan) token.plan = session.plan;
      }

      // 3. 토큰 정보 유지 및 DB 데이터 동기화
      if (token.email && token.provider && token.providerAccountId) {
        try {
          const dbUser = await prisma.user.findFirst({
            where: {
              email: token.email as string,
              provider: token.provider as string,
              providerAccountId: token.providerAccountId as string
            },
            select: { id: true, name: true, image: true, plan: true, role: true, suspendedUntil: true, email: true, provider: true }
          });

          if (dbUser) {
            token.sub = dbUser.id;
            token.name = dbUser.name || token.name;
            token.picture = dbUser.image || token.picture;

            if (dbUser.suspendedUntil && new Date(dbUser.suspendedUntil) > new Date()) {
              token.role = 'SUSPENDED';
            } else if (dbUser.provider === 'google' && dbUser.email === 'pluss2.jh@gmail.com') {
              token.role = 'ADMIN';
              token.plan = 'MASTER';
            } else {
              token.plan = dbUser.plan || 'FREE';
              token.role = dbUser.role || 'USER';
            }
          }
        } catch (error) {
          console.error('Error fetching user for JWT:', error);
        }
      }

      // Assign features based on Plan enum
      const currentPlan = (token.plan as string || 'FREE').toUpperCase();
      let limit = 3;
      let email = false;

      if (currentPlan === 'MASTER') {
        limit = -1;
        email = true;
      } else if (currentPlan === 'PREMIUM') {
        limit = 10;
        email = true;
      } else if (currentPlan === 'STANDARD') {
        limit = 7;
        email = true;
      }

      token.features = {
        weeklyAnalysisLimit: limit,
        canSendEmail: email
      };

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.plan = token.plan;
        session.user.features = token.features || {};
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
        session.user.image = token.picture || session.user.image;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  debug: true,
});
