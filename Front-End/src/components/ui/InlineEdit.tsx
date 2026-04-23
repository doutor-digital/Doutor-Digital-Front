import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Clique-para-editar. Mostra o valor; ao clicar (ou Enter quando focado),
 * vira input; Enter confirma, Esc cancela.
 */
export function InlineEdit({
  value,
  onChange,
  placeholder = "—",
  className,
  inputClassName,
  /** validate opcional; se retornar string, vira mensagem de erro */
  validate,
  /** aria label se o valor é vazio */
  label,
}: {
  value: string;
  onChange: (v: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  validate?: (v: string) => string | null;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  }, [editing, value]);

  const commit = async () => {
    const v = draft.trim();
    if (v === value) {
      setEditing(false);
      return;
    }
    const err = validate?.(v) ?? null;
    if (err) {
      setError(err);
      return;
    }
    try {
      setSaving(true);
      await onChange(v);
      setEditing(false);
    } catch {
      setError("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={label ? `Editar ${label}` : "Editar"}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition",
          "hover:bg-white/[0.04]",
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            value ? "text-slate-200" : "italic text-slate-500",
          )}
        >
          {value || placeholder}
        </span>
        <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!saving) commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        disabled={saving}
        className={cn(
          "rounded-md border border-emerald-500/40 bg-white/[0.03] px-1.5 py-0.5 text-[13px] text-slate-100 outline-none",
          "focus:border-emerald-400",
          inputClassName,
        )}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        disabled={saving}
        aria-label="Confirmar"
        className="rounded p-0.5 text-emerald-300 hover:bg-emerald-500/10"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setEditing(false)}
        disabled={saving}
        aria-label="Cancelar"
        className="rounded p-0.5 text-rose-300 hover:bg-rose-500/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {error && (
        <span className="ml-1 text-[10.5px] text-rose-400">{error}</span>
      )}
    </div>
  );
}
