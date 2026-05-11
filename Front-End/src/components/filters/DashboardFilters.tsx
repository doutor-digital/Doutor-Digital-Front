import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  Building2,
  Calendar,
  ChevronDown,
  GitCompare,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Granularity = "day" | "week" | "month" | "quarter";
export type CompareMode = "none" | "previous_period" | "previous_year";

export interface DashboardFiltersState {
  preset: string;
  startDate: string;
  endDate: string;
  granularity: Granularity;
  compare: CompareMode;
  unitId?: number | null;
  attendantId?: number | null;
  source?: string | null;
}

export interface FilterOption {
  id: number | string;
  label: string;
}

interface Props {
  value: DashboardFiltersState;
  onChange: (f: DashboardFiltersState) => void;
  onSearch: () => void;
  units?: FilterOption[];
  attendants?: FilterOption[];
  sources?: string[];
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Hoje", value: "today", resolve: () => { const d = today(); return { start: d, end: d }; } },
  { label: "Ontem", value: "yesterday", resolve: () => { const d = offsetDay(-1); return { start: d, end: d }; } },
  { label: "7 dias", value: "7d", resolve: () => ({ start: offsetDay(-6), end: today() }) },
  { label: "14 dias", value: "14d", resolve: () => ({ start: offsetDay(-13), end: today() }) },
  { label: "30 dias", value: "30d", resolve: () => ({ start: offsetDay(-29), end: today() }) },
  { label: "90 dias", value: "90d", resolve: () => ({ start: offsetDay(-89), end: today() }) },
  { label: "Este mês", value: "this_month", resolve: () => ({ start: startOfMonth(0), end: today() }) },
  { label: "Mês anterior", value: "last_month", resolve: () => ({ start: startOfMonth(-1), end: endOfMonth(-1) }) },
  { label: "Trimestre", value: "this_quarter", resolve: () => ({ start: startOfQuarter(), end: today() }) },
  { label: "Este ano", value: "this_year", resolve: () => ({ start: `${new Date().getFullYear()}-01-01`, end: today() }) },
  { label: "Ano anterior", value: "last_year", resolve: () => { const y = new Date().getFullYear() - 1; return { start: `${y}-01-01`, end: `${y}-12-31` }; } },
];

const GRANULARITIES: { label: string; value: Granularity }[] = [
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
  { label: "Trimestre", value: "quarter" },
];

