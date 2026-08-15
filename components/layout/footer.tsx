import Link from "next/link";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-10">
      <div className="container flex flex-col items-center justify-between gap-6 md:flex-row">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} SpecNova — The 100% coverage phone
          intelligence engine.
        </p>
        <div className="flex items-center gap-4 text-muted-foreground">
          <Link
            href="/bands"
            className="text-sm transition-colors hover:text-foreground"
          >
            Carrier Bands
          </Link>
          <Link
            href="/api/health"
            className="text-sm transition-colors hover:text-foreground"
          >
            Status
          </Link>
          <div className="flex items-center gap-2">
            <a
              aria-label="GitHub"
              href="https://github.com"
              className="transition-colors hover:text-foreground"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              aria-label="X"
              href="https://x.com"
              className="transition-colors hover:text-foreground"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
