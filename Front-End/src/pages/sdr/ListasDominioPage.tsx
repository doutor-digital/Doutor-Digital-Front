import { BookOpen, CreditCard, MapPin, RotateCcw, Sparkles } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  CLOUDIA_FORMAS_PAGAMENTO,
  LEAD_MOTIVOS_NAO_AGENDAMENTO,
  LEAD_ORIGENS,
  RESGATE_ORIGENS,
  CLOUDIA_RESGATE_TIPO,
} from "@/lib/cadastra/lead-mapping";
import { SDR_FORMAS_PAGAMENTO } from "@/types/sdr";
import { MOTIVOS_NAO_FECHAMENTO_DEFAULT } from "@/types/cadastra";
import { cn } from "@/lib/utils";

// ---- Página de referência das listas fechadas que o sistema aceita ----
// Útil para a SDR consultar quando estiver revisando um lead e quiser saber
// quais valores são válidos. Tudo aqui é fonte canônica — quando a Cloudia
// envia um valor que não está na lista, o sistema joga em "Sem origem".

export default function ListasDominioPage() {
  const cadastroOrigens = LEAD_ORIGENS.filter((o) => !RESGATE_ORIGENS.includes(o));
  const motivosNaoFechamento = MOTIVOS_NAO_FECHAMENTO_DEFAULT;

  return (
    <div>
      <PageHeader
        badge="Seção 7 · Listas de domínio"
        title="Listas de referência"
        description="Valores aceitos pelo sistema para origem de lead, formas de pagamento, motivos. Cloudia preenche estes campos automaticamente."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReferenceCard
          icon={MapPin}
          title="Origens · Cadastro"
          subtitle={`${cadastroOrigens.length} valores · vêm do Kommo (data.origin)`}
          tone="emerald"
          items={cadastroOrigens.map((v) => ({ label: v }))}
          autoFromCloudia
        />
        <ReferenceCard
          icon={RotateCcw}
          title="Origens · Resgate"
          subtitle={`${RESGATE_ORIGENS.length} valores · classificam o lead automaticamente como "Resgate"`}
          tone="amber"
          items={RESGATE_ORIGENS.map((v) => ({
            label: v,
            sub: `→ Tipo: ${CLOUDIA_RESGATE_TIPO[v] ?? "—"}`,
          }))}
          autoFromCloudia
        />
        <ReferenceCard
          icon={CreditCard}
          title="Formas de pagamento (cadastra.ai)"
          subtitle={`${CLOUDIA_FORMAS_PAGAMENTO.length} valores · backend .NET (PaymentMethod)`}
          tone="sky"
          items={CLOUDIA_FORMAS_PAGAMENTO.map((v) => ({ label: v }))}
        />
        <ReferenceCard
          icon={CreditCard}
          title="Formas de pagamento (SDR)"
          subtitle={`${SDR_FORMAS_PAGAMENTO.length} valores · usados em consultas/tratamentos`}
          tone="violet"
          items={SDR_FORMAS_PAGAMENTO.map((v) => ({ label: v }))}
        />
        <ReferenceCard
          icon={BookOpen}
          title="Motivos para não agendamento"
          subtitle={`${LEAD_MOTIVOS_NAO_AGENDAMENTO.length} valores · aparecem no dropdown de revisão`}
          tone="slate"
          items={LEAD_MOTIVOS_NAO_AGENDAMENTO.map((v) => ({ label: v }))}
          fullWidth
        />
        <ReferenceCard
          icon={BookOpen}
          title="Motivos para não fechamento"
          subtitle={`${motivosNaoFechamento.length} valores · com semáforo de cor`}
          tone="rose"
          items={motivosNaoFechamento.map((m) => ({
            label: m.nome,
            sub: m.cor === "verde" ? "🟢 Positivo" : m.cor === "amarelo" ? "🟡 Em andamento" : "🔴 Negativo",
          }))}
          fullWidth
        />
      </div>
    </div>
  );
}

function ReferenceCard({
  icon: Icon,
  title,
  subtitle,
  tone,
  items,
  autoFromCloudia,
  fullWidth,
}: {
  icon: typeof BookOpen;
  title: string;
  subtitle: string;
  tone: "emerald" | "amber" | "sky" | "violet" | "rose" | "slate";
  items: { label: string; sub?: string }[];
  autoFromCloudia?: boolean;
  fullWidth?: boolean;
}) {
  const TONE = {
    emerald: "ring-emerald-400/25 bg-emerald-400/[0.04] text-emerald-300",
    amber: "ring-amber-400/25 bg-amber-400/[0.04] text-amber-300",
    sky: "ring-sky-400/25 bg-sky-400/[0.04] text-sky-300",
    violet: "ring-violet-400/25 bg-violet-400/[0.04] text-violet-300",
    rose: "ring-rose-400/25 bg-rose-400/[0.04] text-rose-300",
    slate: "ring-slate-500/25 bg-slate-500/[0.04] text-slate-300",
  } as const;
  return (
    <article
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.015] p-4",
        fullWidth && "lg:col-span-2",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset", TONE[tone])}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-slate-100">{title}</h3>
            <p className="mt-0.5 text-[10.5px] text-slate-500">{subtitle}</p>
          </div>
        </div>
        {autoFromCloudia && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
            <Sparkles className="h-2.5 w-2.5" />
            Auto · CRM
          </span>
        )}
      </header>

      <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between gap-2 rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5"
          >
            <span className="truncate text-[11.5px] text-slate-200">{it.label}</span>
            {it.sub && (
              <span className="shrink-0 text-[10px] text-slate-500">{it.sub}</span>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}
