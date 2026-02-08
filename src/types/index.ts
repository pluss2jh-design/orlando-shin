export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: Date;
}

export interface Session {
  user: User;
  expires: string;
}
