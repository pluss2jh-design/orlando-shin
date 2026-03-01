import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: string;
    plan?: string;
    provider?: string;
    providerAccountId?: string;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      plan?: string;
      features?: Record<string, unknown>;
      provider?: string;
      providerAccountId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: string;
    plan?: string;
    provider?: string;
    providerAccountId?: string;
    features?: Record<string, unknown>;
  }
}
