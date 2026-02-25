import Link from "next/link";
import { siteConfig } from "@/config/site";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="mr-6 font-bold">
          {siteConfig.name}
        </Link>
        <nav className="flex flex-1 items-center gap-6 text-sm" />
        <div className="flex items-center gap-2">
          {session?.user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                {(session.user as any).provider === 'kakao' ? '🟡 ' : (session.user as any).provider === 'google' ? '🔵 ' : ''}
                {session.user.name || session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="sm">
                  Sign Out
                </Button>
              </form>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
