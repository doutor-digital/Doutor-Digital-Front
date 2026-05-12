import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Save, Webhook, X, ArrowRight } from "@/components/icons";
import { Link } from "react-router-dom";
import { configurationService } from "@/services/configuration";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

/**
 * Mapeia o campo do payload Cloudia → o campo no nosso sistema.
 * Esta tabela é a especificação que você passa pra Cloudia.
 *
 * Origem do mapping: backend `LeadController · POST /webhooks/cloudia` →
 * `LeadService.SaveLeadAsync` + `StageWebhookDispatcher` (gatilhos por etapa).
 */
const FIELD_MAPPING: Array<{
  group: string;
  cloudia: string;
  label: string;
  type: string;
  location: string;
  required?: boolean;
}> = [
  // ─── Identificação (sempre vêm) ────────────────────────────────────
  { group: "Identificação", cloudia: "type",                  label: "Tipo do evento",          type: "string",   location: "audit_logs · CUSTOMER_CREATED / UPDATED / STAGE / TAGS / ASSIGNED", required: true },
  { group: "Identificação", cloudia: "data.id",               label: "ID do contato",           type: "int",      location: "Lead.ExternalId · chave de idempotência", required: true },
  { group: "Identificação", cloudia: "data.clinic_id",        label: "Clínica / Tenant",        type: "int",      location: "Lead.TenantId · filtro de unidade", required: true },
  { group: "Identificação", cloudia: "data.name",             label: "Nome",                    type: "string",   location: "Lead.Name · coluna Nome", required: true },
  { group: "Identificação", cloudia: "data.phone",            label: "Telefone",                type: "E.164",    location: "Lead.Phone (normalizado)", required: true },
  { group: "Identificação", cloudia: "data.email",            label: "Email",                   type: "string",   location: "Lead.Email" },
  { group: "Identificação", cloudia: "data.cpf",              label: "CPF",                     type: "string",   location: "Lead.Cpf" },
  { group: "Identificação", cloudia: "data.gender",           label: "Gênero",                  type: "string",   location: "Lead.Gender" },

  // ─── Atribuição (origem dos leads) ─────────────────────────────────
  { group: "Atribuição",    cloudia: "data.source",           label: "Origem",                  type: "string",   location: "Lead.Source (Facebook, Instagram, Google…)" },
  { group: "Atribuição",    cloudia: "data.last_ad_id",       label: "Anúncio",                 type: "string",   location: "Lead.LastAdId" },
  { group: "Atribuição",    cloudia: "data.idfacebookapp",    label: "Pixel Meta",              type: "string",   location: "Lead.IdFacebookApp" },
  { group: "Atribuição",    cloudia: "data.id_channel_integration", label: "Canal",            type: "int",      location: "Lead.IdChannelIntegration" },
  { group: "Atribuição",    cloudia: "data.tags[]",           label: "Tags",                    type: "array",    location: "Lead.Tags · 'Resgate:*' classifica como recuperação" },

  // ─── Estado / Funil ────────────────────────────────────────────────
  { group: "Funil",         cloudia: "data.stage",            label: "Etapa atual",             type: "string",   location: "Lead.CurrentStage · gatilho do dispatcher", required: true },
  { group: "Funil",         cloudia: "data.id_stage",         label: "ID da etapa",             type: "int",      location: "Lead.CurrentStageId" },
  { group: "Funil",         cloudia: "data.assigned_user",    label: "Atendente",               type: "string",   location: "Lead.Attendant.Name · 'Responsável'" },
  { group: "Funil",         cloudia: "data.has_health_insurance_plan", label: "Plano de saúde", type: "bool",     location: "Lead.HasHealthInsurancePlan" },
  { group: "Funil",         cloudia: "data.observations",     label: "Observação",              type: "string",   location: "Lead.Observations · coluna Observação" },
  { group: "Funil",         cloudia: "data.conversationState", label: "Estado da conversa",     type: "string",   location: "Lead.ConversationState" },

  // ─── Consulta (gatilhos: 04/05/06/07) ──────────────────────────────
  { group: "Consulta",      cloudia: "stage = 04_AGENDADO_SEM_PAGAMENTO", label: "Agendou (paga no dia)", type: "trigger", location: "Cria Consultation · paid_in_advance=false" },
  { group: "Consulta",      cloudia: "stage = 05_AGENDADO_COM_PAGAMENTO", label: "Agendou (já pagou)",    type: "trigger", location: "Cria Consultation · paid_in_advance=true" },
  { group: "Consulta",      cloudia: "stage = 06_NAO_COMPARECEU",        label: "Faltou",                 type: "trigger", location: "Consultation.Status = 'faltou'" },
  { group: "Consulta",      cloudia: "stage = 07_COMPARECEU_CONSULTA",   label: "Compareceu",             type: "trigger", location: "Consultation.Status = 'realizada'" },
  { group: "Consulta",      cloudia: "data.appointment_at",   label: "Data do agendamento",     type: "datetime", location: "Consultation.ScheduledAt" },

  // ─── Tratamento (gatilhos: 09/17) ──────────────────────────────────
  { group: "Tratamento",    cloudia: "stage = 09_TRATAMENTO_FECHADO",    label: "Fechou tratamento",      type: "trigger", location: "Cria Treatment · status='aguardando_dados' (SDR preenche depois)" },
  { group: "Tratamento",    cloudia: "stage = 17_NAO_DEU_CONTINUIDADE",  label: "Perdeu",                 type: "trigger", location: "Treatment.ClosedAsLost = true · pede motivo" },
  { group: "Tratamento",    cloudia: "(SDR preenche)",        label: "Tipo do tratamento",      type: "string",   location: "Treatment.TreatmentType" },
  { group: "Tratamento",    cloudia: "(SDR preenche)",        label: "Duração (meses)",         type: "int",      location: "Treatment.DurationMonths" },
  { group: "Tratamento",    cloudia: "(SDR preenche)",        label: "Valor total",             type: "decimal",  location: "Treatment.TotalValue" },

  // ─── Pagamentos (parcelas — preenchidas pela SDR) ──────────────────
  { group: "Pagamentos",    cloudia: "(SDR preenche)",        label: "Parcela N · valor",       type: "decimal",  location: "TreatmentInstallment[N].Amount" },
  { group: "Pagamentos",    cloudia: "(SDR preenche)",        label: "Parcela N · forma",       type: "enum",     location: "TreatmentInstallment[N].PaymentMethod (pix/dinheiro/débito/crédito/boleto)" },
  { group: "Pagamentos",    cloudia: "(SDR preenche)",        label: "Parcela N · vencimento",  type: "date",     location: "TreatmentInstallment[N].DueDate" },
  { group: "Pagamentos",    cloudia: "(SDR preenche)",        label: "Parcela N · pago em",     type: "datetime", location: "TreatmentInstallment[N].PaidAt" },

  // ─── Auditoria ─────────────────────────────────────────────────────
  { group: "Auditoria",     cloudia: "data.created_at",       label: "Data origem",             type: "datetime", location: "Lead.CreatedAt" },
  { group: "Auditoria",     cloudia: "data.last_updated_at",  label: "Data modificação",        type: "datetime", location: "Lead.UpdatedAt · idempotência" },
];

