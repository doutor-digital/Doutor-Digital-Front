import { cn } from "@/lib/utils";

type Tone = "live" | "ok" | "warn" | "error" | "idle";

const COLOR: Record<Tone, string> = {
  live:  "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]",
  ok:    "bg-emerald-400",
  warn:  "bg-amber-400",
  error: "bg-rose-400",
  idle:  "bg-slate-500",
};

/** Dot com pulsação suave quando tone === "live". */
export function StatusDot({
  tone = "live", label, className,
}: {
  tone?: Tone;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-label={label ?? tone}
      className={cn("inline-flex items-center gap-1.5 text-[11px] text-slate-300", className)}
    >
      <span className="relative inline-flex h-2 w-2">
        {tone === "live" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", COLOR[tone])} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
