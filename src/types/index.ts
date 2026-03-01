export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  plan: "FREE" | "STANDARD" | "PREMIUM" | "MASTER";
  createdAt: Date;
}

export interface Session {
  user: User;
  expires: string;
}
