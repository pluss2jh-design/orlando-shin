import NextAuth, { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const providers: any[] = [
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
          provider: "credentials",
        };
      }
      return null;
    }
  }),
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code"
      }
    }
  }),
  KakaoProvider({
    clientId: process.env.KAKAO_CLIENT_ID,
    clientSecret: process.env.KAKAO_CLIENT_SECRET,
  }),
];

if (process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET) {
  providers.push(
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID,
      clientSecret: process.env.NAVER_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow sign in
      return true;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.provider = token.provider;
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
        session.user.image = token.picture || session.user.image;
        session.user.role = token.role;
        session.user.plan = token.plan;
        session.user.features = token.features;
      }
      return session;
    },
    async jwt({ token, user, account, profile }: any) {
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role;
        token.plan = (user as any).plan || 'free';

        try {
          const fs = require('fs/promises');
          const path = require('path');
          const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');
          const plansData = await fs.readFile(PLANS_FILE, 'utf-8');
          const plans = JSON.parse(plansData);
          const userPlan = plans.find((p: any) => p.id.toLowerCase() === token.plan.toLowerCase());
          if (userPlan) {
            token.features = userPlan.features.reduce((acc: any, f: any) => {
              acc[f.id] = f.enabled;
              return acc;
            }, {});
          }
        } catch (e) {
          console.error('Plan features fetch failed:', e);
          token.features = {};
        }
      }

      if (account) {
        token.provider = account.provider;
      }

      if (profile) {
        // Extract name from different providers
        token.name = profile.name ||
          profile.nickname ||
          profile.preferred_username ||
          profile.kakao_account?.profile?.nickname;

        // Extract email from different providers
        token.email = profile.email ||
          profile.kakao_account?.email ||
          token.email;

        // Extract picture from different providers
        token.picture = profile.picture ||
          profile.image_url ||
          profile.avatar_url ||
          profile.kakao_account?.profile?.profile_image_url;
      }

      const adminEmails = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];
      if (token.email && adminEmails.includes(token.email as string)) {
        token.role = 'ADMIN';
      }

      return token;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  secret: process.env.AUTH_SECRET,
});