/** Payload de exemplo que você cola pro time da Cloudia validar. */
const EXAMPLE_PAYLOAD = {
  type: "CUSTOMER_STAGE_CHANGED",
  data: {
    id: 12345,
    clinic_id: 8020,
    name: "Maria da Silva",
    phone: "+5563999990000",
    email: "maria@example.com",
    source: "Facebook Ads",
    stage: "04_AGENDADO_SEM_PAGAMENTO",
    id_stage: 4,
    assigned_user: "Adriele",
    tags: ["Hérnia inguinal"],
    has_health_insurance_plan: false,
    observations: "Cliente prefere atendimento de manhã.",
    appointment_at: "2026-05-15T09:00:00-03:00",
    created_at: "2026-05-09T14:30:00-03:00",
    last_updated_at: "2026-05-09T15:10:00-03:00",
  },
};

const STAGE_LIST = [
  ["01_ENTRADA_LEAD",          "Cria/atualiza Lead"],
  ["02_LEAD_SEM_RESPOSTA",     "Só atualiza etapa"],
  ["03_LEAD_QUENTE_QUALIFICADO","Só atualiza etapa"],
  ["04_AGENDADO_SEM_PAGAMENTO","Cria Consulta · paga no dia"],
  ["05_AGENDADO_COM_PAGAMENTO","Cria Consulta · pago antecipado"],
  ["06_NAO_COMPARECEU",        "Marca Consulta como 'faltou'"],
  ["07_COMPARECEU_CONSULTA",   "Marca Consulta como 'realizada'"],
  ["09_TRATAMENTO_FECHADO",    "Cria Tratamento · aguardando dados da SDR"],
  ["12_CANCELAMENTO",          "Só atualiza etapa"],
  ["13_ALTA_SATISFEITO",       "Só atualiza etapa"],
  ["14_ALTA_INSATISFEITO",     "Só atualiza etapa"],
  ["15_NAO_PERTURBAR",         "Só atualiza etapa"],
  ["16_ENCAMINHADO",           "Só atualiza etapa"],
  ["17_NAO_DEU_CONTINUIDADE",  "Marca Tratamento como perdido"],
];

