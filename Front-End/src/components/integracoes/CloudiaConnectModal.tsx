import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, Save, Webhook, X } from "lucide-react";
import { configurationService } from "@/services/configuration";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { useClinic } from "@/hooks/useClinic";
import { API_BASE_URL } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

type Tab = "webhook" | "apikey";

export function CloudiaConnectModal({ open, onClose, onConnected }: Props) {
  const { tenantId } = useClinic();
  const [tab, setTab] = useState<Tab>("webhook");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | "">(180);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    expiresAt?: string | null;
  } | null>(null);

  const webhookUrl = tenantId
    ? `${API_BASE_URL}/api/empresas/${tenantId}/cloudia/webhook`
    : `${API_BASE_URL}/api/empresas/<TENANT_ID>/cloudia/webhook`;

  useEffect(() => {
    if (!open) return;
    void loadStatus();
  }, [open]);

  async function loadStatus() {
    try {
      const s = (await configurationService.getCloudiaStatus()) as any;
      setStatus({ configured: s.configured, expiresAt: s.expiresAt });
    } catch {
      setStatus(null);
    }
  }

  async function handleSaveKey() {
    if (!apiKey || apiKey.length < 8) {
      toast.error("API key precisa ter pelo menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await configurationService.setCloudiaKey({
        apiKey,
        expiresInDays: typeof expiresInDays === "number" ? expiresInDays : undefined,
      } as any);
      toast.success("Cloudia conectada!");
      setApiKey("");
      await loadStatus();
      onConnected?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Falha ao salvar API key";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remover a API key da Cloudia?")) return;
    setSaving(true);
    try {
      await configurationService.deleteCloudiaKey();
      toast.success("Cloudia desconectada");
      await loadStatus();
      onConnected?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Falha ao remover");
    } finally {
      setSaving(false);
    }
  }

  function copy(value: string) {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.message("Copiado para a área de transferência."))
      .catch(() => toast.error("Falha ao copiar"));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-[#0a0a0d] shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-white/10">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-L72aOKqwGjo2c3mVSTj-Y0EAuUiOJNXDAQ&s"
              alt="Cloudia"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-50">
              Conectar Cloudia
            </h2>
            <p className="text-[12px] text-slate-500">
              Receba leads em tempo real via webhook + opcionalmente envie eventos.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {(["webhook", "apikey"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === t
                  ? "bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/[0.08]"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
              ].join(" ")}
            >
              {t === "webhook" ? "Webhook (entrada)" : "API key (saída)"}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="px-6 py-5 space-y-4">
          {tab === "webhook" && (
            <>
              <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <Webhook className="mt-0.5 h-4 w-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[13px] text-slate-200">
                      Cole esta URL no painel da Cloudia → Webhooks
                    </p>
                    <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3 py-2">
                      <code className="flex-1 truncate text-[11.5px] text-slate-300 font-mono">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={() => copy(webhookUrl)}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11.5px] text-slate-500">
                      A Cloudia identifica a clínica via{" "}
                      <code className="rounded bg-white/[0.04] px-1 text-[11px]">
                        data.clinic_id
                      </code>
                      . Não precisa de API key pra receber.
                    </p>
                  </div>
                </div>
              </div>

              <ol className="space-y-2 text-[12.5px] text-slate-400 list-decimal list-inside">
                <li>Acesse o painel da Cloudia → Configurações → Integrações.</li>
                <li>Clique em "Adicionar webhook" e cole a URL acima.</li>
                <li>
                  Selecione os eventos:{" "}
                  <span className="text-slate-200">CUSTOMER_CREATED, UPDATED, STAGE, TAGS, ASSIGNED</span>.
                </li>
                <li>Salve. O primeiro evento que cair aqui já mostra como "Conectado".</li>
              </ol>
            </>
          )}

          {tab === "apikey" && (
            <>
              <div
                className={[
                  "rounded-md border p-3 text-[12.5px]",
                  status?.configured
                    ? "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-200"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400",
                ].join(" ")}
              >
                Status atual:{" "}
                <strong>
                  {status?.configured ? "API key configurada" : "Sem API key"}
                </strong>
                {status?.expiresAt && (
                  <span className="ml-2 text-[11px] text-slate-500">
                    (expira em {new Date(status.expiresAt).toLocaleDateString()})
                  </span>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
                  API Key da Cloudia
                </label>
                <div className="relative mt-1.5">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="Cole a API key aqui"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                  >
                    {showKey ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-500">
                  Expira em (dias)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  placeholder="180"
                  value={expiresInDays}
                  onChange={(e) =>
                    setExpiresInDays(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  loading={saving}
                  onClick={handleSaveKey}
                  className="bg-[#0077CC] hover:bg-[#0088EE] text-white"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Salvar API key
                </Button>
                {status?.configured && (
                  <Button
                    onClick={handleDelete}
                    className="bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                  >
                    Remover key
                  </Button>
                )}
                <p className="ml-auto text-[11px] text-slate-500">
                  A key fica criptografada no banco.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
