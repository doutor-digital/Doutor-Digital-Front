import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { adminLogsService, type EntityChange } from "@/services/adminLogs";
import { roleLabel } from "@/lib/roles";

const ENTITY_OPTIONS = ["", "Lead", "User", "Unit", "Invitation"];

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR");
}

const ACTION_PT: Record<string, string> = {
  Added: "Criou",
  Modified: "Alterou",
  Deleted: "Excluiu",
};

function renderChanges(c: EntityChange) {
  if (!c.changesJson) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(c.changesJson);
  } catch {
    return <span className="text-slate-500">{c.changesJson}</span>;
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) return <span className="text-slate-500">—</span>;

  return (
    <ul className="space-y-0.5">
      {entries.slice(0, 12).map(([field, val]) => {
        const isDiff =
          val && typeof val === "object" && "from" in (val as object) && "to" in (val as object);
        const v = val as { from?: unknown; to?: unknown };
        return (
          <li key={field} className="text-[12px]">
            <span className="text-slate-300">{field}</span>:{" "}
            {isDiff ? (
              <>
                <span className="text-rose-300/80 line-through">{String(v.from ?? "∅")}</span>
                {" → "}
                <span className="text-emerald-300">{String(v.to ?? "∅")}</span>
              </>
            ) : (
              <span className="text-emerald-300">{String(val ?? "∅")}</span>
            )}
          </li>
        );
      })}
      {entries.length > 12 && (
        <li className="text-[11px] text-slate-500">+{entries.length - 12} campos…</li>
      )}
    </ul>
  );
}

export default function EntityChangesPage() {
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-entity-changes", entityType, entityId],
    queryFn: () =>
      adminLogsService.entityChanges({
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        pageSize: 200,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="Alterações"
        description="Trilha de quem mudou o quê (antes → depois) em leads, usuários, unidades e convites."
        badge="Logs avançados"
      />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="h-9 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-slate-100 focus:border-emerald-400/30 focus:outline-none"
        >
          {ENTITY_OPTIONS.map((o) => (
            <option key={o} value={o}>{o === "" ? "Todas as entidades" : o}</option>
          ))}
        </select>
        <Input
          placeholder="ID da entidade…"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="max-w-[180px]"
        />
        <span className="text-[12px] text-slate-500">{data?.total ?? 0} alterações</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-slate-900/40">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-slate-400">
            <tr className="border-b border-white/[0.06]">
              <th className="px-3 py-2.5 font-medium">Quando</th>
              <th className="px-3 py-2.5 font-medium">Autor</th>
              <th className="px-3 py-2.5 font-medium">Ação</th>
              <th className="px-3 py-2.5 font-medium">Entidade</th>
              <th className="px-3 py-2.5 font-medium">Mudanças</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Carregando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Nenhuma alteração.</td></tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] align-top hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="text-slate-200">{c.email ?? `#${c.userId ?? "?"}`}</div>
                    <div className="text-[11px] text-slate-500">{roleLabel(c.role)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{ACTION_PT[c.action] ?? c.action}</td>
                  <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">
                    {c.entityType} <span className="text-slate-500">#{c.entityId ?? "?"}</span>
                  </td>
                  <td className="px-3 py-2.5">{renderChanges(c)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
