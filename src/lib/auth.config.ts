import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

export const authConfig = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        KakaoProvider({
            clientId: process.env.KAKAO_CLIENT_ID,
            clientSecret: process.env.KAKAO_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        NaverProvider({
            clientId: process.env.NAVER_CLIENT_ID,
            clientSecret: process.env.NAVER_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.role = (user as any).role;
                token.plan = (user as any).plan || 'free';
            }
            return token;
        },
        async session({ session, token }: { session: any; token: any }) {
            if (session.user) {
                session.user.id = token.sub;
                session.user.role = token.role;
                session.user.plan = token.plan;
                session.user.features = token.features || {};
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
} satisfies NextAuthConfig;
