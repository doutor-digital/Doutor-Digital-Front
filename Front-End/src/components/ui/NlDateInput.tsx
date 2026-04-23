import { useEffect, useState } from "react";
import { Calendar, Sparkles } from "lucide-react";
import { parseNaturalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Input "híbrido" — aceita "ontem", "há 3 dias", "última terça", além do formato ISO.
 * Faz debounce do parser. Exibe sugestão ao digitar.
 */
export function NlDateInput({
  value, onChange, placeholder = "ex.: ontem, há 3 dias, 12/04", className, disabled,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string>(value);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    const id = setTimeout(() => {
      const parsed = parseNaturalDate(text);
      setPreview(parsed);
    }, 220);
    return () => clearTimeout(id);
  }, [text]);

  const commit = () => {
    if (preview) {
      onChange(preview);
      setText(preview);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
        <Calendar className="h-3.5 w-3.5" />
      </span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full rounded-md border border-white/[0.08] bg-white/[0.02] py-2 pl-9 pr-3 text-[13px] text-slate-100",
          "placeholder:text-slate-600 focus:outline-none focus:border-white/[0.18] focus:bg-white/[0.03]",
        )}
      />
      {preview && preview !== text && (
        <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-emerald-300">
          <Sparkles className="h-3 w-3" />
          Interpretando como <strong className="font-mono">{preview}</strong>
          <button
            type="button"
            onClick={commit}
            className="ml-1 underline underline-offset-2 hover:text-emerald-200"
          >
            aceitar (Enter)
          </button>
        </div>
      )}
    </div>
  );
}
