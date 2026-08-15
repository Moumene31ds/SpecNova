import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center pt-20 text-center">
      <p className="font-display text-8xl font-bold text-primary">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">
        Device not found in the index
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Try the AI search — if it doesn&apos;t surface the device, our
        Zero-Missing engine can scrape it live.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Open AI search
      </Link>
    </div>
  );
}
