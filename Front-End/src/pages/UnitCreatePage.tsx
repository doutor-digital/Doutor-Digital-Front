import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { unitsService } from "@/services/units";
import type { CreateUnitInput } from "@/types";
import {
  ArrowLeft,
  Building2,
  Check,
  ImagePlus,
  Loader2,
  X,
} from "@/components/icons";

const DEFAULT_PHOTO =
  "https://stract.to/wp-content/uploads/2024/12/kommo-crm.png";

const MAX_PHOTO_MB = 5;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type FormState = {
  name: string;
  segment: string;
  email: string;
  cnpj: string;
  phone: string;
  addressLine: string;
  addressNumber: string;
  neighborhood: string;
  zipCode: string;
  city: string;
  state: string;
  responsibleName: string;
  kommoSubdomain: string;
};

const emptyForm: FormState = {
  name: "",
  segment: "saude",
  email: "",
  cnpj: "",
  phone: "",
  addressLine: "",
  addressNumber: "",
  neighborhood: "",
  zipCode: "",
  city: "",
  state: "",
  responsibleName: "",
  kommoSubdomain: "",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-brand-400/50";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

type Banner = { type: "success" | "error"; message: string } | null;

export default function UnitCreatePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const flash = (b: Banner, ttl = 4000) => {
    setBanner(b);
    if (b) setTimeout(() => setBanner(null), ttl);
  };

  const apiMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback;

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      flash({ type: "error", message: "Formato inválido. Use jpg, png ou webp." });
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      flash({ type: "error", message: `Foto excede ${MAX_PHOTO_MB} MB.` });
      e.target.value = "";
      return;
    }

    setUploadingPhoto(true);
    try {
      const url = await unitsService.uploadPhoto(file);
      setPhotoUrl(url);
      flash({ type: "success", message: "Foto enviada com sucesso." });
    } catch (error) {
      flash({ type: "error", message: apiMessage(error, "Falha ao enviar a foto.") });
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const clearPhoto = () => setPhotoUrl("");

  const handleSave = async () => {
    if (!form.name.trim()) {
      flash({ type: "error", message: "Informe o nome da unidade." });
      return;
    }
    setSaving(true);
    try {
      const payload: CreateUnitInput = {
        name: form.name.trim(),
        segment: form.segment,
        email: form.email.trim() || undefined,
        cnpj: form.cnpj.trim() || undefined,
        phone: form.phone.trim() || undefined,
        addressLine: form.addressLine.trim() || undefined,
        addressNumber: form.addressNumber.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim().toUpperCase() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        responsibleName: form.responsibleName.trim() || undefined,
        kommoSubdomain: form.kommoSubdomain.trim() || undefined,
        photoUrl: photoUrl || undefined,
      };

      const created = await unitsService.create(payload);
      navigate("/units", {
        state: {
          createdUnitId: created.id,
          webhookUrl: created.webhookUrl,
        },
      });
    } catch (error) {
      flash({ type: "error", message: apiMessage(error, "Erro ao criar unidade.") });
    } finally {
      setSaving(false);
    }
  };

  const previewUrl = photoUrl || DEFAULT_PHOTO;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/units")}
            className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/20">
            <Building2 className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white sm:text-2xl">
              Nova unidade
            </h1>
            <p className="text-sm text-slate-400">
              Cadastre os dados da unidade. A URL do webhook da Kommo é gerada
              automaticamente ao salvar.
            </p>
          </div>
        </div>

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

        {/* Foto */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Foto / Logo
          </h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
              <img
                src={previewUrl}
                alt="Foto da unidade"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_PHOTO;
                }}
              />
              {photoUrl && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-red-500"
                  title="Remover foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {uploadingPhoto ? "Enviando…" : photoUrl ? "Trocar foto" : "Enviar foto"}
              </button>
              <p className="text-xs text-slate-500">
                JPG, PNG ou WebP. Máx {MAX_PHOTO_MB} MB. A foto fica hospedada
                na nossa API.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_PHOTO_TYPES.join(",")}
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>
          </div>
        </section>

        {/* Identificação */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Identificação
          </h2>
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>Nome da unidade *</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Ex.: Unidade Araguaína"
              />
            </div>

            <div>
              <label className={labelClass}>Segmento</label>
              <select
                className={inputClass}
                value={form.segment}
                onChange={(e) => setField("segment", e.target.value)}
              >
                <option value="saude">Saúde (clínicas)</option>
                <option value="juridico">Jurídico (advocacia)</option>
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                Define o conjunto de KPIs do dashboard. Jurídico para escritórios de advocacia
                (ex.: Advocacia Magalhães).
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>CNPJ</label>
                <input
                  className={inputClass}
                  value={form.cnpj}
                  onChange={(e) => setField("cnpj", e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div>
                <label className={labelClass}>E-mail</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="contato@unidade.com"
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
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Endereço
          </h2>
          <div className="grid gap-4">
            <div>
              <label className={labelClass}>CEP</label>
              <input
                className={inputClass}
                value={form.zipCode}
                onChange={(e) => setField("zipCode", e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
                <label className={labelClass}>Logradouro</label>
                <input
                  className={inputClass}
                  value={form.addressLine}
                  onChange={(e) => setField("addressLine", e.target.value)}
                  placeholder="Rua / Avenida"
                />
              </div>
              <div>
                <label className={labelClass}>Número</label>
                <input
                  className={inputClass}
                  value={form.addressNumber}
                  onChange={(e) => setField("addressNumber", e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Bairro</label>
              <input
                className={inputClass}
                value={form.neighborhood}
                onChange={(e) => setField("neighborhood", e.target.value)}
                placeholder="Centro"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <div>
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
          </div>
        </section>

        {/* Integração Kommo */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Integração Kommo
          </h2>
          <div>
            <label className={labelClass}>Subdomínio Kommo</label>
            <input
              className={inputClass}
              value={form.kommoSubdomain}
              onChange={(e) => setField("kommoSubdomain", e.target.value)}
              placeholder="minhaclinica (de minhaclinica.kommo.com)"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Opcional. Usado pra validar a origem dos webhooks recebidos.
              A URL do webhook é gerada automaticamente quando você salvar.
            </p>
          </div>
        </section>

        {/* Ações */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => navigate("/units")}
            disabled={saving}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploadingPhoto}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-400 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Criando…" : "Criar unidade"}
          </button>
        </div>
    </div>
  );
}
