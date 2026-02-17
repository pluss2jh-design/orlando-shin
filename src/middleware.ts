import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const userRole = (req.auth?.user as any)?.role;
    const userPlan = (req.auth?.user as any)?.plan || 'free';

    // Admin routes protection
    if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn || userRole !== 'ADMIN') {
            return NextResponse.redirect(new URL("/login", nextUrl));
        }
    }

    // Stock Analysis page protection
    if (nextUrl.pathname.startsWith("/stock-analysis")) {
        if (!isLoggedIn) {
            return NextResponse.redirect(new URL("/login?callbackUrl=/stock-analysis", nextUrl));
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/admin/:path*", "/stock-analysis/:path*", "/inquiry/:path*"],
};