const COMPARE_MODES: { label: string; value: CompareMode }[] = [
  { label: "Nenhum", value: "none" },
  { label: "Período anterior", value: "previous_period" },
  { label: "Mesmo período/ano", value: "previous_year" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().slice(0, 10); }
function offsetDay(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function startOfMonth(o: number) { const d = new Date(); d.setMonth(d.getMonth() + o, 1); return d.toISOString().slice(0, 10); }
function endOfMonth(o: number) { const d = new Date(); d.setMonth(d.getMonth() + o + 1, 0); return d.toISOString().slice(0, 10); }
function startOfQuarter() { const m = new Date().getMonth(); const d = new Date(new Date().getFullYear(), Math.floor(m / 3) * 3, 1); return d.toISOString().slice(0, 10); }

export function defaultFilters(): DashboardFiltersState {
  return {
    preset: "30d",
    startDate: offsetDay(-29),
    endDate: today(),
    granularity: "day",
    compare: "none",
    unitId: null,
    attendantId: null,
    source: null,
  };
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 text-[11px] font-medium transition",
        active
          ? "bg-white/[0.08] text-slate-50 shadow-sm"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

// ─── Dropdown de Período ──────────────────────────────────────────────────────

function PeriodDropdown({
  value,
  onChange,
}: {
  value: DashboardFiltersState;
  onChange: (f: DashboardFiltersState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.preset === "custom");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function applyPreset(preset: string) {
    const p = PRESETS.find((x) => x.value === preset)!;
    const { start, end } = p.resolve();
    const isCustom = preset === "custom";
    setShowCustom(isCustom);
    onChange({ ...value, preset, startDate: start, endDate: end });
    if (!isCustom) setOpen(false);
  }

  const activePreset = PRESETS.find((p) => p.value === value.preset);
  const rangeLabel =
    value.startDate === value.endDate
      ? value.startDate
      : `${value.startDate} → ${value.endDate}`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition",
          "border bg-white/[0.02]",
          open
            ? "border-white/[0.18] text-slate-100 bg-white/[0.04]"
            : "border-white/[0.08] text-slate-300 hover:border-white/[0.14] hover:bg-white/[0.04]",
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-slate-500" />
        <span>{activePreset?.label ?? "Período"}</span>
        <span className="mx-1 h-3 w-px bg-white/[0.08]" />
        <span className="text-[10.5px] tabular-nums text-slate-500">{rangeLabel}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 w-[440px]",
            "rounded-xl border border-white/[0.07] bg-[#0a0a0d]",
            "shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]",
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">
              Selecionar período
            </span>
            <span className="rounded-md bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] px-2 py-0.5 text-[10.5px] tabular-nums text-slate-400">
              {rangeLabel}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 p-3">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => applyPreset(p.value)}
                className={cn(
                  "rounded-md px-3 py-2 text-left text-[12px] font-medium transition",
                  value.preset === p.value
                    ? "bg-white/[0.08] text-slate-50 ring-1 ring-inset ring-white/[0.1]"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                )}
              >
                {p.label}
              </button>
            ))}

            <button
              onClick={() => applyPreset("custom")}
              className={cn(
                "col-span-3 flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium transition",
                value.preset === "custom"
                  ? "bg-white/[0.08] text-slate-50 ring-1 ring-inset ring-white/[0.1]"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              Intervalo personalizado
            </button>
          </div>

          {showCustom && (
            <div className="border-t border-white/[0.05] px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    Início
                  </label>
                  <input
                    type="date"
                    value={value.startDate}
                    max={value.endDate}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        startDate: e.target.value,
                        preset: "custom",
                      })
                    }
                    className={cn(
                      "h-9 rounded-md border border-white/[0.08] bg-white/[0.02]",
                      "px-3 text-[12px] tabular-nums text-slate-200",
                      "outline-none transition focus:border-white/[0.18] focus:bg-white/[0.03]",
                      "[color-scheme:dark]",
                    )}
                  />
                </div>

                <span className="pb-2 text-slate-600">→</span>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                    Fim
                  </label>
                  <input
                    type="date"
                    value={value.endDate}
                    min={value.startDate}
                    max={today()}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        endDate: e.target.value,
                        preset: "custom",
                      })
                    }
                    className={cn(
                      "h-9 rounded-md border border-white/[0.08] bg-white/[0.02]",
                      "px-3 text-[12px] tabular-nums text-slate-200",
                      "outline-none transition focus:border-white/[0.18] focus:bg-white/[0.03]",
                      "[color-scheme:dark]",
                    )}
                  />
                </div>

                {(() => {
                  const diff = Math.round(
                    (new Date(value.endDate).getTime() -
                      new Date(value.startDate).getTime()) /
                      86_400_000,
                  );
                  return diff >= 0 ? (
                    <span className="pb-2 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-2.5 py-1 text-[11px] font-medium tabular-nums text-slate-300">
                      {diff + 1}d
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-white/[0.05] px-4 py-3">
            <button
              onClick={() => setOpen(false)}
              className="rounded-md bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-4 py-1.5 text-[12px] transition shadow-[0_4px_14px_-4px_rgba(16,185,129,0.35)]"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function FilterSelect({
  icon,
  label,
  value,
  onChange,
  options,
  emptyLabel = "Todos",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-slate-500">{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "ml-1 h-7 rounded-md border bg-white/[0.02] px-2 pr-7 text-[11.5px] font-medium",
          "text-slate-200 outline-none transition appearance-none",
          "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.04]",
          "focus:border-white/[0.2] focus:bg-white/[0.05]",
          "[color-scheme:dark]",
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 6px center",
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardFilters({
  value,
  onChange,
  onSearch,
  units = [],
  attendants = [],
  sources = [],
}: Props) {
  const isGranularity = (v: string) => value.granularity === v;
  const isCompare = (v: string) => value.compare === v;

  const unitOptions = units.map((u) => ({ id: String(u.id), label: u.label }));
  const attendantOptions = attendants.map((a) => ({
    id: String(a.id),
    label: a.label,
  }));
  const sourceOptions = sources.map((s) => ({ id: s, label: s }));

  const hasAdvanced =
    unitOptions.length > 0 || attendantOptions.length > 0 || sourceOptions.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl",
        "border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-white/[0.005]",
        "shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]",
        "px-4 py-3",
      )}
    >
    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-500" />

      <PeriodDropdown value={value} onChange={onChange} />

      <div className="h-5 w-px bg-white/[0.05]" />

      <div className="flex items-center gap-1.5">
        <BarChart2 className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Agrupar
        </span>
        <div className="ml-1 inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] gap-0.5">
          {GRANULARITIES.map((g) => (
            <FilterBtn
              key={g.value}
              active={isGranularity(g.value)}
              onClick={() => onChange({ ...value, granularity: g.value })}
            >
              {g.label}
            </FilterBtn>
          ))}
        </div>
      </div>

      <div className="h-5 w-px bg-white/[0.05]" />

      <div className="flex items-center gap-1.5">
        <GitCompare className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
          Comparar
        </span>
        <div className="ml-1 inline-flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06] gap-0.5">
          {COMPARE_MODES.map((c) => (
            <FilterBtn
              key={c.value}
              active={isCompare(c.value)}
              onClick={() => onChange({ ...value, compare: c.value })}
            >
              {c.label}
            </FilterBtn>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => onChange(defaultFilters())}
          title="Resetar filtros"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-white/[0.04] hover:text-slate-300"
        >
          <RotateCcw className="h-3 w-3" />
          Resetar
        </button>

        <button
          onClick={onSearch}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[12px] font-semibold transition",
            "bg-emerald-500 hover:bg-emerald-400 text-emerald-950",
            "shadow-[0_4px_14px_-4px_rgba(16,185,129,0.35)]",
          )}
        >
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
      </div>
    </div>

    {hasAdvanced && (
      <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.04] pt-2">
        {unitOptions.length > 0 && (
          <FilterSelect
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Unidade"
            value={value.unitId != null ? String(value.unitId) : ""}
            onChange={(v) =>
              onChange({ ...value, unitId: v ? Number(v) : null })
            }
            options={unitOptions}
            emptyLabel="Todas"
          />
        )}
        {attendantOptions.length > 0 && (
          <FilterSelect
            icon={<UserCog className="h-3.5 w-3.5" />}
            label="Atendente"
            value={value.attendantId != null ? String(value.attendantId) : ""}
            onChange={(v) =>
              onChange({ ...value, attendantId: v ? Number(v) : null })
            }
            options={attendantOptions}
            emptyLabel="Todos"
          />
        )}
        {sourceOptions.length > 0 && (
          <FilterSelect
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Origem"
            value={value.source ?? ""}
            onChange={(v) => onChange({ ...value, source: v || null })}
            options={sourceOptions}
            emptyLabel="Todas"
          />
        )}
      </div>
    )}
    </div>
  );
}
