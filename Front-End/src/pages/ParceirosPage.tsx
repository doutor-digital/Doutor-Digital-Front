import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarCheck,
  DollarSign,
  Link2,
  Search,
  TrendingUp,
  Users,
} from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { partnersService, type PartnerOverview } from "@/services/partners";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

type SortKey = "leads30d" | "totalLeads" | "agendados" | "faturamento" | "name";

/** Considera o parceiro "sem movimento" quando não recebe lead há mais de 7 dias. */
const STALE_DAYS = 7;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Logo do parceiro com fallback para as iniciais (várias logos antigas quebram). */
function PartnerLogo({ partner }: { partner: PartnerOverview }) {
  const [broken, setBroken] = useState(false);
  const show = partner.photoUrl && !broken;

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.03]">
      {show ? (
        <img
          src={partner.photoUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
          draggable={false}
        />
      ) : (
        <span className="text-[11px] font-semibold text-slate-400">
          {initials(partner.name)}
        </span>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03]">
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-0.5 text-lg font-semibold text-slate-100">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

export default function ParceirosPage() {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"todos" | "saude" | "juridico">("todos");
  const [onlyActive, setOnlyActive] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("leads30d");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["partners", "overview"],
    queryFn: () => partnersService.overview(),
    staleTime: 60_000,
  });

  const partners = useMemo(() => {
    const list = (data ?? []).filter((p) => {
      if (onlyActive && !p.isActive) return false;
      if (segment !== "todos" && p.segment !== segment) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        (p.kommoSubdomain ?? "").toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
  }, [data, search, segment, onlyActive, sortKey]);

  const totals = useMemo(() => {
    const src = data ?? [];
    return {
      ativos: src.filter((p) => p.isActive).length,
      total: src.length,
      leads30d: src.reduce((s, p) => s + p.leads30d, 0),
      agendados: src.reduce((s, p) => s + p.agendados, 0),
      faturamento: src.reduce((s, p) => s + p.faturamento, 0),
    };
  }, [data]);

  const sortable: { key: SortKey; label: string }[] = [
    { key: "leads30d", label: "Leads 30d" },
    { key: "totalLeads", label: "Total" },
    { key: "agendados", label: "Agendados" },
    { key: "faturamento", label: "Faturamento" },
  ];

  return (
    <>
      <PageHeader
        badge="Kommo CRM"
        title="Painel de Parceiros"
        description="Todas as unidades parceiras lado a lado — integração, volume de leads e resultado."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Parceiros ativos"
          value={`${totals.ativos}/${totals.total}`}
          icon={Building2}
        />
        <StatCard label="Leads (30 dias)" value={formatNumber(totals.leads30d)} icon={TrendingUp} />
        <StatCard label="Agendados" value={formatNumber(totals.agendados)} icon={CalendarCheck} />
        <StatCard
          label="Faturamento"
          value={formatCurrency(totals.faturamento)}
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade ou conta Kommo"
                className="w-full rounded-md border border-white/[0.07] bg-white/[0.02] py-2 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-white/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["todos", "saude", "juridico"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSegment(s)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    segment === s
                      ? "border-white/20 bg-white/[0.07] text-slate-100"
                      : "border-white/[0.07] text-slate-400 hover:text-slate-200",
                  )}
                >
                  {s === "todos" ? "Todos" : s === "saude" ? "Saúde" : "Jurídico"}
                </button>
              ))}

              <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                Somente ativos
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Ordenar por:</span>
            {sortable.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={cn(
                  "rounded px-2 py-1 transition",
                  sortKey === s.key ? "bg-white/[0.07] text-slate-200" : "hover:text-slate-300",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Carregando parceiros…</p>
          ) : isError ? (
            <EmptyState
              title="Não foi possível carregar"
              description="Este painel é restrito a super admin / analista."
            />
          ) : partners.length === 0 ? (
            <EmptyState
              title="Nenhum parceiro encontrado"
              description="Ajuste a busca ou os filtros."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>Parceiro</Th>
                    <Th>Integração Kommo</Th>
                    <Th className="text-right">Leads 30d</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Agendados</Th>
                    <Th className="text-right">Fechados</Th>
                    <Th className="text-right">Faturamento</Th>
                    <Th className="text-right">Último lead</Th>
                  </Tr>
                </THead>
                <TBody>
                  {partners.map((p) => {
                    const stale =
                      p.daysSinceLastLead === null || p.daysSinceLastLead > STALE_DAYS;
                    return (
                      <Tr key={p.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <PartnerLogo partner={p} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-slate-100">
                                  {p.name}
                                </span>
                                {p.segment === "juridico" && (
                                  <span className="rounded border border-white/[0.07] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                    Jurídico
                                  </span>
                                )}
                                {!p.isActive && (
                                  <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-400/90">
                                    Inativa
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-slate-500">
                                {[p.city, p.state].filter(Boolean).join(" · ") ||
                                  p.slug ||
                                  "—"}
                                {p.responsibleName ? ` · ${p.responsibleName}` : ""}
                              </p>
                            </div>
                          </div>
                        </Td>

                        <Td>
                          <div className="flex items-center gap-2">
                            {p.hasKommoToken ? (
                              <Link2 className="h-3.5 w-3.5 text-emerald-400/80" />
                            ) : (
                              <Ban className="h-3.5 w-3.5 text-slate-600" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs text-slate-300">
                                {p.kommoSubdomain || "não conectada"}
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                {p.hasKommoToken ? "Pro · conectada" : "sem token"}
                                {p.hasKommoToken && !p.hasStageMap ? " · sem etapas" : ""}
                              </p>
                            </div>
                          </div>
                        </Td>

                        <Td className="text-right text-sm font-medium text-slate-100">
                          {formatNumber(p.leads30d)}
                        </Td>
                        <Td className="text-right text-sm text-slate-300">
                          {formatNumber(p.totalLeads)}
                        </Td>
                        <Td className="text-right text-sm text-slate-300">
                          {formatNumber(p.agendados)}
                        </Td>
                        <Td className="text-right text-sm text-slate-300">
                          {formatNumber(p.fechados)}
                        </Td>
                        <Td className="text-right text-sm text-slate-200">
                          {formatCurrency(p.faturamento)}
                        </Td>
                        <Td className="text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              stale ? "text-amber-400/90" : "text-slate-400",
                            )}
                          >
                            {stale && <AlertTriangle className="h-3 w-3" />}
                            {p.daysSinceLastLead === null
                              ? "nunca"
                              : p.daysSinceLastLead === 0
                                ? "hoje"
                                : `${p.daysSinceLastLead}d`}
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
