import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="container flex items-center justify-between text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
