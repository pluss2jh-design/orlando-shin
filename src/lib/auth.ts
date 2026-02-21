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
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'kakao' || account?.provider === 'naver') {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email as string }
        });

        // 비밀번호가 없으면 최초 소셜 로그인으로 간주하고 필수 정보 입력 페이지로 이동
        if (!dbUser || !dbUser.password) {
          return `/register/onboarding?email=${encodeURIComponent(user.email as string)}&name=${encodeURIComponent(user.name || '')}&provider=${account.provider}`;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // 1. 초기 로그인 시
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.plan = (user as any).plan || 'FREE';
      }

      // 2. 세션 업데이트 요청 시 (클라이언트에서 update() 호출)
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image) token.picture = session.image;
        if (session.plan) token.plan = session.plan;
      }

      // 3. 토큰 정보 유지 및 DB 데이터 동기화
      if (token.sub) {
        try {
          const [dbUser, adminUser] = await Promise.all([
            prisma.user.findUnique({
              where: { id: token.sub as string },
              select: { name: true, image: true, plan: true, email: true }
            }),
            prisma.adminUser.findUnique({
              where: { email: token.email as string }
            })
          ]);

          if (dbUser) {
            token.name = dbUser.name || token.name;
            token.picture = dbUser.image || token.picture;

            // AdminUser 테이블에 존재하는 경우 마스터 어드민 권한 부여
            if (adminUser || dbUser.email === 'pluss2.jh@gmail.com') {
              token.role = 'ADMIN';
              token.plan = 'MASTER';
            } else {
              token.plan = dbUser.plan || 'FREE';
              token.role = token.role || 'USER';
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
