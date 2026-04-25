import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useGlobalUI } from "@/hooks/useGlobalUI";
import { useRecentNav } from "@/hooks/useRecentNav";
import { useShortcut } from "@/hooks/useShortcut";
import { cn } from "@/lib/utils";
import {
  PAGE_COMMANDS,
  buildActionCommands,
  scoreCommand,
  type CommandItem,
} from "./commandRegistry";

/**
 * ⌘K — paleta de comandos global.
 * - ⌘K / Ctrl+K abre/fecha.
 * - Esc fecha.
 * - ↑/↓ navega, Enter executa.
 * - Fuzzy match no título + keywords.
 */
export function CommandPalette({ extra = [] as CommandItem[] }) {
  const { open, setOpen } = useCommandPalette();
  const setActivityOpen = useGlobalUI((s) => s.setActivityOpen);
  const setAssistantOpen = useGlobalUI((s) => s.setAssistantOpen);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useShortcut("mod+k", () => useCommandPalette.getState().toggle());
  useShortcut("esc", () => setOpen(false), { enabled: open });

  const actionCommands = useMemo(
    () =>
      buildActionCommands({
        openActivityFeed: () => setActivityOpen(true),
        openAssistant: () => setAssistantOpen(true),
        refreshAll: () => {
          qc.invalidateQueries();
          toast.success("Dados recarregados");
        },
        copyCurrentUrl: async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success("URL copiada");
          } catch {
            toast.error("Falha ao copiar URL");
          }
        },
      }),
    [qc, setActivityOpen, setAssistantOpen],
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  const recent = useRecentNav((s) => s.recent);
  const recentCommands = useMemo<CommandItem[]>(() => {
    if (query) return [];
    const all = [...PAGE_COMMANDS, ...actionCommands];
    const lookup = new Map(all.filter((c) => c.to).map((c) => [c.to as string, c]));
    return recent
      .map((path) => lookup.get(path))
      .filter((c): c is CommandItem => !!c)
      .slice(0, 4)
      .map((c) => ({ ...c, id: `recent:${c.id}`, group: "Recentes" as const }));
  }, [recent, query, actionCommands]);

  const items = useMemo(() => {
    const all = [...recentCommands, ...PAGE_COMMANDS, ...actionCommands, ...extra];
    return all
      .map((c) => ({ c, score: scoreCommand(c, query) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [query, extra, actionCommands, recentCommands]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    items.forEach((it) => {
      if (!map.has(it.group)) map.set(it.group, []);
      map.get(it.group)!.push(it);
    });
    return Array.from(map.entries());
  }, [items]);

  const flat = items;

  const execute = (cmd: CommandItem) => {
    setOpen(false);
    if (cmd.action) cmd.action();
    if (cmd.to) navigate(cmd.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flat[selected];
      if (cmd) execute(cmd);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      <div
        className={cn(
          "relative w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-2xl",
          "border border-white/[0.08] bg-[rgba(12,14,22,0.96)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]",
          "animate-fade-in",
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar páginas, ações…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="flex-1 bg-transparent text-[14px] text-slate-100 outline-none placeholder:text-slate-500"
          />
          <Kbd>Esc</Kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-slate-500 transition hover:text-slate-200"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {grouped.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-slate-500">
              Nenhum resultado para{" "}
              <span className="text-slate-300">"{query}"</span>
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {group}
                </p>
                {list.map((c) => {
                  const idx = flat.findIndex((x) => x.id === c.id);
                  const isSel = idx === selected;
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseMove={() => setSelected(idx)}
                      onClick={() => execute(c)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition",
                        isSel
                          ? "bg-white/[0.07] text-slate-50"
                          : "text-slate-300 hover:bg-white/[0.03]",
                      )}
                    >
                      <Icon className="h-4 w-4 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{c.title}</p>
                        {c.subtitle && (
                          <p className="truncate text-[11px] text-slate-500">{c.subtitle}</p>
                        )}
                      </div>
                      {c.shortcut && (
                        <span className="text-[10px] text-slate-500">
                          {c.shortcut.split(" ").map((k, i) => (
                            <Kbd key={i} className="ml-1">{k}</Kbd>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.05] bg-white/[0.015] px-4 py-2 text-[10.5px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar</span>
            <span><Kbd>Enter</Kbd> selecionar</span>
            <span><Kbd>Esc</Kbd> fechar</span>
          </div>
          <span>{flat.length} {flat.length === 1 ? "resultado" : "resultados"}</span>
        </div>
      </div>
    </div>
  );
}

export function Kbd({
  children, className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-slate-300",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
