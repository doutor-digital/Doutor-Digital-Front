import { useMemo, useState } from "react";
import { CalendarRange, Clock, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import {
  addSdrEvento,
  deleteSdrEvento,
  updateSdrEvento,
  useIsClient,
  useSdrStore,
} from "@/lib/sdr/sdr-store";
import type { SdrAgendaEvento } from "@/types/sdr";
import { cn, formatNumber } from "@/lib/utils";

const STATUS_TONE: Record<SdrAgendaEvento["status"], string> = {
  agendado: "bg-sky-400/10 text-sky-200 ring-sky-400/20",
  confirmado: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20",
  cancelado: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
  realizado: "bg-violet-400/10 text-violet-200 ring-violet-400/20",
};

const STATUS_LABEL: Record<SdrAgendaEvento["status"], string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  realizado: "Realizado",
};

export default function AgendaPage() {
  const ready = useIsClient();
  const { agenda } = useSdrStore();
  const [showForm, setShowForm] = useState(false);

  const grouped = useMemo(() => {
    const m: Record<string, SdrAgendaEvento[]> = {};
    for (const e of agenda) {
      const key = e.data.slice(0, 10);
      (m[key] ??= []).push(e);
    }
    for (const key of Object.keys(m)) {
      m[key].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [agenda]);

  return (
    <div>
      <PageHeader
        badge="Seção 5 · Agenda / Eventos"
        title="Agenda"
        description="Compromissos, consultas marcadas e retornos."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo evento
          </button>
        }
      />

      <CloudiaLegendBanner className="mb-5" />

      {showForm && <NewEventoForm onClose={() => setShowForm(false)} />}

      {ready && grouped.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-16 text-center">
          <CalendarRange className="mx-auto h-8 w-8 text-slate-600" />
          <p className="mt-2 text-[12px] text-slate-500">Nenhum evento agendado.</p>
        </div>
      )}

      {ready && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(([day, events]) => {
            const today = new Date().toISOString().slice(0, 10);
            const isToday = day === today;
            const dt = new Date(day);
            const label = dt.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            });
            return (
              <div key={day} className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
                <div className="flex items-center justify-between border-b border-white/[0.04] bg-white/[0.02] px-4 py-2.5">
                  <h3 className="text-[12px] font-semibold capitalize text-slate-200">{label}</h3>
                  {isToday && (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                      Hoje
                    </span>
                  )}
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex w-20 shrink-0 flex-col items-center gap-0.5 rounded-md bg-white/[0.02] py-1.5">
                        <Clock className="h-3 w-3 text-slate-500" />
                        <span className="font-mono text-[11.5px] tabular-nums text-slate-200">
                          {e.horaInicio}
                        </span>
                        <span className="text-[10px] text-slate-500">até {e.horaFim}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[12.5px] font-medium text-slate-100">{e.nome}</p>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                              STATUS_TONE[e.status],
                            )}
                          >
                            {STATUS_LABEL[e.status]}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                          {e.descricao}
                        </p>
                        {e.observacao && (
                          <p className="mt-1 text-[10.5px] italic text-slate-500">
                            obs: {e.observacao}
                          </p>
                        )}
                        {e.responsavel && (
                          <p className="mt-1 text-[10px] text-slate-500">{e.responsavel}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={e.status}
                          onChange={(ev) => updateSdrEvento(e.id, { status: ev.target.value as SdrAgendaEvento["status"] })}
                          className="h-7 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 text-[11px] text-slate-300 focus:border-emerald-400/30 focus:outline-none"
                        >
                          <option value="agendado">Agendado</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="realizado">Realizado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteSdrEvento(e.id)}
                          className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1 text-slate-500 transition-colors hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="px-1 text-[11px] text-slate-500">
            {formatNumber(agenda.length)} evento(s)
          </p>
        </div>
      )}
    </div>
  );
}

function NewEventoForm({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("10:00");
  const [responsavel, setResponsavel] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    addSdrEvento({
      nome: nome.trim(),
      descricao: descricao.trim(),
      data: new Date(data).toISOString(),
      horaInicio,
      horaFim,
      status: "agendado",
      responsavel: responsavel.trim() || undefined,
    });
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.03] p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Nome do paciente *</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="João da Silva"
            className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Responsável</span>
          <input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="email@clinica.com"
            className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Hora início</span>
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Hora fim</span>
          <input
            type="time"
            value={horaFim}
            onChange={(e) => setHoraFim(e.target.value)}
            className="h-8 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="resize-y rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
            placeholder="Consulta inicial — hérnia inguinal"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-slate-300 hover:border-white/[0.15]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 hover:border-emerald-400/50"
        >
          Criar evento
        </button>
      </div>
    </form>
  );
}