/**
 * Monta a especificação completa em markdown.
 * Use o botão "Copiar especificação" e cole no WhatsApp/Slack/email da Cloudia.
 */
function buildSpecMarkdown(): string {
  const groups = Array.from(new Set(FIELD_MAPPING.map((r) => r.group)));
  const tableFor = (g: string) => {
    const rows = FIELD_MAPPING.filter((r) => r.group === g);
    const lines = [
      `### ${g}`,
      "",
      "| Campo | Tipo | Obrigatório | Onde aparece |",
      "|---|---|---|---|",
      ...rows.map(
        (r) =>
          `| \`${r.cloudia}\` | ${r.type} | ${r.required ? "✅" : "—"} | ${r.label} · ${r.location} |`,
      ),
      "",
    ];
    return lines.join("\n");
  };

  const stageTable = [
    "### Etapas (data.stage) → Ação no sistema",
    "",
    "| Etapa | Ação |",
    "|---|---|",
    ...STAGE_LIST.map(([s, a]) => `| \`${s}\` | ${a} |`),
    "",
  ].join("\n");

  return [
    "# Integração Cloudia → Doutor Digital",
    "",
    "Especificação do webhook que recebe leads/eventos da Cloudia e mapeia para o sistema.",
    "",
    "## Endpoint",
    "",
    "```",
    "POST https://doutor-digital-dash-production.up.railway.app/webhooks/cloudia",
    "Content-Type: application/json",
    "```",
    "",
    "Idempotência: a chave é `(provider, contact_id, stage, occurred_at)`. Webhook duplicado é absorvido.",
    "",
    "## Campos do payload",
    "",
    ...groups.map(tableFor),
    stageTable,
    "## Payload de exemplo",
    "",
    "```json",
    JSON.stringify(EXAMPLE_PAYLOAD, null, 2),
    "```",
    "",
    "## Resposta",
    "",
    "- `200 OK` → `{ status: 'queued', envelopeId: 123 }` — evento enfileirado",
    "- `200 OK` → `{ status: 'duplicate' }` — evento já recebido (sem ação)",
    "- `400 Bad Request` → payload inválido",
    "",
  ].join("\n");
}

type Tab = "webhook" | "apikey" | "campos";

