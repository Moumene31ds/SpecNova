import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto scrollbar-hide", className)}>
      <Link href="/" className="flex items-center gap-1 shrink-0 hover:text-foreground transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors whitespace-nowrap">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium whitespace-nowrap">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
