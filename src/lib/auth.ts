import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";


export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    ...authConfig.providers,
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const admin = await prisma.adminUser.findUnique({
          where: { email: credentials.email as string }
        });

        if (!admin) return null;

        const isValid = await bcrypt.compare(credentials.password as string, admin.password);

        if (isValid) {
          return {
            id: admin.id,
            email: admin.email,
            name: admin.email.split('@')[0],
            role: "ADMIN",
            plan: "premium",
          };
        }
        return null;
      }
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // 1. 초기 로그인 시
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.plan = (user as any).plan || 'free';
        token.membershipTier = (user as any).membershipTier || 'FREE';
      }

      // 2. 세션 업데이트 요청 시 (클라이언트에서 update() 호출)
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image) token.picture = session.image;
        if (session.plan) token.plan = session.plan;
        if (session.membershipTier) token.membershipTier = session.membershipTier;
      }

      // 3. 토큰 정보 유지 및 DB 데이터 동기화
      if (token.sub) {
        try {
          // 성능을 위해 매번 조회하기보다 필요할 때나 세션 갱신 시 조회
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { name: true, image: true, membershipTier: true, plan: true }
          });

          if (dbUser) {
            token.name = dbUser.name || token.name;
            token.picture = dbUser.image || token.picture;
            token.membershipTier = dbUser.membershipTier;
            token.plan = dbUser.plan || dbUser.membershipTier.toLowerCase();
          }
        } catch (error) {
          console.error('Error fetching user for JWT:', error);
        }
      }

      const adminEmails = ['pluss2.jh@gmail.com', 'slsl22.hn@gmail.com'];
      if (token.email && adminEmails.includes(token.email as string)) {
        token.role = 'ADMIN';
      }

      // Enrichment that requires file system - only in Node.js runtime
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
          const fs = require('fs/promises');
          const path = require('path');
          const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');
          const plansData = await fs.readFile(PLANS_FILE, 'utf-8');
          const plans = JSON.parse(plansData);
          const currentPlanId = (token.membershipTier as string || token.plan as string || 'free').toUpperCase();
          const userPlan = plans.find((p: any) => p.id.toUpperCase() === currentPlanId);
          
          if (userPlan) {
            token.features = userPlan.features.reduce((acc: any, f: any) => {
              acc[f.id] = f.enabled;
              return acc;
            }, {});
          }
        } catch (e) {
          console.error('Plan features fetch failed in Node JWT:', e);
        }
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.plan = token.plan;
        session.user.membershipTier = token.membershipTier;
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
  debug: false,
});
