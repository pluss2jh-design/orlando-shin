export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-muted/40 md:block">
        <nav className="flex h-full flex-col gap-2 p-4">
          <h2 className="mb-4 text-lg font-semibold">Dashboard</h2>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
