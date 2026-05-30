import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { unitsService } from "@/services/units";
import type { Unit } from "@/types";
import {
  Building2,
  Search,
  Plus,
  Users,
  Power,
  Trash2,
  Copy,
  Check,
  Link2,
  MapPin,
  Mail,
  Phone,
  UserRound,
  X,
  Loader2,
  RefreshCw,
} from "@/components/icons";

const DEFAULT_PHOTO =
  "https://stract.to/wp-content/uploads/2024/12/kommo-crm.png";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-400/50";

type Banner = { type: "success" | "error"; message: string } | null;

type LocationState =
  | { createdUnitId?: number | string | null; webhookUrl?: string | null }
  | null;

export default function UnitsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const justCreatedRef = useRef(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [banner, setBanner] = useState<Banner>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const [syncTarget, setSyncTarget] = useState<Unit | null>(null);
  const [syncToken, setSyncToken] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    leadsFetched: number;
    leadsPersisted: number;
    contactsFetched: number;
    pagesFetched: number;
    durationMs: number;
  } | null>(null);

  const flash = useCallback((b: Banner, ttl = 4000) => {
    setBanner(b);
    if (b) setTimeout(() => setBanner(null), ttl);
  }, []);

  const loadUnits = useCallback(() => {
    let alive = true;
    setLoading(true);
    unitsService
      .list()
      .then((data) => {
        if (alive) setUnits(data);
      })
      .catch(() => {
        if (alive) flash({ type: "error", message: "Erro ao carregar unidades" });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [flash]);

  useEffect(() => loadUnits(), [loadUnits]);

  // Banner de unidade recém-criada (vindo do UnitCreatePage via state)
  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.createdUnitId && !justCreatedRef.current) {
      justCreatedRef.current = true;
      flash(
        { type: "success", message: "Unidade criada! URL do webhook gerada." },
        6000,
      );
      // Limpa o state para não disparar de novo em refresh/back
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, flash]);

  const leadsOf = (u: Unit) => u.leadCount ?? u.leadsCount ?? u.totalLeads ?? 0;

  const filteredUnits = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return units;
    return units.filter((u) =>
      [u.name, u.city, u.responsibleName, u.slug]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [units, searchTerm]);

  const totalLeads = useMemo(
    () => units.reduce((acc, u) => acc + leadsOf(u), 0),
    [units],
  );
  const activeCount = useMemo(
    () => units.filter((u) => u.isActive !== false).length,
    [units],
  );

  const apiMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await unitsService.remove(deleteTarget.id);
      setUnits((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      flash({ type: "success", message: "Unidade removida" });
      setDeleteTarget(null);
    } catch (error) {
      flash({ type: "error", message: apiMessage(error, "Erro ao remover unidade") });
    } finally {
      setDeleting(false);
    }
  };

  const openSync = (unit: Unit) => {
    setSyncTarget(unit);
    setSyncToken("");
    setSyncResult(null);
  };

  const closeSync = () => {
    if (syncing) return;
    setSyncTarget(null);
    setSyncToken("");
    setSyncResult(null);
  };

  const runSync = async () => {
    if (!syncTarget) return;
    const hasToken = syncTarget.hasKommoToken === true;
    if (!hasToken && !syncToken.trim()) {
      flash({ type: "error", message: "Informe um access token da Kommo." });
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await unitsService.syncFromKommo(syncTarget.id, {
        accessToken: syncToken.trim() || undefined,
        persistToken: true,
      });
      if (res.success) {
        setSyncResult({
          leadsFetched: res.leadsFetched,
          leadsPersisted: res.leadsPersisted,
          contactsFetched: res.contactsFetched,
          pagesFetched: res.pagesFetched,
          durationMs: res.durationMs,
        });
        flash({
          type: "success",
          message: `Sincronizado: ${res.leadsPersisted} leads salvos.`,
        }, 6000);
        // Atualiza a lista pra contagem de leads aparecer
        loadUnits();
      } else {
        flash({
          type: "error",
          message: res.error || "Falha ao sincronizar.",
        });
      }
    } catch (error) {
      flash({ type: "error", message: apiMessage(error, "Erro ao sincronizar com a Kommo.") });
    } finally {
      setSyncing(false);
    }
  };

  const copyWebhook = async (unit: Unit) => {
    if (!unit.webhookUrl) {
      flash({ type: "error", message: "Esta unidade ainda não tem URL de webhook" });
      return;
    }
    try {
      await navigator.clipboard.writeText(unit.webhookUrl);
      setCopiedId(unit.id);
      flash({ type: "success", message: "URL do webhook copiada!" });
      setTimeout(() => setCopiedId((c) => (c === unit.id ? null : c)), 2000);
    } catch {
      flash({ type: "error", message: "Não foi possível copiar" });
    }
  };

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        {banner && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
              banner.type === "success"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-red-400/30 bg-red-400/10 text-red-300"
            }`}
          >
            {banner.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
            {banner.message}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/20">
              <Building2 className="h-6 w-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white sm:text-2xl">
                Unidades
              </h1>
              <p className="text-sm text-slate-400">
                Gerencie suas unidades e a URL do webhook da Kommo de cada uma.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/units/new")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-400"
          >
            <Plus className="h-4 w-4" />
            Nova unidade
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Building2 className="h-5 w-5 text-brand-400" />,
              ring: "ring-brand-400/20 bg-brand-500/10",
              value: units.length,
              label: "Unidades",
            },
            {
              icon: <Power className="h-5 w-5 text-emerald-400" />,
              ring: "ring-emerald-400/20 bg-emerald-500/10",
              value: activeCount,
              label: "Ativas",
            },
            {
              icon: <Users className="h-5 w-5 text-accent-400" />,
              ring: "ring-accent-400/20 bg-accent-500/10",
              value: totalLeads,
              label: "Leads totais",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${kpi.ring}`}
              >
                {kpi.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{kpi.value}</p>
                <p className="text-xs text-slate-400">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, cidade, responsável…"
            className={`${inputClass} pl-9`}
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : units.length === 0 ? (
          // Estado vazio: chama pra criar a primeira
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-white/10 py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
              <Building2 className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-semibold text-white">
                Nenhuma unidade cadastrada
              </h3>
              <p className="mt-1 max-w-sm text-sm text-slate-400">
                Cadastre sua primeira unidade pra gerar a URL do webhook da
                Kommo.
              </p>
            </div>
            <button
              onClick={() => navigate("/units/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-400"
            >
              <Plus className="h-4 w-4" />
              Criar primeira unidade
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredUnits.map((unit) => (
              <div
                key={unit.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-brand-400/30 hover:bg-white/[0.07]"
              >
                <div className="relative h-28 w-full overflow-hidden bg-slate-800">
                  <img
                    src={unit.photoUrl || DEFAULT_PHOTO}
                    alt={unit.name ?? "Unidade"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PHOTO;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <span
                    className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      unit.isActive !== false
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {unit.isActive !== false ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-white">
                        {unit.name}
                      </h3>
                      <p className="truncate text-xs text-slate-500">
                        {unit.slug ? `/${unit.slug}` : `ID: ${unit.clinicId}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => openSync(unit)}
                        title="Sincronizar leads da Kommo"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-brand-500/10 hover:text-brand-300"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(unit)}
                        title="Remover"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-slate-400">
                    {unit.responsibleName && (
                      <p className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{unit.responsibleName}</span>
                      </p>
                    )}
                    {(unit.city || unit.state) && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {[unit.city, unit.state].filter(Boolean).join(" - ")}
                        </span>
                      </p>
                    )}
                    {unit.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{unit.email}</span>
                      </p>
                    )}
                    {unit.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{unit.phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-xs text-slate-400">Leads</span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-white">
                      <Users className="h-3.5 w-3.5 text-brand-400" />
                      {leadsOf(unit)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Link2 className="h-3 w-3" /> Webhook da Kommo
                    </span>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={unit.webhookUrl ?? "—"}
                        onFocus={(e) => e.currentTarget.select()}
                        className={`${inputClass} h-9 px-2 text-xs`}
                      />
                      <button
                        onClick={() => copyWebhook(unit)}
                        disabled={!unit.webhookUrl}
                        title="Copiar URL"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        {copiedId === unit.id ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Card "+" pra criar mais */}
            <button
              onClick={() => navigate("/units/new")}
              className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/10 text-slate-400 transition hover:border-brand-400/40 hover:bg-brand-500/5 hover:text-brand-300"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
                <Plus className="h-7 w-7" />
              </div>
              <span className="font-medium">Criar nova unidade</span>
            </button>
          </div>
        )}

        {!loading && filteredUnits.length === 0 && searchTerm && (
          <p className="py-8 text-center text-sm text-slate-400">
            Nenhuma unidade encontrada para "{searchTerm}".
          </p>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1117] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">
              Remover unidade
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Tem certeza que deseja remover{" "}
              <span className="font-medium text-white">{deleteTarget.name}</span>?
              Unidades com leads vinculados não podem ser removidas (desative-as).
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? "Removendo…" : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync from Kommo modal */}
      {syncTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeSync}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Sincronizar com Kommo
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Vai puxar até 5.000 leads existentes (com nome, etapa,
                  telefone e email) da conta{" "}
                  <code className="rounded bg-white/5 px-1 text-[11px]">
                    {syncTarget.kommoSubdomain ?? "—"}
                  </code>{" "}
                  e gravar nessa unidade. É seguro rodar várias vezes — usa
                  o ExternalId, então não duplica.
                </p>
                <p className="mt-2 text-xs text-amber-300">
                  ⏱️ Pode levar 1-3 minutos. Não feche a tela durante a sync.
                </p>
              </div>
              <button
                onClick={closeSync}
                disabled={syncing}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {syncResult ? (
              <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                <p className="text-sm font-semibold text-emerald-300">
                  ✓ Sincronização concluída
                </p>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  <li>Páginas baixadas: <strong>{syncResult.pagesFetched}</strong></li>
                  <li>Leads buscados: <strong>{syncResult.leadsFetched}</strong></li>
                  <li>Contatos buscados: <strong>{syncResult.contactsFetched}</strong></li>
                  <li>Leads gravados: <strong className="text-emerald-300">{syncResult.leadsPersisted}</strong></li>
                  <li className="text-slate-500">Duração: {(syncResult.durationMs / 1000).toFixed(2)}s</li>
                </ul>
                <button
                  onClick={closeSync}
                  className="mt-4 w-full rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  {syncTarget.hasKommoToken && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-xs text-emerald-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Token salvo para esta unidade. Deixe o campo vazio
                        para usá-lo, ou cole um novo para substituir.
                      </span>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>
                      Access token de longa duração da Kommo
                      {!syncTarget.hasKommoToken && " *"}
                    </label>
                    <textarea
                      className={`${inputClass} h-24 resize-none font-mono text-xs`}
                      value={syncToken}
                      onChange={(e) => setSyncToken(e.target.value)}
                      placeholder="eyJ0eXAiOi..."
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Pegue em <strong>Kommo → Perfil → Integrações → API</strong>{" "}
                      → "Criar token de longa duração". O token é salvo
                      criptografado por unidade.
                    </p>
                  </div>

                  {!syncTarget.kommoSubdomain && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-300">
                      ⚠️ Esta unidade não tem <code>KommoSubdomain</code>{" "}
                      configurado. Edite a unidade e preencha (ex.:{" "}
                      <code>minhaclinica.kommo.com</code>) antes de sincronizar.
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={closeSync}
                    disabled={syncing}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={runSync}
                    disabled={syncing || !syncTarget.kommoSubdomain}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-400 disabled:opacity-50"
                  >
                    {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {syncing ? "Sincronizando…" : "Sincronizar agora"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";
