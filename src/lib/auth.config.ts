import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

export const authConfig = {
    providers: [
        ...(process.env.GOOGLE_CLIENT_ID ? [
            GoogleProvider({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                allowDangerousEmailAccountLinking: true,
            })
        ] : []),
        ...(process.env.KAKAO_CLIENT_ID ? [
            KakaoProvider({
                clientId: process.env.KAKAO_CLIENT_ID,
                clientSecret: process.env.KAKAO_CLIENT_SECRET || undefined,
                allowDangerousEmailAccountLinking: true,
                profile(profile) {
                    const email = profile.kakao_account?.email || `kakao_${profile.id}@kakao.com`;
                    return {
                        id: profile.id.toString(),
                        name: profile.properties?.nickname || profile.kakao_account?.profile?.nickname,
                        email: email,
                        image: profile.properties?.profile_image || profile.kakao_account?.profile?.profile_image_url,
                    }
                },
                authorization: {
                    params: {
                        scope: "profile_nickname account_email",
                    },
                },
            })
        ] : []),
        ...(process.env.NAVER_CLIENT_ID ? [
            NaverProvider({
                clientId: process.env.NAVER_CLIENT_ID,
                clientSecret: process.env.NAVER_CLIENT_SECRET,
                allowDangerousEmailAccountLinking: true,
            })
        ] : []),
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
} satisfies NextAuthConfig;
