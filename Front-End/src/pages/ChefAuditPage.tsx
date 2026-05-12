import { useEffect, useMemo, useState } from "react";
import {
  ChefHat,
  RefreshCw,
  Search,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import {
  auditService,
  type AuditLogItem,
  type AuditLogQuery,
} from "@/services/audit";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const PAGE_SIZE = 50;

export default function ChefAuditPage() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return ["super_admin", "super-admin", "superadmin"].includes(r);
  }, [user?.role]);

  const [filters, setFilters] = useState<AuditLogQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load(next: AuditLogQuery = filters) {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const res = await auditService.query(next);
      setItems(res.items);
      setTotal(res.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  function applyFilter() {
    const next = { ...filters, page: 1 };
    setFilters(next);
    load(next);
  }

  function turnPage(delta: number) {
    const nextPage = Math.max(1, (filters.page ?? 1) + delta);
    const next = { ...filters, page: nextPage };
    setFilters(next);
    load(next);
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <ShieldAlert className="inline-block h-4 w-4 mr-2" />
          Acesso restrito ao super-admin.
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? PAGE_SIZE)));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <ChefHat className="h-7 w-7 text-amber-300" />
        <div>
          <h1 className="text-2xl font-bold text-slate-50">
            Chef · Auditoria global
          </h1>
          <p className="text-sm text-slate-400">
            Tudo o que acontece no sistema: logins, chamadas a endpoints, IP,
            usuário e tempo de resposta.
          </p>
        </div>
      </header>

      {/* Filtros */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0a0a0d] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              Email
            </label>
            <Input
              icon={<Search className="h-4 w-4" />}
              placeholder="user@..."
              value={filters.email ?? ""}
              onChange={(e) => setFilters({ ...filters, email: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              Path
            </label>
            <Input
              placeholder="/api/leads"
              value={filters.path ?? ""}
              onChange={(e) => setFilters({ ...filters, path: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              IP
            </label>
            <Input
              placeholder="187.x.x.x"
              value={filters.ip ?? ""}
              onChange={(e) => setFilters({ ...filters, ip: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              Status
            </label>
            <Input
              placeholder="200, 401…"
              type="number"
              value={filters.statusCode ?? ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  statusCode: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <Button
              onClick={applyFilter}
              className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
            >
              Aplicar
            </Button>
            <Button
              onClick={() => load(filters)}
              className="bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              De
            </label>
            <Input
              type="datetime-local"
              value={filters.from ?? ""}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <label className="text-[10px] uppercase tracking-widest text-slate-500">
              Até
            </label>
            <Input
              type="datetime-local"
              value={filters.to ?? ""}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Tabela */}
      <section className="rounded-xl border border-white/[0.06] bg-[#0a0a0d] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/[0.04]">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">
            {loading ? "Carregando…" : `${total} eventos`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => turnPage(-1)}
              className="bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] disabled:opacity-40"
              disabled={(filters.page ?? 1) <= 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] text-slate-400 px-2">
              {filters.page ?? 1} / {totalPages}
            </span>
            <Button
              onClick={() => turnPage(+1)}
              className="bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] disabled:opacity-40"
              disabled={(filters.page ?? 1) >= totalPages || loading}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-white/[0.02] text-slate-500 uppercase tracking-widest text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Auth</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Método</th>
                <th className="px-3 py-2 text-left">Path</th>
                <th className="px-3 py-2 text-right">Status</th>
                <th className="px-3 py-2 text-right">Tempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                    {new Date(it.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-100">
                    {it.userName ?? "—"}
                    <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                      {it.email ?? "anônimo"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{it.role ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{it.authMethod ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-[11px]">
                    {it.ip ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-[11px]">
                    {it.method}
                  </td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-[11px] max-w-[280px] truncate">
                    {it.path}
                    {it.queryString && (
                      <span className="text-slate-500">{it.queryString}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={[
                        "inline-flex rounded-full px-1.5 py-[1px] text-[10px] font-semibold",
                        it.statusCode >= 500
                          ? "bg-rose-500/20 text-rose-200"
                          : it.statusCode >= 400
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-emerald-500/20 text-emerald-200",
                      ].join(" ")}
                    >
                      {it.statusCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {it.durationMs} ms
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-slate-500">
                    Sem eventos para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
