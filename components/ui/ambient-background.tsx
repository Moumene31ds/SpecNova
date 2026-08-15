import { cn } from "@/lib/utils";

/**
 * Fixed, performance-cheap ambient background: two drifting glow blobs
 * tinted with the active brand color, over a faint cyber grid.
 */
export function AmbientBackground({
  accent = "hsl(var(--glow-primary))",
  className,
}: {
  accent?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
    >
      <div className="cyber-grid-bg absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_70%)]" />
      <div
        className="glow-blob left-[-10%] top-[-15%] h-[42rem] w-[42rem] animate-aurora-drift"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 34%, transparent) 0%, transparent 65%)`,
        }}
      />
      <div
        className="glow-blob right-[-12%] top-[30%] h-[38rem] w-[38rem] animate-aurora-drift [animation-delay:-6s]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, hsl(var(--glow-accent)) 26%, transparent) 0%, transparent 65%)",
        }}
      />
      <div
        className="glow-blob bottom-[-20%] left-[30%] h-[40rem] w-[40rem] animate-aurora-drift [animation-delay:-12s]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${accent} 22%, transparent) 0%, transparent 65%)`,
        }}
      />
    </div>
  );
}
