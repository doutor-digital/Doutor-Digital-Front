import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, Search, User, X } from "lucide-react";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null;
  onChange: (leadId: number | null, leadName?: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LeadSelect({ value, onChange, placeholder = "Selecione um lead…", disabled }: Props) {
  const { tenantId, unitId } = useClinic();
  const clinicId = unitId || tenantId || undefined;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hoverIndex, setHoverIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "select", clinicId ?? null],
    queryFn: () => webhooksService.listLeads({ clinicId }),
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    const list = leads
      .map((l) => ({
        id: Number(l.id),
        name: (l.name ?? "").trim() || `Lead #${l.id}`,
        phone: l.phone ?? "",
      }))
      .filter((l) => Number.isFinite(l.id) && l.id > 0);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        String(l.id).includes(q) ||
        l.phone.toLowerCase().includes(q)
    );
  }, [leads, query]);

  const selected = useMemo(
    () => leads.find((l) => Number(l.id) === value),
    [leads, value]
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
      setTimeout(() => searchRef.current?.focus(), 20);
    }
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setHoverIndex(0);
  }, [query, open]);

  function pick(id: number, name: string) {
    onChange(id, name);
    setOpen(false);
    setQuery("");
  }

  function onListKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[hoverIndex];
      if (o) pick(o.id, o.name);
    }
  }

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index="${hoverIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hoverIndex]);

  const selectedName = selected?.name?.trim() || (value ? `Lead #${value}` : "");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm transition",
          "hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60",
          open && "ring-2 ring-brand-500/60 border-brand-500/60",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-6 w-6 shrink-0 grid place-items-center rounded-md",
              value
                ? "bg-gradient-to-br from-brand-500/80 to-accent-500/80 text-white"
                : "bg-white/5 text-slate-400"
            )}
          >
            <User className="h-3.5 w-3.5" />
          </span>
          <span className={cn("truncate", value ? "text-slate-100" : "text-slate-500")}>
            {value ? selectedName : placeholder}
          </span>
          {value ? (
            <span className="ml-1 text-[10px] text-slate-500 tabular-nums">#{value}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          {value ? (
            <span
              role="button"
              aria-label="Limpar"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setQuery("");
              }}
              className="h-5 w-5 grid place-items-center rounded text-slate-400 hover:text-slate-100 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-slate-400 transition-transform duration-200",
              open && "rotate-180 text-brand-300"
            )}
          />
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-50 mt-2 origin-top",
            "rounded-xl border border-white/10 bg-[#0d1425]/98 backdrop-blur shadow-2xl",
            "animate-fade-in"
          )}
        >
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKey}
                placeholder="Buscar por nome, telefone ou ID…"
                className={cn(
                  "w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100",
                  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:border-brand-500/60 transition"
                )}
              />
            </div>
          </div>

          <div
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1 scroll-smooth"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando leads…
              </div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhum lead encontrado
              </div>
            ) : (
              options.map((o, i) => {
                const active = i === hoverIndex;
                const isSelected = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    data-index={i}
                    onMouseEnter={() => setHoverIndex(i)}
                    onClick={() => pick(o.id, o.name)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                      active ? "bg-brand-500/15 text-slate-50" : "text-slate-200 hover:bg-white/5",
                      isSelected && "bg-brand-500/20"
                    )}
                  >
                    <span
                      className={cn(
                        "h-7 w-7 shrink-0 grid place-items-center rounded-md text-[11px] font-semibold",
                        isSelected
                          ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white"
                          : "bg-white/5 text-slate-300"
                      )}
                    >
                      {initials(o.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.name}</span>
                      <span className="block text-[11px] text-slate-500 tabular-nums">
                        #{o.id}
                        {o.phone ? ` · ${o.phone}` : ""}
                      </span>
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-brand-300 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/5 px-3 py-2 text-[10px] text-slate-500">
            <span>{options.length} resultado{options.length === 1 ? "" : "s"}</span>
            <span className="hidden sm:inline">↑↓ navegar · ⏎ selecionar · esc fechar</span>
          </div>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0][0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (a + b).toUpperCase();
}