export function CloudiaConnectModal({ open, onClose, onConnected }: Props) {
  const [tab, setTab] = useState<Tab>("webhook");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number | "">(180);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    expiresAt?: string | null;
  } | null>(null);

  // URL pública do webhook que a Cloudia já usa em produção.
  // O backend tem POST /webhooks/cloudia em LeadController.cs (AllowAnonymous).
  const webhookUrl = `${API_BASE_URL.replace(/\/$/, "")}/webhooks/cloudia`;

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
          {(
            [
              { id: "webhook", label: "Webhook (entrada)" },
              { id: "campos", label: "Mapeamento de campos" },
              { id: "apikey", label: "API key (saída)" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={[
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === id
                  ? "bg-white/[0.06] text-slate-100 ring-1 ring-inset ring-white/[0.08]"
                  : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
              ].join(" ")}
            >
              {label}
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
                      URL pública que a Cloudia chama quando um lead chega
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
                      Esta é a URL real do backend (
                      <code className="rounded bg-white/[0.04] px-1 text-[11px]">
                        WebhooksController · POST /webhooks/cloudia
                      </code>
                      ). A Cloudia identifica a clínica pelo{" "}
                      <code className="rounded bg-white/[0.04] px-1 text-[11px]">
                        TenantId
                      </code>{" "}
                      no payload.
                    </p>
                  </div>
                </div>
              </div>

              <ol className="space-y-2 text-[12.5px] text-slate-400 list-decimal list-inside">
                <li>
                  No painel da Cloudia → <strong>Configurações → Integrações → Webhooks</strong>.
                </li>
                <li>Cole a URL acima e selecione os eventos do lead.</li>
                <li>
                  Salve. Cada lead novo cai na fila de revisão da{" "}
                  <strong>Central de Cadastros · SDR</strong>.
                </li>
              </ol>

              <Link
                to="/sdr/cadastro-geral"
                onClick={onClose}
                className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-[13px] font-medium text-emerald-200 hover:bg-emerald-400/15 transition-colors"
              >
                <span>Ir para "Revisar leads" agora</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {tab === "campos" && (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-slate-300">
                  Especificação completa pra você passar para a Cloudia. Cada
                  linha = um campo do payload + onde ele aparece no sistema.
                </p>
                <Button
                  onClick={() => copy(buildSpecMarkdown())}
                  className="shrink-0 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar especificação
                </Button>
              </div>

              <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                {/* Tabela agrupada */}
                {Array.from(new Set(FIELD_MAPPING.map((r) => r.group))).map(
                  (group) => (
                    <section
                      key={group}
                      className="rounded-md border border-white/[0.06] overflow-hidden"
                    >
                      <header className="flex items-center gap-2 bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-widest text-slate-400">
                        {group}
                      </header>
                      <table className="w-full text-[12px]">
                        <thead className="bg-white/[0.01] text-[10px] uppercase tracking-widest text-slate-500">
                          <tr>
                            <th className="px-3 py-1.5 text-left w-[36%]">
                              Campo no payload
                            </th>
                            <th className="px-3 py-1.5 text-left w-[16%]">Tipo</th>
                            <th className="px-3 py-1.5 text-left">
                              Aparece em
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {FIELD_MAPPING.filter((r) => r.group === group).map(
                            (row, i) => (
                              <tr key={`${group}-${i}`} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-1.5">
                                  <code className="font-mono text-[11px] text-cyan-200">
                                    {row.cloudia}
                                  </code>
                                  {row.required && (
                                    <span className="ml-1.5 rounded-full bg-rose-400/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase text-rose-300 ring-1 ring-inset ring-rose-400/20">
                                      req
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-slate-400 font-mono text-[10.5px]">
                                  {row.type}
                                </td>
                                <td className="px-3 py-1.5">
                                  <span className="text-slate-200">{row.label}</span>
                                  <span className="ml-2 text-[10.5px] text-slate-500">
                                    {row.location}
                                  </span>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </section>
                  ),
                )}

                {/* Lista de etapas → ações */}
                <section className="rounded-md border border-white/[0.06] overflow-hidden">
                  <header className="bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-widest text-slate-400">
                    Etapas (data.stage) → Ação no sistema
                  </header>
                  <table className="w-full text-[12px]">
                    <tbody className="divide-y divide-white/[0.04]">
                      {STAGE_LIST.map(([stage, action]) => (
                        <tr key={stage} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-1.5 font-mono text-[11px] text-cyan-200 w-[40%]">
                            {stage}
                          </td>
                          <td className="px-3 py-1.5 text-slate-300">{action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* Payload de exemplo */}
                <section className="rounded-md border border-white/[0.06] overflow-hidden">
                  <header className="flex items-center justify-between bg-white/[0.03] px-3 py-1.5">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">
                      Payload de exemplo (POST {webhookUrl})
                    </span>
                    <button
                      onClick={() =>
                        copy(JSON.stringify(EXAMPLE_PAYLOAD, null, 2))
                      }
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <Copy className="inline-block h-3 w-3 mr-1" /> copiar JSON
                    </button>
                  </header>
                  <pre className="bg-black/30 px-3 py-3 text-[11px] text-slate-300 font-mono leading-relaxed overflow-x-auto">
{JSON.stringify(EXAMPLE_PAYLOAD, null, 2)}
                  </pre>
                </section>
              </div>

              <p className="text-[11.5px] text-slate-500">
                Backend: <code>LeadController · POST /webhooks/cloudia</code> →
                enfileira em <code>webhook_envelopes</code> (idempotência por{" "}
                <code>provider + contact_id + stage + occurred_at</code>) →{" "}
                <code>StageWebhookDispatcher</code> roteia por etapa.
              </p>
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
