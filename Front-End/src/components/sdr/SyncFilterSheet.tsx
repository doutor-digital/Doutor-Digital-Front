import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Clock,
  Building2,
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  Settings2,
  X,
  Info,
} from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { unitsService } from "@/services/units";
import type { Unit } from "@/types";
import type { SdrSyncFilters } from "@/services/sdr";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (filters: SdrSyncFilters) => Promise<void>;
  defaultUnitId?: number | null;
}

type ShiftPreset = "morning" | "overnight" | "custom" | "all";

const PRESETS: Array<{
  id: ShiftPreset;
  label: string;
  hint: string;
  icon: typeof Sun;
  range?: { start: string; end: string };
}> = [
  {
    id: "morning",
    label: "Turno manhã",
    hint: "08:00 → 12:00 (Brasília)",
    icon: Sun,
    range: { start: "08:00", end: "12:00" },
  },
  {
    id: "overnight",
    label: "Madrugada",
    hint: "20:00 → 07:50 (atravessa meia-noite)",
    icon: Moon,
    range: { start: "20:00", end: "07:50" },
  },
  {
    id: "custom",
    label: "Personalizado",
    hint: "Defina o início e o fim",
    icon: Settings2,
  },
  {
    id: "all",
    label: "Sem filtro de horário",
    hint: "Todo o intervalo de datas",
    icon: Clock,
  },
];

function formatLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SyncFilterSheet({
  open,
  onClose,
  onSubmit,
  defaultUnitId,
}: Props) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<number | "">(defaultUnitId ?? "");

  // Datas em horário local — o front envia ISO ao backend.
  const now = useMemo(() => new Date(), []);
  const lastWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const [from, setFrom] = useState<string>(formatLocalDateInput(lastWeek));
  const [to, setTo] = useState<string>(formatLocalDateInput(now));

  const [preset, setPreset] = useState<ShiftPreset>("morning");
  const [timeStart, setTimeStart] = useState<string>("08:00");
  const [timeEnd, setTimeEnd] = useState<string>("12:00");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    unitsService
      .list()
      .then((list) => {
        if (!cancelled) setUnits(list);
      })
      .catch(() => setUnits([]));
    return () => {
      cancelled = true;
    };
  }, [open]);

  function applyPreset(p: ShiftPreset) {
    setPreset(p);
    if (p === "morning") {
      setTimeStart("08:00");
      setTimeEnd("12:00");
    } else if (p === "overnight") {
      setTimeStart("20:00");
      setTimeEnd("07:50");
    }
  }

  async function handleSubmit() {
    if (!unitId) {
      alert("Selecione uma unidade — sem isso vai misturar dados de várias.");
      return;
    }
    setSubmitting(true);
    try {
      const filters: SdrSyncFilters = {
        unitId: Number(unitId),
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      };
      if (preset === "all") {
        // sem shift
      } else if (preset === "custom") {
        filters.shift = "custom";
        filters.timeStart = timeStart;
        filters.timeEnd = timeEnd;
      } else {
        filters.shift = preset;
      }
      await onSubmit(filters);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const crossesMidnight =
    preset === "overnight" ||
    (preset === "custom" && timeStart > timeEnd);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0a0a0d] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <div className="rounded-md bg-emerald-400/10 p-2 ring-1 ring-emerald-400/20">
            <RefreshCw className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-50">
              Sincronizar Kommo
            </h2>
            <p className="text-[11.5px] text-slate-500">
              Escolha unidade, intervalo e turno antes de puxar os leads.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Unidade */}
          <section>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Building2 className="h-3 w-3" />
              Unidade (obrigatório)
            </label>
            <select
              value={unitId}
              onChange={(e) =>
                setUnitId(e.target.value ? Number(e.target.value) : "")
              }
              className="mt-1.5 h-10 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-slate-100 focus:border-emerald-400/30 focus:outline-none"
            >
              <option value="">Selecione a unidade…</option>
              {units.map((u) => (
                <option key={String(u.id)} value={Number(u.id)}>
                  {u.name ?? `Unidade ${u.id}`} (#{u.clinicId ?? u.id})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Sem unidade, o backend traz tudo do tenant — pode misturar dados
              de várias clínicas.
            </p>
          </section>

          {/* Intervalo de datas */}
          <section>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <CalendarRange className="h-3 w-3" />
              Intervalo de datas
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500">De</span>
                <Input
                  type="datetime-local"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Até</span>
                <Input
                  type="datetime-local"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Turno */}
          <section>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Clock className="h-3 w-3" />
              Turno (janela de horário)
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={[
                      "flex items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-emerald-400/40 bg-emerald-400/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-emerald-300" : "text-slate-400",
                      ].join(" ")}
                    />
                    <div className="min-w-0">
                      <div
                        className={[
                          "text-[12.5px] font-medium",
                          active ? "text-emerald-200" : "text-slate-200",
                        ].join(" ")}
                      >
                        {p.label}
                      </div>
                      <div className="text-[10.5px] text-slate-500">
                        {p.hint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {preset === "custom" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500">Início</span>
                  <Input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Fim</span>
                  <Input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {crossesMidnight && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-[11.5px] text-cyan-100">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Esta janela <strong>atravessa meia-noite</strong>. O sistema vai
                considerar leads de {timeStart} até 23:59 + 00:00 até {timeEnd}.
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-6 py-3">
          <Button
            onClick={onClose}
            className="bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Sincronizando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Sincronizar agora
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
