import { cn } from "@/lib/utils";

export function AuthHeroSide() {
  return (
    <div className="hidden lg:flex flex-col justify-between p-10 relative overflow-hidden">
      <img
        src="https://i.postimg.cc/DwB0GsB4/Chat-GPT-Image-23-de-abr-de-2026-15-36-56.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-contain object-center"
      />

      <div className="absolute inset-0 bg-gradient-to-br from-[#020B18]/95 via-[#052040]/80 to-[#020B18]/90" />

      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#0077CC]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#00AAFF]/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className={cn("h-10 w-10 shrink-0 overflow-hidden rounded-xl")}>
          <img
            src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
            alt="Doutor Digital"
            className="h-full w-full object-cover object-center"
          />
        </div>
        <span className="text-[15px] font-bold text-white tracking-tight">
          Doutor Digital
        </span>
      </div>

      <div className="relative space-y-5">
        <h2 className="text-3xl font-bold tracking-tight leading-snug text-white">
          Performance real de cada lead,
          <br />
          <span className="text-[#4DB8FF]">da origem ao fechamento.</span>
        </h2>

        <p className="text-sm text-slate-300 max-w-md leading-relaxed">
          Centralize webhooks da Cloudia e da Meta, acompanhe a evolução por
          etapa e descubra quais campanhas realmente convertem.
        </p>

        <ul className="space-y-2.5">
          {[
            "Funil de conversão consolidado",
            "Métricas ao vivo dos atendentes",
            "Alertas de SLA em tempo real",
            "Relatórios PDF automatizados",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0077CC]/30 ring-1 ring-[#0077CC]/50">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4DB8FF]" />
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative text-xs text-slate-600">
        © {new Date().getFullYear()} Doutor Digital — Todos os direitos reservados
      </div>
    </div>
  );
}
