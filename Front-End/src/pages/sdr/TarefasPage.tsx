import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CloudiaLegendBanner } from "@/components/sdr/CloudiaField";
import {
  addSdrTarefa,
  deleteSdrTarefa,
  updateSdrTarefa,
  useIsClient,
  useSdrStore,
} from "@/lib/sdr/sdr-store";
import type { SdrTarefa } from "@/types/sdr";
import { cn, formatNumber } from "@/lib/utils";

const STATUS_LABEL: Record<SdrTarefa["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const PRIORIDADE_TONE: Record<SdrTarefa["prioridade"], string> = {
  baixa: "bg-slate-500/10 text-slate-300 ring-slate-500/20",
  media: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  alta: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
};

export default function TarefasPage() {
  const ready = useIsClient();
  const { tarefas } = useSdrStore();
  const [filterStatus, setFilterStatus] = useState<"todas" | SdrTarefa["status"]>("todas");
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    if (filterStatus === "todas") return tarefas;
    return tarefas.filter((t) => t.status === filterStatus);
  }, [tarefas, filterStatus]);

  const grouped = useMemo(() => {
    const m: Record<string, SdrTarefa[]> = {};
    for (const t of filtered) {
      const key = t.dataVencimento.slice(0, 10);
      (m[key] ??= []).push(t);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = {
    pendentes: tarefas.filter((t) => t.status === "pendente").length,
    emAndamento: tarefas.filter((t) => t.status === "em_andamento").length,
    concluidas: tarefas.filter((t) => t.status === "concluida").length,
  };

  return (
    <div>
      <PageHeader
        badge="Seção 4 · Tarefas"
        title="Tarefas"
        description="Pendências da SDR — confirmações, retornos, envios. Tudo manual (Cloudia não traz tarefas)."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-400/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova tarefa
          </button>
        }
      />

      <CloudiaLegendBanner className="mb-5" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip
          label={`Todas · ${tarefas.length}`}
          active={filterStatus === "todas"}
          onClick={() => setFilterStatus("todas")}
        />
        <FilterChip
          label={`Pendentes · ${counts.pendentes}`}
          active={filterStatus === "pendente"}
          onClick={() => setFilterStatus("pendente")}
          tone="amber"
        />
        <FilterChip
          label={`Em andamento · ${counts.emAndamento}`}
          active={filterStatus === "em_andamento"}
          onClick={() => setFilterStatus("em_andamento")}
          tone="sky"
        />
        <FilterChip
          label={`Concluídas · ${counts.concluidas}`}
          active={filterStatus === "concluida"}
          onClick={() => setFilterStatus("concluida")}
          tone="emerald"
        />
      </div>

      {showForm && <NewTarefaForm onClose={() => setShowForm(false)} />}

      {ready && grouped.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-16 text-center">
          <p className="text-[12px] text-slate-500">Sem tarefas para esse filtro.</p>
        </div>
      )}

      {ready && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map(([day, items]) => {
            const today = new Date().toISOString().slice(0, 10);
            const isPast = day < today;
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
                  <h3 className="text-[12px] font-semibold capitalize text-slate-200">
                    {label}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      isToday
                        ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                        : isPast
                        ? "bg-rose-400/10 text-rose-300 ring-1 ring-inset ring-rose-400/20"
                        : "bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20",
                    )}
                  >
                    {isToday ? "Hoje" : isPast ? "Atrasada" : "Futura"} · {items.length}
                  </span>
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {items.map((t) => (
                    <TarefaRow key={t.id} tarefa={t} />
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="px-1 text-[11px] text-slate-500">
            {formatNumber(filtered.length)} tarefa(s) exibida(s)
          </p>
        </div>
      )}
    </div>
  );
}

function TarefaRow({ tarefa }: { tarefa: SdrTarefa }) {
  const isDone = tarefa.status === "concluida";
  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]">
      <button
        type="button"
        onClick={() =>
          updateSdrTarefa(tarefa.id, {
            status: isDone ? "pendente" : "concluida",
          })
        }
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
          isDone
            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
            : "border-white/[0.15] bg-transparent text-transparent hover:border-emerald-400/40 hover:text-emerald-300/40",
        )}
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-[12.5px] font-medium",
              isDone ? "text-slate-500 line-through" : "text-slate-100",
            )}
          >
            {tarefa.nome}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
              PRIORIDADE_TONE[tarefa.prioridade],
            )}
          >
            {tarefa.prioridade}
          </span>
        </div>
        {tarefa.descricao && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{tarefa.descricao}</p>
        )}
        <p className="mt-1.5 flex items-center gap-2 text-[10.5px] text-slate-500">
          <span>{STATUS_LABEL[tarefa.status]}</span>
          {tarefa.responsavel && (
            <>
              <span className="text-slate-700">·</span>
              <span>{tarefa.responsavel}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={tarefa.status}
          onChange={(e) => updateSdrTarefa(tarefa.id, { status: e.target.value as SdrTarefa["status"] })}
          className="h-7 rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 text-[11px] text-slate-300 focus:border-emerald-400/30 focus:outline-none"
        >
          <option value="pendente">Pendente</option>
          <option value="em_andamento">Em andamento</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <button
          type="button"
          onClick={() => deleteSdrTarefa(tarefa.id)}
          className="rounded-md border border-white/[0.06] bg-white/[0.02] p-1 text-slate-500 transition-colors hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300"
          aria-label="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function NewTarefaForm({ onClose }: { onClose: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [prioridade, setPrioridade] = useState<SdrTarefa["prioridade"]>("media");
  const [responsavel, setResponsavel] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    addSdrTarefa({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      dataVencimento: new Date(data).toISOString(),
      prioridade,
      status: "pendente",
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
        <Field label="Nome da tarefa *">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Confirmar agendamento João Silva"
            className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
            required
          />
        </Field>
        <Field label="Data de vencimento">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </Field>
        <Field label="Prioridade">
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as SdrTarefa["prioridade"])}
            className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </Field>
        <Field label="Responsável">
          <input
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="email@clinica.com"
            className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </Field>
        <Field label="Descrição" className="md:col-span-2">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400/40 focus:outline-none"
          />
        </Field>
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
          Criar tarefa
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone = "default",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "default" | "amber" | "sky" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "ring-amber-400/30 bg-amber-400/10 text-amber-200"
      : tone === "sky"
      ? "ring-sky-400/30 bg-sky-400/10 text-sky-200"
      : tone === "emerald"
      ? "ring-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : "ring-white/[0.06] bg-white/[0.02] text-slate-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors",
        active ? toneClass : "ring-white/[0.06] bg-transparent text-slate-400 hover:bg-white/[0.03]",
      )}
    >
      {label}
    </button>
  );
}
