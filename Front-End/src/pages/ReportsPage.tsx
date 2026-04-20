import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check, Copy, FileDown, FileText, MessageCircle, RefreshCw, Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { reportsService } from "@/services/reports";
import { unitsService } from "@/services/units";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { cn, formatNumber } from "@/lib/utils";
import type { OvernightLeadsDto, RecentLead } from "@/types";

export default function ReportsPage() {
  const { tenantId, unitId } = useClinic();
  const activeClinicId = unitId ?? tenantId ?? null;
  const hasClinic = !!activeClinicId;

  const today = new Date();

  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [dailyDate, setDailyDate] = useState(today.toISOString().slice(0, 10));

  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyData, setDailyData] = useState<unknown>(null);

  async function gerarMensal() {
    if (!activeClinicId) return toast.error("Selecione uma unidade primeiro");
    setMonthlyLoading(true);
    try {
      await reportsService.monthly({
        clinicId: String(activeClinicId),
        mes,
        ano,
      });
      toast.success("PDF gerado");
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setMonthlyLoading(false);
    }
  }

  async function gerarDiario() {
    if (!activeClinicId) return toast.error("Selecione uma unidade primeiro");
    setDailyLoading(true);
    try {
      const data = await reportsService.daily({
        tenantId: String(activeClinicId),
        date: dailyDate,
      });
      setDailyData(data);
      toast.success("Relatório carregado");
    } catch {
      // tratado
    } finally {
      setDailyLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Gere PDFs mensais, visualize o relatório diário e envie resumos por WhatsApp"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Relatório mensal (PDF)"
            subtitle="Taxa de conversão, origens, etapas, unidades"
            action={
              hasClinic ? (
                <Badge tone="green">Unidade #{activeClinicId}</Badge>
              ) : (
                <Badge tone="yellow">Sem unidade</Badge>
              )
            }
          />
          <CardBody className="space-y-3">
            {!hasClinic && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                Selecione uma unidade para gerar o relatório.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mês</label>
                <Select
                  className="mt-1"
                  value={mes}
                  onChange={(e) => setMes(+e.target.value)}
                  disabled={!hasClinic}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1, 1).toLocaleString("pt-BR", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label">Ano</label>
                <Input
                  type="number"
                  className="mt-1"
                  value={ano}
                  onChange={(e) => setAno(+e.target.value)}
                  disabled={!hasClinic}
                />
              </div>
            </div>
            <Button
              onClick={gerarMensal}
              loading={monthlyLoading}
              disabled={!hasClinic}
              className="w-full justify-center mt-4"
            >
              <FileDown className="h-4 w-4" /> Baixar PDF
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Relatório diário"
            subtitle="Agendamentos, resgates, motivos"
            action={
              hasClinic ? (
                <Badge tone="green">Unidade #{activeClinicId}</Badge>
              ) : (
                <Badge tone="yellow">Sem unidade</Badge>
              )
            }
          />
          <CardBody className="space-y-3">
            {!hasClinic && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
                Selecione uma unidade para carregar o relatório diário.
              </div>
            )}
            <div>
              <label className="label">Data</label>
              <Input
                type="date"
                className="mt-1"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                disabled={!hasClinic}
              />
            </div>
            <div className="mt-4">
              <Button
                onClick={gerarDiario}
                loading={dailyLoading}
                disabled={!hasClinic}
                className="w-full justify-center"
              >
                <FileText className="h-4 w-4" /> Visualizar relatório
              </Button>
            </div>

            {dailyData !== null && (
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <pre className="text-[11px] text-slate-300 overflow-auto max-h-72">
                  {JSON.stringify(dailyData, null, 2)}
                </pre>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <WhatsAppReportCard />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Card: Enviar relatório por WhatsApp
 *  Consome /webhooks/amanheceu (madrugada) + /webhooks/recent (manhã).
 *  Sem integração real — gera texto e abre wa.me no navegador.
 * ═══════════════════════════════════════════════════════════════ */

type ReportStyle = "whatsapp" | "markdown" | "plain";

type EmojiKey =
  | "header"
  | "date"
  | "time"
  | "overnight"
  | "morning"
  | "loading"
  | "hourly"
  | "source"
  | "leads";

type EmojiMap = Record<EmojiKey, string>;

interface FormatOptions {
  includeHeader: boolean;
  includeOvernight: boolean;
  includeMorning: boolean;
  includeTopOrigens: boolean;
  includeLeadList: boolean;
  includeHourBreakdown: boolean;
  includeFooter: boolean;
  useEmojis: boolean;
  leadListLimit: number;
  morningStart: number;
  morningEnd: number;
  style: ReportStyle;
  signature: string;
  emojis: EmojiMap;
}

const DEFAULT_EMOJIS: EmojiMap = {
  header: "📊",
  date: "📅",
  time: "🕐",
  overnight: "🌙",
  morning: "☀️",
  loading: "⏳",
  hourly: "⏱",
  source: "📣",
  leads: "👥",
};

const EMOJI_LABELS: Record<EmojiKey, string> = {
  header: "Cabeçalho",
  date: "Data",
  time: "Horário",
  overnight: "Madrugada",
  morning: "Manhã",
  loading: "Carregando",
  hourly: "Por hora",
  source: "Top origens",
  leads: "Lista de leads",
};

const DEFAULT_OPTIONS: FormatOptions = {
  includeHeader: true,
  includeOvernight: true,
  includeMorning: true,
  includeTopOrigens: true,
  includeLeadList: false,
  includeHourBreakdown: true,
  includeFooter: true,
  useEmojis: true,
  leadListLimit: 5,
  morningStart: 8,
  morningEnd: 12,
  style: "whatsapp",
  signature: "Doutor Digital · Relatório automático",
  emojis: DEFAULT_EMOJIS,
};

function WhatsAppReportCard() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const { unitId: activeUnitId, tenantId: activeTenantId } = useClinic();

  const unitsQuery = useQuery({
    queryKey: ["units", "list"],
    queryFn: () => unitsService.list(),
  });
  const units = unitsQuery.data ?? [];

  const activeClinicFallback = String(activeUnitId ?? activeTenantId ?? "");
  const [unitValue, setUnitValue] = useState<string>("");
  const resolvedUnitId = unitValue || activeClinicFallback;
  const resolvedUnit = units.find(
    (u) => String(u.clinicId) === resolvedUnitId || String(u.id) === resolvedUnitId,
  );

  const [referenceDate, setReferenceDate] = useState(todayStr);
  const [whatsappRaw, setWhatsappRaw] = useState("");
  const [opts, setOpts] = useState<FormatOptions>(DEFAULT_OPTIONS);

  const patch = (p: Partial<FormatOptions>) => setOpts((prev) => ({ ...prev, ...p }));

  // ─── Data fetching ───────────────────────────────────────────
  const overnightQuery = useQuery({
    queryKey: ["overnight", resolvedUnitId, referenceDate],
    queryFn: () =>
      webhooksService.amanheceu({
        clinicId: resolvedUnitId,
        startHour: 20,
        endHour: 7,
      }),
    enabled: !!resolvedUnitId && opts.includeOvernight,
  });

  // Janela 08-12 do dia de referência — usamos /recent e filtramos no client
  const hoursNeeded = useMemo(() => {
    const ref = new Date(`${referenceDate}T${String(opts.morningEnd).padStart(2, "0")}:00:00`);
    const diffMs = Date.now() - ref.getTime();
    const baseHours = Math.max(1, Math.ceil(diffMs / 3_600_000));
    const windowHours = Math.max(1, opts.morningEnd - opts.morningStart);
    // Buffer de 2h pra acomodar fuso
    return Math.min(720, baseHours + windowHours + 2);
  }, [referenceDate, opts.morningStart, opts.morningEnd]);

  const recentQuery = useQuery({
    queryKey: ["recent", resolvedUnitId, hoursNeeded],
    queryFn: () =>
      webhooksService.recentLeads({
        clinicId: resolvedUnitId,
        hours: hoursNeeded,
        limit: 200,
      }),
    enabled: !!resolvedUnitId && opts.includeMorning,
  });

  const morningLeads: RecentLead[] = useMemo(() => {
    const all = recentQuery.data?.items ?? [];
    const start = new Date(
      `${referenceDate}T${String(opts.morningStart).padStart(2, "0")}:00:00`,
    );
    const end = new Date(
      `${referenceDate}T${String(opts.morningEnd).padStart(2, "0")}:00:00`,
    );
    return all.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
  }, [recentQuery.data, referenceDate, opts.morningStart, opts.morningEnd]);

  // ─── Render texto ────────────────────────────────────────────
  const reportText = useMemo(
    () =>
      buildReport({
        opts,
        referenceDate,
        unitName: resolvedUnit?.name ?? `Clínica ${resolvedUnitId}`,
        overnight: overnightQuery.data ?? null,
        morningLeads,
        morningWindow: { start: opts.morningStart, end: opts.morningEnd },
      }),
    [opts, referenceDate, resolvedUnit, resolvedUnitId, overnightQuery.data, morningLeads],
  );

  const waDigits = whatsappRaw.replace(/\D/g, "");
  const waValid = waDigits.length >= 12 && waDigits.length <= 13;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success("Texto copiado para a área de transferência");
    } catch {
      toast.error("Falha ao copiar — seu navegador pode ter bloqueado");
    }
  };

  const handleSendWhatsApp = () => {
    if (!waValid) {
      toast.error("Número de WhatsApp inválido (use +55 DDD + 8 ou 9 dígitos)");
      return;
    }
    const normalized = waDigits.startsWith("55") ? waDigits : `55${waDigits}`;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(reportText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadingAnything =
    unitsQuery.isLoading ||
    (opts.includeOvernight && overnightQuery.isLoading) ||
    (opts.includeMorning && recentQuery.isLoading);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <img src="https://e7.pngegg.com/pngimages/413/909/png-clipart-call-illustration-whatsapp-computer-icons-whatsapp-text-logo-thumbnail.png" alt="" width={20}/>
            Enviar relatório por WhatsApp
          </span>
        }
        subtitle="Resumo da madrugada (20h → 07h) + expediente da manhã (08h → 12h) · customizável"
        action={<Badge tone="green">Ao vivo</Badge>}
      />
      <CardBody className="space-y-5">
        {/* ─── Destinatário + unidade ─── */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label">Unidade</label>
            <Select
              className="mt-1"
              value={resolvedUnitId}
              onChange={(e) => setUnitValue(e.target.value)}
              disabled={unitsQuery.isLoading}
            >
              <option value="">
                {unitsQuery.isLoading
                  ? "Carregando unidades…"
                  : "Selecione uma unidade"}
              </option>
              {units.map((u) => (
                <option key={u.id} value={String(u.clinicId ?? u.id)}>
                  {u.name ?? `Clínica ${u.clinicId ?? u.id}`}
                </option>
              ))}
            </Select>
            {resolvedUnit && !unitValue && (
              <p className="mt-1 text-[10.5px] text-slate-500">
                Unidade ativa: <strong>{resolvedUnit.name}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="label">Data de referência</label>
            <Input
              className="mt-1"
              type="date"
              value={referenceDate}
              max={todayStr}
              onChange={(e) => setReferenceDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">WhatsApp do destinatário</label>
            <Input
              className="mt-1"
              type="tel"
              placeholder="+55 63 9xxxx-xxxx"
              value={formatPhoneMask(whatsappRaw)}
              onChange={(e) => setWhatsappRaw(e.target.value)}
            />
            <p className={cn(
              "mt-1 text-[10.5px]",
              whatsappRaw && !waValid ? "text-rose-400" : "text-slate-500"
            )}>
              {whatsappRaw && !waValid
                ? "Número inválido — inclua DDI (55) + DDD + 8 ou 9 dígitos"
                : "Com DDI + DDD. O botão abaixo abre o WhatsApp Web com a mensagem pronta."}
            </p>
          </div>
        </div>

        {/* ─── Opções de formato ─── */}
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Formato do relatório
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Seções
              </p>
              <Toggle
                label="Cabeçalho (unidade, data)"
                value={opts.includeHeader}
                onChange={(v) => patch({ includeHeader: v })}
              />
              <Toggle
                label="Janela da madrugada (20h → 07h)"
                value={opts.includeOvernight}
                onChange={(v) => patch({ includeOvernight: v })}
              />
              <Toggle
                label={`Janela da manhã (${pad(opts.morningStart)}h → ${pad(opts.morningEnd)}h)`}
                value={opts.includeMorning}
                onChange={(v) => patch({ includeMorning: v })}
              />
              <Toggle
                label="Distribuição por hora"
                value={opts.includeHourBreakdown}
                onChange={(v) => patch({ includeHourBreakdown: v })}
              />
              <Toggle
                label="Top origens"
                value={opts.includeTopOrigens}
                onChange={(v) => patch({ includeTopOrigens: v })}
              />
              <Toggle
                label="Lista de leads"
                value={opts.includeLeadList}
                onChange={(v) => patch({ includeLeadList: v })}
              />
              <Toggle
                label="Assinatura final"
                value={opts.includeFooter}
                onChange={(v) => patch({ includeFooter: v })}
              />
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Janela da manhã
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Início</label>
                  <Select
                    className="mt-1"
                    value={opts.morningStart}
                    onChange={(e) => patch({ morningStart: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                      <option key={h} value={h}>{pad(h)}:00</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="label">Fim</label>
                  <Select
                    className="mt-1"
                    value={opts.morningEnd}
                    onChange={(e) => patch({ morningEnd: Number(e.target.value) })}
                  >
                    {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                      <option key={h} value={h}>{pad(h)}:00</option>
                    ))}
                  </Select>
                </div>
              </div>
              {opts.morningEnd <= opts.morningStart && (
                <p className="text-[11px] text-rose-300">
                  Fim precisa ser maior que o início.
                </p>
              )}

              <div>
                <label className="label">Leads na lista (máx.)</label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  className="mt-1"
                  value={opts.leadListLimit}
                  onChange={(e) =>
                    patch({
                      leadListLimit: Math.max(1, Math.min(50, Number(e.target.value) || 5)),
                    })
                  }
                  disabled={!opts.includeLeadList}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Estilo
              </p>
              <Select value={opts.style} onChange={(e) => patch({ style: e.target.value as ReportStyle })}>
                <option value="whatsapp">WhatsApp (*negrito* _itálico_)</option>
                <option value="markdown">Markdown (**negrito**)</option>
                <option value="plain">Texto simples</option>
              </Select>
              <Toggle
                label="Usar emojis"
                value={opts.useEmojis}
                onChange={(v) => patch({ useEmojis: v })}
              />
              <EmojiPicker
                emojis={opts.emojis}
                disabled={!opts.useEmojis}
                onChange={(next) => patch({ emojis: next })}
                onReset={() => patch({ emojis: DEFAULT_EMOJIS })}
              />
              <div>
                <label className="label">Assinatura</label>
                <Input
                  className="mt-1"
                  value={opts.signature}
                  onChange={(e) => patch({ signature: e.target.value })}
                  placeholder="Sua assinatura no rodapé"
                  disabled={!opts.includeFooter}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Preview + ações ─── */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Preview
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              {loadingAnything && (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> carregando dados…
                </span>
              )}
              <span className="tabular-nums">
                {formatNumber(reportText.length)} caracteres
              </span>
            </div>
          </div>

          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.08] bg-[rgba(10,10,18,0.85)] p-4 font-mono text-[12.5px] leading-relaxed text-slate-200">
{reportText || "(selecione uma unidade e ajuste as opções acima)"}
          </pre>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpts(DEFAULT_OPTIONS)}>
              Resetar formato
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={!reportText}>
              <Copy className="mr-2 h-4 w-4" /> Copiar texto
            </Button>
            <Button
              onClick={handleSendWhatsApp}
              disabled={!reportText || !waValid || !resolvedUnitId}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Send className="mr-2 h-4 w-4" /> Abrir no WhatsApp
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
          <Check className="mr-1 inline h-3 w-3" />
          A integração direta com a API do WhatsApp ainda está em desenvolvimento.
          Por enquanto o botão abre o <strong>wa.me</strong> com a mensagem pronta —
          você só precisa tocar em enviar.
        </div>
      </CardBody>
    </Card>
  );
}

/* ─── Toggle reutilizável ─────────────────────────────────────── */

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-300">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-emerald-500"
      />
      {label}
    </label>
  );
}

/* ─── Emoji picker por seção ─────────────────────────────────── */

function EmojiPicker({
  emojis,
  disabled,
  onChange,
  onReset,
}: {
  emojis: EmojiMap;
  disabled?: boolean;
  onChange: (next: EmojiMap) => void;
  onReset: () => void;
}) {
  const keys = Object.keys(EMOJI_LABELS) as EmojiKey[];
  return (
    <div className={cn("space-y-2", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Emojis por seção
        </p>
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="text-[10px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline disabled:cursor-not-allowed"
        >
          Restaurar padrão
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {keys.map((k) => (
          <label
            key={k}
            className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
          >
            <input
              type="text"
              value={emojis[k] ?? ""}
              onChange={(e) => onChange({ ...emojis, [k]: e.target.value })}
              disabled={disabled}
              maxLength={8}
              placeholder={DEFAULT_EMOJIS[k]}
              className="w-8 bg-transparent text-center text-[15px] outline-none disabled:cursor-not-allowed"
            />
            <span className="truncate text-[11px] text-slate-400">
              {EMOJI_LABELS[k]}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Construção do texto do relatório
 * ═══════════════════════════════════════════════════════════════ */

function buildReport(args: {
  opts: FormatOptions;
  referenceDate: string;
  unitName: string;
  overnight: OvernightLeadsDto | null;
  morningLeads: RecentLead[];
  morningWindow: { start: number; end: number };
}): string {
  const { opts, referenceDate, unitName, overnight, morningLeads, morningWindow } = args;
  const S = styleFns(opts.style);
  const emojis = { ...DEFAULT_EMOJIS, ...(opts.emojis ?? {}) };
  const em = (key: EmojiKey) => {
    if (!opts.useEmojis) return "";
    const glyph = emojis[key];
    return glyph ? glyph + " " : "";
  };
  const lines: string[] = [];

  if (opts.includeHeader) {
    lines.push(em("header") + S.bold(`Relatório diário — ${unitName}`));
    lines.push(em("date") + "Data: " + formatBrDate(referenceDate));
    lines.push(em("time") + "Gerado em: " + formatNowBr());
    lines.push("");
  }

  if (opts.includeOvernight) {
    const header = em("overnight") + S.bold("Madrugada — 20h → 07h");
    lines.push(header);
    if (!overnight) {
      lines.push(em("loading") + "carregando dados da madrugada…");
    } else {
      lines.push(
        `• Total: ${S.bold(String(overnight.total))} lead${overnight.total === 1 ? "" : "s"}`,
      );
      lines.push(
        `• Janela: ${S.italic(
          `${formatBrDate(overnight.periodStartLocal)} ${String(overnight.startHour).padStart(2, "0")}h → ${String(
            overnight.endHour,
          ).padStart(2, "0")}h`,
        )}`,
      );
      if (opts.includeHourBreakdown && overnight.hourBreakdown.length > 0) {
        lines.push(em("hourly") + S.italic("por hora:"));
        const nonZero = overnight.hourBreakdown.filter((b) => b.count > 0);
        if (nonZero.length === 0) lines.push("  · sem leads");
        else
          nonZero.forEach((b) =>
            lines.push(`  · ${String(b.hour).padStart(2, "0")}h: ${b.count}`),
          );
      }
      if (opts.includeTopOrigens && overnight.sourceBreakdown.length > 0) {
        lines.push(em("source") + S.italic("top origens:"));
        overnight.sourceBreakdown.slice(0, 5).forEach((s) =>
          lines.push(`  · ${s.source || "—"}: ${s.count}`),
        );
      }
      if (opts.includeLeadList && overnight.leads.length > 0) {
        lines.push(em("leads") + S.italic("leads:"));
        overnight.leads.slice(0, opts.leadListLimit).forEach((l) => {
          const time = formatBrTime(l.createdAtLocal ?? l.createdAt);
          lines.push(
            `  · ${time} — ${l.name || "Sem nome"}${l.source ? ` · ${l.source}` : ""}`,
          );
        });
      }
    }
    lines.push("");
  }

  if (opts.includeMorning) {
    const ws = String(morningWindow.start).padStart(2, "0");
    const we = String(morningWindow.end).padStart(2, "0");
    lines.push(em("morning") + S.bold(`Manhã — ${ws}h → ${we}h`));
    lines.push(
      `• Total: ${S.bold(String(morningLeads.length))} lead${morningLeads.length === 1 ? "" : "s"}`,
    );
    lines.push(`• Data: ${S.italic(formatBrDate(referenceDate))}`);

    if (opts.includeHourBreakdown && morningLeads.length > 0) {
      const byHour = new Map<number, number>();
      morningLeads.forEach((l) => {
        const h = new Date(l.created_at).getHours();
        byHour.set(h, (byHour.get(h) ?? 0) + 1);
      });
      lines.push(em("hourly") + S.italic("por hora:"));
      Array.from(byHour.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([h, c]) => lines.push(`  · ${String(h).padStart(2, "0")}h: ${c}`));
    }

    if (opts.includeTopOrigens && morningLeads.length > 0) {
      const bySrc = new Map<string, number>();
      morningLeads.forEach((l) => {
        const k = l.source || "—";
        bySrc.set(k, (bySrc.get(k) ?? 0) + 1);
      });
      const top = Array.from(bySrc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (top.length > 0) {
        lines.push(em("source") + S.italic("top origens:"));
        top.forEach(([src, c]) => lines.push(`  · ${src}: ${c}`));
      }
    }

    if (opts.includeLeadList && morningLeads.length > 0) {
      lines.push(em("leads") + S.italic("leads:"));
      morningLeads.slice(0, opts.leadListLimit).forEach((l) => {
        const time = formatBrTime(l.created_at);
        lines.push(
          `  · ${time} — ${l.name || "Sem nome"}${l.source ? ` · ${l.source}` : ""}`,
        );
      });
    }
    lines.push("");
  }

  if (opts.includeFooter) {
    lines.push("—".repeat(24));
    lines.push(S.italic(opts.signature || "Relatório gerado automaticamente"));
  }

  return lines.join("\n").trim();
}

/* ─── style helpers ─── */

function styleFns(style: ReportStyle) {
  if (style === "whatsapp")
    return {
      bold: (s: string) => `*${s}*`,
      italic: (s: string) => `_${s}_`,
    };
  if (style === "markdown")
    return {
      bold: (s: string) => `**${s}**`,
      italic: (s: string) => `*${s}*`,
    };
  return { bold: (s: string) => s, italic: (s: string) => s };
}

/* ─── helpers ─── */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatBrDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatBrTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatNowBr(): string {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length === 0) return "";
  // +55 (63) 91234-5678 — DDI fixo 55
  const countryDigits = digits.startsWith("55") ? digits : `55${digits}`.slice(0, 13);
  const cc = "+" + countryDigits.slice(0, 2);
  const dd = countryDigits.slice(2, 4);
  const rest = countryDigits.slice(4);
  if (rest.length === 0) return cc + (dd ? ` (${dd}` : "");
  if (rest.length <= 4) return `${cc} (${dd}) ${rest}`;
  if (rest.length <= 8) return `${cc} (${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${cc} (${dd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}
