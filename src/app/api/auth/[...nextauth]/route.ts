import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

console.log("Auth Options Loaded:", {
  hasSecret: !!authOptions.secret,
  secretLength: authOptions.secret?.length,
  trustHost: authOptions.trustHost,
  providers: authOptions.providers?.map((p: any) => p.id),
  envSecret: !!process.env.AUTH_SECRET,
});

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

export const { GET, POST } = handlers;
