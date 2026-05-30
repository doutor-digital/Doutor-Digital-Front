import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { unitsService } from "@/services/units";
import type { Unit, CreateUnitInput } from "@/types";
import {
  Building2,
  Search,
  Plus,
  Users,
  Power,
  Pencil,
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
} from "@/components/icons";

const DEFAULT_PHOTO =
  "https://stract.to/wp-content/uploads/2024/12/kommo-crm.png";

type FormState = {
  name: string;
  email: string;
  cnpj: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  photoUrl: string;
  responsibleName: string;
  kommoSubdomain: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  cnpj: "",
  phone: "",
  addressLine: "",
  city: "",
  state: "",
  photoUrl: "",
  responsibleName: "",
  kommoSubdomain: "",
  isActive: true,
};

type Banner = { type: "success" | "error"; message: string } | null;

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-400/50";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [banner, setBanner] = useState<Banner>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const flash = useCallback((b: Banner) => {
    setBanner(b);
    if (b) setTimeout(() => setBanner(null), 4000);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setForm({
      name: unit.name ?? "",
      email: unit.email ?? "",
      cnpj: unit.cnpj ?? "",
      phone: unit.phone ?? "",
      addressLine: unit.addressLine ?? "",
      city: unit.city ?? "",
      state: unit.state ?? "",
      photoUrl: unit.photoUrl ?? "",
      responsibleName: unit.responsibleName ?? "",
      kommoSubdomain: unit.kommoSubdomain ?? "",
      isActive: unit.isActive !== false,
    });
    setDialogOpen(true);
  };

  const setField = (key: keyof FormState, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const apiMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback;

  const handleSave = async () => {
    if (!form.name.trim()) {
      flash({ type: "error", message: "Informe o nome da unidade" });
      return;
    }
    setSaving(true);
    try {
      const payload: CreateUnitInput & { isActive?: boolean } = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        cnpj: form.cnpj.trim() || undefined,
        phone: form.phone.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim().toUpperCase() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
        responsibleName: form.responsibleName.trim() || undefined,
        kommoSubdomain: form.kommoSubdomain.trim() || undefined,
      };

      if (editing) {
        const updated = await unitsService.update(editing.id, {
          ...payload,
          isActive: form.isActive,
        });
        setUnits((prev) =>
          prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)),
        );
        flash({ type: "success", message: "Unidade atualizada" });
      } else {
        const created = await unitsService.create(payload);
        setUnits((prev) => [...prev, created]);
        flash({
          type: "success",
          message: "Unidade criada! URL do webhook gerada.",
        });
        if (created.webhookUrl) void copyWebhook(created);
      }
      setDialogOpen(false);
    } catch (error) {
      flash({ type: "error", message: apiMessage(error, "Erro ao salvar unidade") });
    } finally {
      setSaving(false);
    }
  };

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
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Banner */}
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

        {/* Header */}
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
                Gerencie suas clínicas e gere a URL do webhook da Kommo de cada
                unidade.
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-400"
          >
            <Plus className="h-4 w-4" />
            Nova unidade
          </button>
        </div>

        {/* KPIs */}
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

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, cidade, responsável…"
            className={`${inputClass} pl-9`}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredUnits.map((unit) => (
              <div
                key={unit.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-brand-400/30 hover:bg-white/[0.07]"
              >
                {/* Cover */}
                <div className="relative h-28 w-full overflow-hidden bg-slate-800">
                  <img
                    src={unit.photoUrl || DEFAULT_PHOTO}
                    alt={unit.name}
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
                        onClick={() => openEdit(unit)}
                        title="Editar"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
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

                  {/* Webhook */}
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

            {/* "+" card */}
            <button
              onClick={openCreate}
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
            Nenhuma unidade encontrada para “{searchTerm}”.
          </p>
        )}
      </div>

      {/* Create/Edit modal */}
      {dialogOpen && (
        <Modal
          title={editing ? "Editar unidade" : "Nova unidade"}
          subtitle={
            editing
              ? "Atualize os dados da unidade."
              : "Cadastre a unidade. A URL do webhook é gerada automaticamente ao salvar."
          }
          onClose={() => !saving && setDialogOpen(false)}
        >
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ex.: Unidade Araguaína"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="contato@clinica.com"
                />
              </div>
              <div>
                <label className={labelClass}>CNPJ</label>
                <input
                  className={inputClass}
                  value={form.cnpj}
                  onChange={(e) => setField("cnpj", e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Telefone / WhatsApp</label>
                <input
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="(63) 90000-0000"
                />
              </div>
              <div>
                <label className={labelClass}>Responsável</label>
                <input
                  className={inputClass}
                  value={form.responsibleName}
                  onChange={(e) => setField("responsibleName", e.target.value)}
                  placeholder="Nome do responsável"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Endereço</label>
              <input
                className={inputClass}
                value={form.addressLine}
                onChange={(e) => setField("addressLine", e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Cidade</label>
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Araguaína"
                />
              </div>
              <div>
                <label className={labelClass}>UF</label>
                <input
                  maxLength={2}
                  className={inputClass}
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value.toUpperCase())}
                  placeholder="TO"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>URL da foto / logo</label>
              <input
                className={inputClass}
                value={form.photoUrl}
                onChange={(e) => setField("photoUrl", e.target.value)}
                placeholder={DEFAULT_PHOTO}
              />
            </div>

            <div>
              <label className={labelClass}>Subdomínio Kommo</label>
              <input
                className={inputClass}
                value={form.kommoSubdomain}
                onChange={(e) => setField("kommoSubdomain", e.target.value)}
                placeholder="minhaclinica (de minhaclinica.kommo.com)"
              />
            </div>

            {editing && (
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <span className="text-sm text-white">Unidade ativa</span>
                  <p className="text-xs text-slate-500">
                    Inativa recusa os webhooks da Kommo.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                  className="h-5 w-5 accent-brand-500"
                />
              </label>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : editing ? "Salvar" : "Criar unidade"}
            </button>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <Modal
          title="Remover unidade"
          subtitle={`Tem certeza que deseja remover "${deleteTarget.name}"? Unidades com leads vinculados não podem ser removidas (desative-as).`}
          onClose={() => !deleting && setDeleteTarget(null)}
        >
          <div className="mt-2 flex justify-end gap-2">
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
        </Modal>
      )}
    </DashboardLayout>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1117] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
