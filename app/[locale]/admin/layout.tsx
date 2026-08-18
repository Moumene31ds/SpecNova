import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerTokens } from "@/lib/firebase/auth";
import { parseRoles } from "@/lib/firebase/roles";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/admin/sign-out";

/**
 * Admin Studio shell. The Edge middleware already blocks anonymous and
 * non-staff requests to /admin; this layout re-verifies from the session
 * cookie as defense-in-depth and renders the staff navigation.
 */
export default async function AdminLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  const tokens = await getServerTokens();
  const claims = tokens?.decodedToken;
  const roles = parseRoles(claims as unknown as Record<string, unknown> | undefined);

  if (!claims?.uid) redirect(`/${locale}/sign-in?redirect=/${locale}/admin`);
  if (!roles.isAdmin && !roles.isEditor) redirect(`/${locale}`);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}/admin`} className="font-display text-lg font-semibold tracking-tight">
              iToPhone <span className="text-primary">Admin</span>
            </Link>
            <Badge variant={roles.isAdmin ? "default" : "secondary"}>
              {roles.isAdmin ? "Admin" : "Editor"}
            </Badge>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link href={`/${locale}/admin`} className="rounded-lg px-3 py-1.5 hover:bg-secondary/60">
              Dashboard
            </Link>
            <Link href={`/${locale}/admin/devices/new`} className="rounded-lg px-3 py-1.5 hover:bg-secondary/60">
              New Device
            </Link>
            <Link href={`/${locale}/admin/devices/brand`} className="rounded-lg px-3 py-1.5 hover:bg-secondary/60">
              Brand Import
            </Link>
            <Link href={`/${locale}`} className="rounded-lg px-3 py-1.5 text-muted-foreground hover:bg-secondary/60">
              ← Back to site
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
