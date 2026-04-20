import { cn } from "@/lib/utils";

export const RANK_STYLE = [
  { bg: "bg-amber-400/15", text: "text-amber-300", ring: "ring-amber-400/30" },
  { bg: "bg-slate-300/10", text: "text-slate-200", ring: "ring-slate-300/20" },
  { bg: "bg-orange-400/15", text: "text-orange-300", ring: "ring-orange-400/25" },
] as const;

export function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLE[rank - 1];
  if (!style) {
    return (
      <span className="h-6 w-6 shrink-0 grid place-items-center rounded-md text-[10px] font-mono tabular-nums text-slate-600 bg-white/[0.02] ring-1 ring-inset ring-white/[0.05]">
        {String(rank).padStart(2, "0")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "h-6 w-6 shrink-0 grid place-items-center rounded-md text-[10px] font-mono tabular-nums ring-1 ring-inset",
        style.bg,
        style.text,
        style.ring,
      )}
    >
      {String(rank).padStart(2, "0")}
    </span>
  );
}
