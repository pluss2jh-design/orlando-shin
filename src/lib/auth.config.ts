import type { NextAuthConfig } from "next-auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

export const authConfig = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: false,
        }),
        KakaoProvider({
            clientId: process.env.KAKAO_CLIENT_ID,
            clientSecret: process.env.KAKAO_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            checks: ["state"],
        }),
        NaverProvider({
            clientId: process.env.NAVER_CLIENT_ID,
            clientSecret: process.env.NAVER_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            checks: ["state"],
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.role = user.role;
                token.plan = user.plan || 'free';
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
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
} satisfies NextAuthConfig;
