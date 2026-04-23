import { cn } from "@/lib/utils";
import { initials, pickColor } from "@/lib/colors";

type Size = "xs" | "sm" | "md" | "lg";

const sizeMap: Record<Size, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[10.5px]",
  md: "h-9 w-9 text-[12px]",
  lg: "h-12 w-12 text-[14px]",
};

export function Avatar({
  name, email, size = "sm", className, src, title,
}: {
  name?: string | null;
  email?: string | null;
  size?: Size;
  className?: string;
  src?: string | null;
  title?: string;
}) {
  const key = (email || name || "—").toLowerCase().trim();
  const color = pickColor(key);
  const text = initials(name);

  return (
    <span
      title={title ?? name ?? undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset font-semibold tracking-wide select-none",
        color.bg,
        color.fg,
        color.ring,
        sizeMap[size],
        className,
      )}
      aria-label={name ?? "Avatar"}
    >
      {src ? (
        <img
          src={src}
          alt={name ?? ""}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        text
      )}
    </span>
  );
}

/** Grupo de avatares empilhados com overflow em "+N" */
export function AvatarStack({
  items, max = 4, size = "sm",
}: {
  items: Array<{ name?: string | null; email?: string | null; src?: string | null }>;
  max?: number;
  size?: Size;
}) {
  const visible = items.slice(0, max);
  const extra = items.length - visible.length;
  const overlap = size === "xs" ? "-ml-1" : size === "lg" ? "-ml-2" : "-ml-1.5";
  return (
    <div className="inline-flex items-center">
      {visible.map((it, i) => (
        <Avatar
          key={i}
          name={it.name}
          email={it.email}
          src={it.src}
          size={size}
          className={cn(
            "ring-2 ring-[rgba(10,12,20,1)]",
            i > 0 && overlap,
          )}
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-white/[0.05] text-slate-300 ring-2 ring-[rgba(10,12,20,1)]",
            sizeMap[size],
            overlap,
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
