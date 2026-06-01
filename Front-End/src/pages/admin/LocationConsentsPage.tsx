import { useQuery } from "@tanstack/react-query";
import { MapPin } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { adminLogsService } from "@/services/adminLogs";
import { roleLabel } from "@/lib/roles";

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

export default function LocationConsentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-location-consents"],
    queryFn: () => adminLogsService.locationConsents(),
    refetchInterval: 60_000,
  });

  const items = data ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Localizações ativadas"
        description="Quem autorizou compartilhar a localização precisa (GPS) e a última posição conhecida."
        badge="Logs avançados"
      />

      {isLoading ? (
        <p className="text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500">Ninguém ativou a localização ainda.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div
              key={c.userId}
              className="rounded-xl border border-white/[0.06] bg-slate-900/40 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-medium text-slate-100">{c.name ?? "—"}</div>
                  <div className="text-[11px] text-slate-500">{c.email}</div>
                </div>
                <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-300">
                  {roleLabel(c.role)}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-[12.5px] text-slate-400">
                <div>Consentiu em: {fmtDate(c.consentAt)}</div>
                <div>Cidade (IP): {c.geoCity ?? "—"}</div>
                <div>Último acesso: {fmtDate(c.lastSeenAt)}</div>
              </div>
              {c.latitude != null && c.longitude != null && (
                <a
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[12px] text-emerald-300 hover:bg-emerald-500/15"
                  href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" /> Ver no mapa
                  {c.accuracy != null && (
                    <span className="text-emerald-400/70">(±{Math.round(c.accuracy)}m)</span>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
