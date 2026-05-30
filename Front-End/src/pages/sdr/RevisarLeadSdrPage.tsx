import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Sparkles } from "@/components/icons";
import { LeadReviewSheet } from "@/components/sdr/LeadReviewSheet";
import { useSdrStore, useIsClient } from "@/lib/sdr/sdr-store";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function RevisarLeadSdrPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ready = useIsClient();
  const { leads } = useSdrStore();
  const { user } = useAuth();

  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-white/[0.04]" />
        <div className="h-[420px] animate-pulse rounded-xl bg-white/[0.02]" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-6">
        <h2 className="text-[14px] font-semibold text-rose-200">Lead não encontrado</h2>
        <p className="mt-1 text-[12px] text-slate-400">
          Esse lead pode ter sido revisado por outra pessoa ou não está mais na fila pendente.
        </p>
        <Link
          to="/sdr/cadastro-geral"
          className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-sky-400 hover:text-sky-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o cadastro geral
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb / cabeçalho da página */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/sdr/cadastro-geral"
            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-500 transition hover:text-slate-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Cadastro geral
          </Link>
          <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-slate-50">
            Revisando lead
          </h1>
          <p className="mt-0.5 text-[12.5px] text-slate-400">
            Confirme ou corrija os dados antes de aprovar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lead.sourceProvenance && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3 w-3" />
              {lead.sourceProvenance.webhookEvent ?? "Cloudia"}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider ring-1 ring-inset",
              lead.status === "pendente_revisao"
                ? "bg-amber-400/10 text-amber-200 ring-amber-400/30"
                : lead.status === "aprovado"
                ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30"
                : "bg-rose-400/10 text-rose-200 ring-rose-400/30",
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {lead.status === "pendente_revisao"
              ? "Pendente"
              : lead.status === "aprovado"
              ? "Aprovado"
              : "Rejeitado"}
          </span>
        </div>
      </div>

      {/* Formulário de revisão em modo página (sem overlay) */}
      <LeadReviewSheet
        lead={lead}
        mode="page"
        actor={user ? { name: user.name, email: user.email } : undefined}
        onClose={() => navigate("/sdr/cadastro-geral")}
      />
    </div>
  );
}
