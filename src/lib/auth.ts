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
    async jwt({ token, user, profile, account }) {
      // Basic token enrichment
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.plan = (user as any).plan || 'free';
      }

      if (profile) {
        token.name = profile.name || (profile as any).nickname || (profile as any).preferred_username || (profile as any).kakao_account?.profile?.nickname;
        token.email = profile.email || (profile as any).kakao_account?.email || token.email;
        token.picture = (profile as any).picture || (profile as any).image_url || (profile as any).avatar_url || (profile as any).kakao_account?.profile?.profile_image_url;
      }

      const adminEmails = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];
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
          const userPlan = plans.find((p: any) => p.id.toLowerCase() === (token.plan as string || 'free').toLowerCase());
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
