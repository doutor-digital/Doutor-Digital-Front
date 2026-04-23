import { ReactNode, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Wrapper que copia `value` ao clicar e dá feedback inline (✓ por 1.2s).
 * Sem toast — feedback discreto, in situ.
 */
export function CopyInline({
  value, children, className, title,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (tRef.current) clearTimeout(tRef.current);
      tRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      /* silencioso */
    }
  };

  return (
    <button
      type="button"
      title={title ?? "Clique para copiar"}
      onClick={copy}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition",
        "hover:bg-white/[0.04]",
        copied && "text-emerald-300",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      )}
    </button>
  );
}
