import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-5xl font-bold tracking-tight">Orlando Shin</h1>
      <p className="max-w-lg text-center text-lg text-muted-foreground">
        Your SaaS platform — build, ship, and scale.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-accent"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
