"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Clears the HttpOnly session cookie (handled by the Edge middleware at
 *  the configured logoutPath) then returns to the public site. */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await fetch("/api/signout", { method: "GET", cache: "no-store" });
    } catch {
      // cookie removal still happened via middleware response
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onSignOut} disabled={busy}>
      <LogOut className="size-4" />
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
