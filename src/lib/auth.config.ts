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
                    if (!profile) return null as any;
                    const email = profile.kakao_account?.email || `${profile.id}@kakao.com`;
                    const nickname = profile.properties?.nickname || profile.kakao_account?.profile?.nickname || '카카오 사용자';
                    const image = profile.properties?.profile_image || profile.kakao_account?.profile?.profile_image_url;

                    return {
                        id: profile.id.toString(),
                        name: nickname,
                        email: email,
                        image: image,
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
