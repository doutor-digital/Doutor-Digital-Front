import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  BarChart as BarChartIcon,
  Battery,
  CalendarDays,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  ImageUp,
  LayoutGrid,
  Link2,
  ListTree,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  PieChart as PieChartIcon,
  RefreshCw,
  Send,
  Signal,
  Smile,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Wallet,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/kpi/KpiCard";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/Table";
import { reportsService } from "@/services/reports";
import { unitsService } from "@/services/units";
import { useClinic } from "@/hooks/useClinic";
import {
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  stageLabel,
} from "@/lib/utils";
import type {
  DailyRelatoryDto,
  RelatorioMensalResumoDto,
} from "@/types";

/* ═══════════════════════════════════════════════════════════════
 *  Tipos e constantes
 * ═══════════════════════════════════════════════════════════════ */

type Mode = "daily" | "monthly";
type TabValue = "overview" | "units" | "sources" | "whatsapp";
type ReportStyle = "whatsapp" | "markdown" | "plain";

interface FormatOptions {
  useEmojis: boolean;
  includeObservations: boolean;
  includeAttendants: boolean;
  includeTopOrigens: boolean;
  includeDaily: boolean;
  style: ReportStyle;
  signature: string;
}

type LintSeverity = "error" | "warning" | "info";

interface LintIssue {
  severity: LintSeverity;
  code: string;
  message: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  intro: string;
  outro: string;
  builtin?: boolean;
}

type TemplateVars = Record<string, string | number>;

const TEMPLATE_VARS_DOC: Array<{ key: string; desc: string }> = [
  { key: "periodLabel", desc: "Período do relatório" },
  { key: "unitLabel", desc: "Nome da unidade" },
  { key: "mode", desc: '"diário" ou "mensal"' },
  { key: "leads", desc: "Total de leads" },
  { key: "agendamentos", desc: "Total de agendamentos" },
  { key: "comPagamento", desc: "Com pagamento" },
  { key: "conversao", desc: "% de conversão" },
  { key: "date", desc: "Data/hora atual (gerado em)" },
  { key: "userName", desc: "Seu nome / assinatura" },
];

const BUILTIN_TEMPLATES: MessageTemplate[] = [
  {
    id: "raw",
    name: "Sem wrapper",
    description: "Envia apenas o relatório gerado, sem cumprimento ou despedida.",
    intro: "",
    outro: "",
    builtin: true,
  },
  {
    id: "corporate",
    name: "Saudação corporativa",
    description: "Tom formal com cumprimento, contexto e despedida profissional.",
    intro:
      "Olá! Segue o relatório de *{{unitLabel}}* referente a *{{periodLabel}}*.\n\n",
    outro:
      "\n\nQualquer dúvida estou à disposição.\n_— {{userName}}_",
    builtin: true,
  },
  {
    id: "executive",
    name: "Resumo executivo",
    description: "Cabeçalho destacado e rodapé técnico com timestamp.",
    intro:
      "📊 *Resumo {{mode}} · {{periodLabel}}*\n🏥 {{unitLabel}}\n\n━━━━━━━━━━━━━━━━━\n\n",
    outro:
      "\n\n━━━━━━━━━━━━━━━━━\n_Gerado automaticamente em {{date}}_",
    builtin: true,
  },
  {
    id: "casual",
    name: "Casual",
    description: "Tom informal e direto, ideal para conversas frequentes.",
    intro: "Oi! 👋\n\nSegue o resumo de hoje:\n\n",
    outro: "\n\nQualquer coisa, é só chamar! 🙌",
    builtin: true,
  },
];

const TEMPLATES_STORAGE_KEY = "wa-templates-v1";
const TEMPLATE_ID_STORAGE_KEY = "wa-template-active-v1";

const DEFAULT_OPTIONS: FormatOptions = {
  useEmojis: true,
  includeObservations: true,
  includeAttendants: true,
  includeTopOrigens: true,
  includeDaily: false,
  style: "whatsapp",
  signature: "Doutor Digital · Relatório automático",
};

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const CHART_PALETTE = [
  "#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa",
  "#2dd4bf", "#fb7185", "#facc15", "#818cf8", "#94a3b8",
];

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(10,10,13,0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  color: "#e2e8f0",
};

/* ═══════════════════════════════════════════════════════════════
 *  Página
 * ═══════════════════════════════════════════════════════════════ */

export default function ReportsPage() {
  const { tenantId: activeTenantId, unitId: activeUnitId } = useClinic();
  const activeClinicFallback = activeUnitId ?? activeTenantId ?? null;

  const unitsQuery = useQuery({
    queryKey: ["units", "list"],
    queryFn: () => unitsService.list(),
  });
  const units = unitsQuery.data ?? [];

  // ── URL state (compartilhável) ─────────────────────
  const url = new URL(window.location.href);
  const qpMode = url.searchParams.get("mode") as Mode | null;
  const qpUnit = url.searchParams.get("unit");
  const qpDate = url.searchParams.get("date");
  const qpMes = url.searchParams.get("mes");
  const qpAno = url.searchParams.get("ano");

  const [mode, setMode] = useState<Mode>(qpMode === "monthly" ? "monthly" : "daily");
  const [tab, setTab] = useState<TabValue>("overview");
  const [unitValue, setUnitValue] = useState<string>(qpUnit ?? "");
  const resolvedUnitId = unitValue || String(activeClinicFallback ?? "");
  const hasClinic = !!resolvedUnitId;

  const resolvedUnit = units.find(
    (u) => String(u.clinicId) === resolvedUnitId || String(u.id) === resolvedUnitId,
  );
  const unitLabel = resolvedUnit?.name ?? (resolvedUnitId ? `Clínica #${resolvedUnitId}` : "Sem unidade");

  const [dailyDate, setDailyDate] = useState(qpDate || todayIsoLocal());

  const now = new Date();
  const [mes, setMes] = useState(qpMes ? Number(qpMes) : now.getMonth() + 1);
  const [ano, setAno] = useState(qpAno ? Number(qpAno) : now.getFullYear());

  const [compare, setCompare] = useState(true);

  // ── URL sync ───────────────────────────────────────
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("mode", mode);
    if (resolvedUnitId) u.searchParams.set("unit", resolvedUnitId);
    else u.searchParams.delete("unit");
    if (mode === "daily") {
      u.searchParams.set("date", dailyDate);
      u.searchParams.delete("mes");
      u.searchParams.delete("ano");
    } else {
      u.searchParams.set("mes", String(mes));
      u.searchParams.set("ano", String(ano));
      u.searchParams.delete("date");
    }
    window.history.replaceState(null, "", u.toString());
  }, [mode, resolvedUnitId, dailyDate, mes, ano]);

  // ── WhatsApp destinatário ──────────────────────────
  const [whatsappRaw, setWhatsappRaw] = useState("");
  const waDigits = whatsappRaw.replace(/\D/g, "");
  const waValid = waDigits.length >= 12 && waDigits.length <= 13;

  // ── Opções de formato ──────────────────────────────
  const [opts, setOpts] = useState<FormatOptions>(DEFAULT_OPTIONS);
  const patch = (p: Partial<FormatOptions>) => setOpts((prev) => ({ ...prev, ...p }));

  // ── Templates de mensagem ──────────────────────────
  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>(() =>
    loadCustomTemplates(),
  );
  const [templateId, setTemplateId] = useState<string>(() => {
    try {
      return localStorage.getItem(TEMPLATE_ID_STORAGE_KEY) || "raw";
    } catch {
      return "raw";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_ID_STORAGE_KEY, templateId);
    } catch {
      /* noop */
    }
  }, [templateId]);

  const allTemplates = useMemo<MessageTemplate[]>(
    () => [...BUILTIN_TEMPLATES, ...customTemplates],
    [customTemplates],
  );
  const activeTemplate =
    allTemplates.find((t) => t.id === templateId) ?? BUILTIN_TEMPLATES[0];

  const saveCustomTemplate = (tpl: MessageTemplate) => {
    setCustomTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === tpl.id);
      const next = idx >= 0
        ? prev.map((t, i) => (i === idx ? { ...tpl, builtin: false } : t))
        : [...prev, { ...tpl, builtin: false }];
      saveCustomTemplates(next);
      return next;
    });
    setTemplateId(tpl.id);
  };

  const deleteCustomTemplate = (id: string) => {
    setCustomTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveCustomTemplates(next);
      return next;
    });
    if (templateId === id) setTemplateId("raw");
  };

  // ── Imagem ─────────────────────────────────────────
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── Queries: período atual ─────────────────────────
  const dailyQuery = useQuery({
    queryKey: ["relatorio", "daily", resolvedUnitId, dailyDate],
    queryFn: () => reportsService.daily({ tenantId: resolvedUnitId, date: dailyDate }),
    enabled: mode === "daily" && !!resolvedUnitId,
  });

  const monthlyQuery = useQuery({
    queryKey: ["relatorio", "monthly", resolvedUnitId, mes, ano],
    queryFn: () => reportsService.monthlySummary({ clinicId: resolvedUnitId, mes, ano }),
    enabled: mode === "monthly" && !!resolvedUnitId,
    retry: false,
  });

  // ── Queries: período anterior (para trend) ─────────
  const prevDailyDate = useMemo(() => addDaysIso(dailyDate, -1), [dailyDate]);
  const prevDailyQuery = useQuery({
    queryKey: ["relatorio", "daily", resolvedUnitId, prevDailyDate, "prev"],
    queryFn: () => reportsService.daily({ tenantId: resolvedUnitId, date: prevDailyDate }),
    enabled: compare && mode === "daily" && !!resolvedUnitId,
  });

  const prevMonthly = useMemo(() => subtractMonth(mes, ano), [mes, ano]);
  const prevMonthlyQuery = useQuery({
    queryKey: ["relatorio", "monthly", resolvedUnitId, prevMonthly.mes, prevMonthly.ano, "prev"],
    queryFn: () =>
      reportsService.monthlySummary({
        clinicId: resolvedUnitId,
        mes: prevMonthly.mes,
        ano: prevMonthly.ano,
      }),
    enabled: compare && mode === "monthly" && !!resolvedUnitId,
    retry: false,
  });

  // ── Agregados / KPIs ───────────────────────────────
  const dailyAggregate = useMemo(() => aggregateDaily(dailyQuery.data ?? []), [dailyQuery.data]);
  const prevDailyAggregate = useMemo(() => aggregateDaily(prevDailyQuery.data ?? []), [prevDailyQuery.data]);

  const loading = mode === "daily" ? dailyQuery.isFetching : monthlyQuery.isFetching;
  const errored = mode === "daily" ? dailyQuery.isError : monthlyQuery.isError;
  const emptyMonthly = mode === "monthly" && monthlyQuery.isError;

  const lastUpdated = mode === "daily" ? dailyQuery.dataUpdatedAt : monthlyQuery.dataUpdatedAt;

  const kpis = useMemo(() => {
    if (mode === "daily") {
      const a = dailyAggregate;
      const p = prevDailyAggregate;
      const trend = (cur: number, prev: number | null) =>
        compare && prev !== null ? percentChange(cur, prev) : undefined;
      return [
        {
          label: "Leads",
          value: a.total,
          icon: <Users />,
          tone: "sky" as const,
          trend: trend(a.total, compare ? p.total : null),
          subtitle: compare ? `Ontem: ${formatNumber(p.total)}` : undefined,
        },
        {
          label: "Agendamentos",
          value: a.agendamentos,
          icon: <CalendarDays />,
          tone: "amber" as const,
          trend: trend(a.agendamentos, compare ? p.agendamentos : null),
          subtitle:
            a.total > 0
              ? `${formatPercent((a.agendamentos / a.total) * 100)} de conversão`
              : "sem leads",
        },
        {
          label: "Com pagamento",
          value: a.comPagamento,
          icon: <Wallet />,
          tone: "emerald" as const,
          trend: trend(a.comPagamento, compare ? p.comPagamento : null),
          subtitle:
            a.agendamentos > 0
              ? `${formatPercent((a.comPagamento / a.agendamentos) * 100)} dos agendamentos`
              : undefined,
        },
        {
          label: "Resgates",
          value: a.resgastes,
          icon: <Sparkles />,
          tone: "indigo" as const,
          trend: trend(a.resgastes, compare ? p.resgastes : null),
        },
      ];
    }
    const d = monthlyQuery.data;
    const p = prevMonthlyQuery.data;
    const trend = (cur?: number, prev?: number) =>
      compare && cur !== undefined && prev !== undefined ? percentChange(cur, prev) : undefined;
    return [
      {
        label: "Leads",
        value: d?.totalLeads ?? 0,
        icon: <Users />,
        tone: "sky" as const,
        trend: trend(d?.totalLeads, p?.totalLeads),
        subtitle: compare && p ? `${MESES_CURTO[p.mes - 1]}: ${formatNumber(p.totalLeads)}` : undefined,
      },
      {
        label: "Conversão",
        value: d ? formatPercent(d.taxaConversaoPercent) : "—",
        icon: <Sparkles />,
        tone: "amber" as const,
        trend: trend(d?.taxaConversaoPercent, p?.taxaConversaoPercent),
      },
      {
        label: "Ticket médio",
        value: d ? formatCurrency(d.ticketMedio) : "—",
        icon: <Wallet />,
        tone: "emerald" as const,
        trend: trend(d?.ticketMedio, p?.ticketMedio),
      },
      {
        label: "Unidades ativas",
        value: d?.leadsPorUnidade.length ?? 0,
        icon: <LayoutGrid />,
        tone: "indigo" as const,
      },
    ];
  }, [mode, dailyAggregate, prevDailyAggregate, monthlyQuery.data, prevMonthlyQuery.data, compare]);

  // ── Texto bruto do relatório (sem template wrapper) ────
  const reportBody = useMemo(() => {
    if (!hasClinic) return "";
    if (mode === "daily") {
      const rows = dailyQuery.data ?? [];
      return buildDailyText({ rows, date: dailyDate, unitLabel, opts });
    }
    const data = monthlyQuery.data;
    if (!data) return "";
    return buildMonthlyText({ data, opts });
  }, [mode, hasClinic, dailyQuery.data, monthlyQuery.data, dailyDate, unitLabel, opts]);

  // ── Variáveis disponíveis para templates ───────────
  const periodLabel =
    mode === "daily"
      ? formatBrDate(dailyDate)
      : `${MESES_PT[mes - 1]} / ${ano}`;

  const templateVars = useMemo<TemplateVars>(() => {
    const nowStr = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (mode === "daily") {
      const a = dailyAggregate;
      return {
        periodLabel,
        unitLabel,
        mode: "diário",
        leads: a.total,
        agendamentos: a.agendamentos,
        comPagamento: a.comPagamento,
        conversao:
          a.total > 0
            ? formatPercent((a.agendamentos / a.total) * 100)
            : "—",
        date: nowStr,
        userName: "Doutor Digital",
      };
    }
    const d = monthlyQuery.data;
    return {
      periodLabel,
      unitLabel,
      mode: "mensal",
      leads: d?.totalLeads ?? 0,
      agendamentos: 0,
      comPagamento: 0,
      conversao: d ? formatPercent(d.taxaConversaoPercent) : "—",
      date: nowStr,
      userName: "Doutor Digital",
    };
  }, [mode, dailyAggregate, monthlyQuery.data, periodLabel, unitLabel]);

  // ── Texto final aplicando o template ───────────────
  const reportText = useMemo(
    () => applyTemplate(activeTemplate, reportBody, templateVars),
    [activeTemplate, reportBody, templateVars],
  );

  // ── Lint da mensagem ───────────────────────────────
  const lintIssues = useMemo(
    () =>
      lintMessage(reportText, {
        hasRecipient: !!whatsappRaw,
        recipientValid: waValid,
        hasClinic,
      }),
    [reportText, whatsappRaw, waValid, hasClinic],
  );
  const hasLintError = lintIssues.some((i) => i.severity === "error");

  // ── Handlers ───────────────────────────────────────
  const handleCopyText = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success("Texto copiado");
    } catch {
      toast.error("Falha ao copiar — seu navegador pode ter bloqueado");
    }
  };

  const handleImageFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (image) URL.revokeObjectURL(image.url);
    setImage({ file, url: URL.createObjectURL(file) });
  };

  const clearImage = () => {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCopyImage = async () => {
    if (!image) return;
    try {
      await copyImageToClipboard(image.file);
      toast.success("Imagem copiada. Cole (Ctrl+V) no WhatsApp Web.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao copiar imagem.";
      toast.error(msg);
    }
  };

  const handleDownloadImage = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = image.file.name || "relatorio.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadPdf = async () => {
    if (mode !== "monthly") return;
    if (!hasClinic) return toast.error("Selecione uma unidade primeiro.");
    try {
      await reportsService.monthly({ clinicId: resolvedUnitId, mes, ano });
      toast.success("PDF baixado");
    } catch {
      /* tratado pelo interceptor */
    }
  };

  const handleSendWhatsApp = () => {
    if (hasLintError) {
      const firstErr = lintIssues.find((i) => i.severity === "error");
      return toast.error(firstErr?.message ?? "Corrija os erros antes de enviar.");
    }
    if (!reportText) return toast.error("Gere o relatório primeiro.");
    if (!waValid) return toast.error("Número de WhatsApp inválido (use +55 DDD + 8 ou 9 dígitos).");
    const normalized = waDigits.startsWith("55") ? waDigits : `55${waDigits}`;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(reportText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleRefresh = () => {
    if (mode === "daily") {
      dailyQuery.refetch();
      if (compare) prevDailyQuery.refetch();
    } else {
      monthlyQuery.refetch();
      if (compare) prevMonthlyQuery.refetch();
    }
  };

  const handleExportCsv = () => {
    if (mode === "daily") {
      const rows = dailyQuery.data ?? [];
      if (rows.length === 0) return toast.error("Sem dados para exportar.");
      const csv = dailyRowsToCsv(rows);
      downloadFile(`relatorio-diario-${dailyDate}.csv`, csv, "text/csv;charset=utf-8");
      toast.success("CSV baixado");
    } else {
      const data = monthlyQuery.data;
      if (!data) return toast.error("Sem dados para exportar.");
      const csv = monthlyLeadsToCsv(data);
      downloadFile(`relatorio-mensal-${ano}-${String(mes).padStart(2, "0")}.csv`, csv, "text/csv;charset=utf-8");
      toast.success("CSV baixado");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado");
    } catch {
      toast.error("Falha ao copiar link.");
    }
  };

  // ── Derivações para tabs ───────────────────────────
  const dailyRows = dailyQuery.data ?? [];
  const monthlyData = monthlyQuery.data;

  return (
    <>
      <PageHeader
        title="Relatórios"
        badge="Analytics"
        description="Visão completa do desempenho por dia ou mês — com comparativos, gráficos, exportação e envio direto pelo WhatsApp."
        actions={
          <>
            {hasClinic ? (
              <Badge tone="emerald">{unitLabel}</Badge>
            ) : (
              <Badge tone="amber">Selecione uma unidade</Badge>
            )}
            <Badge tone="slate">{periodLabel}</Badge>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={!hasClinic}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
              Atualizar
            </Button>
          </>
        }
      />

      {/* ════════════ Escopo e período ════════════ */}
      <Card className="mb-4">
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="label">Modo</label>
              <div className="mt-1 flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-1">
                <ModeTab
                  icon={<CalendarDays className="h-3.5 w-3.5" />}
                  label="Diário"
                  active={mode === "daily"}
                  onClick={() => setMode("daily")}
                />
                <ModeTab
                  icon={<FileText className="h-3.5 w-3.5" />}
                  label="Mensal"
                  active={mode === "monthly"}
                  onClick={() => setMode("monthly")}
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="label">Unidade</label>
              <Select
                className="mt-1"
                value={resolvedUnitId}
                onChange={(e) => setUnitValue(e.target.value)}
                disabled={unitsQuery.isLoading}
              >
                <option value="">
                  {unitsQuery.isLoading ? "Carregando unidades…" : "Selecione uma unidade"}
                </option>
                {units.map((u) => (
                  <option key={u.id} value={String(u.clinicId ?? u.id)}>
                    {u.name ?? `Clínica ${u.clinicId ?? u.id}`}
                  </option>
                ))}
              </Select>
            </div>

            {mode === "daily" ? (
              <div className="md:col-span-3">
                <label className="label">Data</label>
                <Input
                  className="mt-1"
                  type="date"
                  value={dailyDate}
                  max={todayIsoLocal()}
                  onChange={(e) => setDailyDate(e.target.value)}
                  disabled={!hasClinic}
                />
              </div>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="label">Mês</label>
                  <Select
                    className="mt-1"
                    value={mes}
                    onChange={(e) => setMes(+e.target.value)}
                    disabled={!hasClinic}
                  >
                    {MESES_PT.map((nome, i) => (
                      <option key={nome} value={i + 1}>{nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Ano</label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={ano}
                    min={2000}
                    max={now.getFullYear() + 1}
                    onChange={(e) => setAno(+e.target.value)}
                    disabled={!hasClinic}
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2 flex flex-col justify-end">
              <label className="label">Comparar</label>
              <Toggle
                className="mt-2"
                label={mode === "daily" ? "com o dia anterior" : "com o mês anterior"}
                value={compare}
                onChange={setCompare}
              />
            </div>
          </div>

          {/* Presets rápidos */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Atalhos
            </span>
            {mode === "daily" ? (
              <>
                <PresetChip
                  label="Hoje"
                  active={dailyDate === todayIsoLocal()}
                  onClick={() => setDailyDate(todayIsoLocal())}
                />
                <PresetChip
                  label="Ontem"
                  active={dailyDate === addDaysIso(todayIsoLocal(), -1)}
                  onClick={() => setDailyDate(addDaysIso(todayIsoLocal(), -1))}
                />
                <PresetChip
                  label="Anteontem"
                  active={dailyDate === addDaysIso(todayIsoLocal(), -2)}
                  onClick={() => setDailyDate(addDaysIso(todayIsoLocal(), -2))}
                />
                <PresetChip
                  label="Há 7 dias"
                  active={dailyDate === addDaysIso(todayIsoLocal(), -7)}
                  onClick={() => setDailyDate(addDaysIso(todayIsoLocal(), -7))}
                />
              </>
            ) : (
              <>
                <PresetChip
                  label="Este mês"
                  active={mes === now.getMonth() + 1 && ano === now.getFullYear()}
                  onClick={() => {
                    setMes(now.getMonth() + 1);
                    setAno(now.getFullYear());
                  }}
                />
                <PresetChip
                  label="Mês anterior"
                  active={(() => {
                    const p = subtractMonth(now.getMonth() + 1, now.getFullYear());
                    return mes === p.mes && ano === p.ano;
                  })()}
                  onClick={() => {
                    const p = subtractMonth(now.getMonth() + 1, now.getFullYear());
                    setMes(p.mes);
                    setAno(p.ano);
                  }}
                />
                <PresetChip
                  label="2 meses atrás"
                  active={(() => {
                    const p1 = subtractMonth(now.getMonth() + 1, now.getFullYear());
                    const p2 = subtractMonth(p1.mes, p1.ano);
                    return mes === p2.mes && ano === p2.ano;
                  })()}
                  onClick={() => {
                    const p1 = subtractMonth(now.getMonth() + 1, now.getFullYear());
                    const p2 = subtractMonth(p1.mes, p1.ano);
                    setMes(p2.mes);
                    setAno(p2.ano);
                  }}
                />
              </>
            )}

            <span className="ml-auto text-[11px] text-slate-500">
              Última atualização:{" "}
              <span className="text-slate-300">
                {lastUpdated ? formatRelativeAgo(lastUpdated) : "—"}
              </span>
            </span>
          </div>
        </CardBody>
      </Card>

      {/* ════════════ KPIs ════════════ */}
      {hasClinic && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k, i) => (
            <KpiCard
              key={i}
              label={k.label}
              value={k.value}
              icon={k.icon}
              tone={k.tone}
              trend={k.trend}
              subtitle={k.subtitle}
              loading={loading}
            />
          ))}
        </div>
      )}

      {emptyMonthly && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200">
          Nenhum dado encontrado para {MESES_PT[mes - 1]} / {ano}.
        </div>
      )}
      {errored && mode === "daily" && (
        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3 py-2 text-[12px] text-rose-200">
          Falha ao carregar o relatório diário.
        </div>
      )}

      {/* ════════════ Abas ════════════ */}
      <Card>
        <CardHeader
          title={
            <div className="inline-flex items-center gap-1 rounded-lg border border-white/[0.06] bg-black/20 p-1">
              <TabBtn
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                label="Visão geral"
                active={tab === "overview"}
                onClick={() => setTab("overview")}
              />
              <TabBtn
                icon={<LayoutGrid className="h-3.5 w-3.5" />}
                label="Por unidade"
                active={tab === "units"}
                onClick={() => setTab("units")}
              />
              {mode === "monthly" && (
                <TabBtn
                  icon={<PieChartIcon className="h-3.5 w-3.5" />}
                  label="Por origem"
                  active={tab === "sources"}
                  onClick={() => setTab("sources")}
                />
              )}
              <TabBtn
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                label="WhatsApp"
                active={tab === "whatsapp"}
                onClick={() => setTab("whatsapp")}
              />
            </div>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopyLink}>
                <Link2 className="mr-1.5 h-3.5 w-3.5" /> Copiar link
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!hasClinic}>
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Exportar CSV
              </Button>
              {mode === "monthly" && (
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!hasClinic}>
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> Baixar PDF
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="space-y-6">
          {!hasClinic && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[12px] text-amber-200">
              Selecione uma unidade para carregar os relatórios.
            </div>
          )}

          {/* ─── Visão geral ─── */}
          {tab === "overview" && hasClinic && (
            <>
              {mode === "daily" ? (
                <DailyOverview rows={dailyRows} loading={loading} />
              ) : (
                <MonthlyOverview data={monthlyData} loading={loading} />
              )}
            </>
          )}

          {/* ─── Por unidade ─── */}
          {tab === "units" && hasClinic && (
            <>
              {mode === "daily" ? (
                <DailyUnitsTable rows={dailyRows} loading={loading} />
              ) : (
                <MonthlyUnitsTable data={monthlyData} loading={loading} />
              )}
            </>
          )}

          {/* ─── Por origem (mensal) ─── */}
          {tab === "sources" && mode === "monthly" && hasClinic && (
            <MonthlySources data={monthlyData} loading={loading} />
          )}

          {/* ─── WhatsApp ─── */}
          {tab === "whatsapp" && (
            <WhatsAppComposer
              reportText={reportText}
              loading={loading}
              hasClinic={hasClinic}
              periodLabel={periodLabel}
              opts={opts}
              patch={patch}
              mode={mode}
              onReset={() => setOpts(DEFAULT_OPTIONS)}
              whatsappRaw={whatsappRaw}
              setWhatsappRaw={setWhatsappRaw}
              waValid={waValid}
              image={image}
              onImagePick={handleImageFile}
              onImageClear={clearImage}
              onImageCopy={handleCopyImage}
              onImageDownload={handleDownloadImage}
              fileInputRef={fileInputRef}
              onCopyText={handleCopyText}
              onSend={handleSendWhatsApp}
              templates={allTemplates}
              activeTemplateId={templateId}
              onTemplateChange={setTemplateId}
              onSaveTemplate={saveCustomTemplate}
              onDeleteTemplate={deleteCustomTemplate}
              templateVars={templateVars}
              lintIssues={lintIssues}
              hasLintError={hasLintError}
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Visão geral — Diário
 * ═══════════════════════════════════════════════════════════════ */

function DailyOverview({ rows, loading }: { rows: DailyRelatoryDto[]; loading: boolean }) {
  const agg = useMemo(() => aggregateDaily(rows), [rows]);
  const chartData = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => b.totalLeads - a.totalLeads)
        .map((r) => ({
          unidade: r.unidade,
          Leads: r.totalLeads,
          Agendamentos: r.agendamentos,
          "Com pagamento": r.comPagamento,
          Resgates: r.resgastes,
        })),
    [rows],
  );

  if (loading && rows.length === 0) {
    return <Skeleton height={320} />;
  }

  if (rows.length === 0) {
    return <Empty title="Nenhum lead atribuído no dia selecionado." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<BarChartIcon className="h-3.5 w-3.5" />}>
          Leads por unidade
        </SectionTitle>
        <div className="mt-2 h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="unidade"
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-12}
                textAnchor="end"
                height={40}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
              <Bar dataKey="Leads" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Agendamentos" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Com pagamento" fill="#34d399" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Resgates" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<ListTree className="h-3.5 w-3.5" />}>Funil do dia</SectionTitle>
        <div className="mt-3 space-y-2">
          <FunnelRow label="Leads" value={agg.total} total={agg.total} tone="sky" />
          <FunnelRow
            label="Agendamentos"
            value={agg.agendamentos}
            total={agg.total}
            tone="amber"
          />
          <FunnelRow
            label="Com pagamento"
            value={agg.comPagamento}
            total={agg.total}
            tone="emerald"
          />
          <FunnelRow
            label="Resgates"
            value={agg.resgastes}
            total={agg.total}
            tone="indigo"
          />
        </div>
        {agg.atendentes.length > 0 && (
          <div className="mt-4 border-t border-white/[0.05] pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Atendentes ativos ({agg.atendentes.length})
            </p>
            <div className="flex flex-wrap gap-1">
              {agg.atendentes.map((a) => (
                <Badge key={a} tone="slate">{a}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Visão geral — Mensal
 * ═══════════════════════════════════════════════════════════════ */

function MonthlyOverview({
  data, loading,
}: { data: RelatorioMensalResumoDto | undefined; loading: boolean }) {
  if (loading && !data) return <Skeleton height={320} />;
  if (!data) return <Empty title="Sem dados para o período selecionado." />;

  const dailyChart = data.leadsPorDia.map((d) => ({
    dia: String(d.dia).padStart(2, "0"),
    Leads: d.quantidade,
  }));

  const stageChart = data.leadsPorEtapa.slice(0, 8).map((e) => ({
    etapa: stageLabel(e.etapa),
    Quantidade: e.quantidade,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5" />}>
          Leads por dia — {MESES_PT[data.mes - 1]} / {data.ano}
        </SectionTitle>
        <div className="mt-2 h-[300px] w-full">
          <ResponsiveContainer>
            <AreaChart data={dailyChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rpt-month-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={32} />
              <RTooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="Leads"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#rpt-month-fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<BarChart3 className="h-3.5 w-3.5" />}>Por etapa</SectionTitle>
        <div className="mt-2 h-[300px] w-full">
          <ResponsiveContainer>
            <BarChart data={stageChart} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="etapa"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <RTooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="Quantidade" radius={[0, 6, 6, 0]}>
                {stageChart.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Por unidade — tabelas
 * ═══════════════════════════════════════════════════════════════ */

function DailyUnitsTable({ rows, loading }: { rows: DailyRelatoryDto[]; loading: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (loading && rows.length === 0) return <Skeleton height={220} />;
  if (rows.length === 0) return <Empty title="Nenhuma unidade com leads no dia." />;

  return (
    <Table>
      <THead>
        <Tr>
          <Th className="w-[30px]" />
          <Th>Unidade</Th>
          <Th className="text-right">Leads</Th>
          <Th className="text-right">Agendamentos</Th>
          <Th className="text-right">Pagamentos</Th>
          <Th className="text-right">Resgates</Th>
          <Th>Atendentes</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r, i) => {
          const isOpen = expanded === r.unidade;
          const conv = r.totalLeads > 0
            ? formatPercent((r.agendamentos / r.totalLeads) * 100)
            : "—";
          return (
            <Fragment key={`${r.unidade}-${i}`}>
              <Tr
                clickable
                onClick={() => setExpanded(isOpen ? null : r.unidade)}
              >
                <Td>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </Td>
                <Td className="font-medium text-slate-100">{r.unidade}</Td>
                <Td className="text-right tabular-nums">{formatNumber(r.totalLeads)}</Td>
                <Td className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    {formatNumber(r.agendamentos)}
                    <span className="text-[10.5px] text-slate-500">{conv}</span>
                  </span>
                </Td>
                <Td className="text-right tabular-nums">{formatNumber(r.comPagamento)}</Td>
                <Td className="text-right tabular-nums">{formatNumber(r.resgastes)}</Td>
                <Td className="text-slate-400 max-w-[260px] truncate">
                  {r.atendentes.join(", ") || "—"}
                </Td>
              </Tr>
              {isOpen && (
                <Tr>
                  <Td />
                  <Td colSpan={6} className="bg-black/20">
                    {r.observacoes ? (
                      <div className="space-y-1.5 py-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Observações
                        </p>
                        <ul className="space-y-1">
                          {r.observacoes.split(" | ").filter(Boolean).map((obs, j) => (
                            <li key={j} className="text-[12px] text-slate-300">
                              · {obs.trim()}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-500">Sem observações para esta unidade.</p>
                    )}
                  </Td>
                </Tr>
              )}
            </Fragment>
          );
        })}
      </TBody>
    </Table>
  );
}

function MonthlyUnitsTable({
  data, loading,
}: { data: RelatorioMensalResumoDto | undefined; loading: boolean }) {
  if (loading && !data) return <Skeleton height={220} />;
  if (!data || data.leadsPorUnidade.length === 0)
    return <Empty title="Sem dados de unidades para o período." />;

  const max = Math.max(...data.leadsPorUnidade.map((u) => u.quantidadeLeads), 1);

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Unidade</Th>
          <Th className="text-right">Leads</Th>
          <Th>Participação</Th>
          <Th className="text-right">% do total</Th>
        </Tr>
      </THead>
      <TBody>
        {data.leadsPorUnidade.map((u) => {
          const pct = data.totalLeads > 0 ? (u.quantidadeLeads / data.totalLeads) * 100 : 0;
          return (
            <Tr key={`${u.unitId ?? "null"}-${u.nome}`}>
              <Td className="font-medium text-slate-100">{u.nome}</Td>
              <Td className="text-right tabular-nums">{formatNumber(u.quantidadeLeads)}</Td>
              <Td className="min-w-[220px]">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{ width: `${(u.quantidadeLeads / max) * 100}%` }}
                  />
                </div>
              </Td>
              <Td className="text-right tabular-nums text-slate-400">
                {formatPercent(pct)}
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Por origem — mensal
 * ═══════════════════════════════════════════════════════════════ */

function MonthlySources({
  data, loading,
}: { data: RelatorioMensalResumoDto | undefined; loading: boolean }) {
  if (loading && !data) return <Skeleton height={280} />;
  if (!data || data.leadsPorOrigem.length === 0)
    return <Empty title="Sem origens registradas no período." />;

  const pieData = data.leadsPorOrigem.slice(0, 10).map((o) => ({
    name: o.origem,
    value: o.quantidade,
  }));

  const total = data.totalLeads;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<PieChartIcon className="h-3.5 w-3.5" />}>
          Distribuição por origem
        </SectionTitle>
        <div className="mt-2 h-[320px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                stroke="rgba(10,10,13,1)"
                strokeWidth={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <RTooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
        <SectionTitle icon={<ListTree className="h-3.5 w-3.5" />}>
          Top {Math.min(pieData.length, 10)}
        </SectionTitle>
        <ul className="mt-3 space-y-2">
          {pieData.map((o, i) => {
            const pct = total > 0 ? (o.value / total) * 100 : 0;
            return (
              <li key={o.name + i} className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] text-slate-200">{o.name}</span>
                    <span className="tabular-nums text-[12px] text-slate-400">
                      {formatNumber(o.value)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: CHART_PALETTE[i % CHART_PALETTE.length],
                      }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right tabular-nums text-[11px] text-slate-500">
                  {formatPercent(pct)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  WhatsApp composer
 * ═══════════════════════════════════════════════════════════════ */

/* ─── Template Panel ─── */

function TemplatePanel({
  templates,
  activeTemplateId,
  onChange,
  onSave,
  onDelete,
  vars,
}: {
  templates: MessageTemplate[];
  activeTemplateId: string;
  onChange: (id: string) => void;
  onSave: (tpl: MessageTemplate) => void;
  onDelete: (id: string) => void;
  vars: TemplateVars;
}) {
  const active =
    templates.find((t) => t.id === activeTemplateId) ?? templates[0];
  const isCustom = !active.builtin;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MessageTemplate>(active);
  const introRef = useRef<HTMLTextAreaElement | null>(null);
  const outroRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeField, setActiveField] = useState<"intro" | "outro">("intro");

  const startEdit = (mode: "edit" | "duplicate") => {
    if (mode === "duplicate") {
      setDraft({
        id: `tpl-${Date.now().toString(36)}`,
        name: `${active.name} (cópia)`,
        description: active.description,
        intro: active.intro,
        outro: active.outro,
        builtin: false,
      });
    } else {
      setDraft({ ...active, builtin: false });
    }
    setEditing(true);
  };

  const startNew = () => {
    setDraft({
      id: `tpl-${Date.now().toString(36)}`,
      name: "Novo modelo",
      description: "",
      intro: "Olá! Segue o relatório:\n\n",
      outro: "\n\n— {{userName}}",
      builtin: false,
    });
    setEditing(true);
  };

  const insertVar = (key: string) => {
    const ref = activeField === "intro" ? introRef.current : outroRef.current;
    const token = `{{${key}}}`;
    const cur = activeField === "intro" ? draft.intro : draft.outro;
    if (!ref) {
      setDraft((d) => ({
        ...d,
        [activeField]: (cur || "") + token,
      } as MessageTemplate));
      return;
    }
    const start = ref.selectionStart ?? cur.length;
    const end = ref.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    setDraft((d) => ({ ...d, [activeField]: next } as MessageTemplate));
    requestAnimationFrame(() => {
      ref.focus();
      const pos = start + token.length;
      ref.setSelectionRange(pos, pos);
    });
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast.error("Dê um nome ao modelo.");
      return;
    }
    onSave(draft);
    setEditing(false);
    toast.success("Modelo salvo");
  };

  const handleDelete = () => {
    if (!isCustom) return;
    if (!window.confirm(`Remover o modelo "${active.name}"?`)) return;
    onDelete(active.id);
    setEditing(false);
    toast.success("Modelo removido");
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-white/[0.005]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/20">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
          </div>
          <div className="leading-tight">
            <p className="text-[12px] font-semibold text-slate-100">
              Modelo de mensagem
            </p>
            <p className="text-[10.5px] text-slate-500">
              Wrappa o relatório com saudação e despedida personalizadas.
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            value={activeTemplateId}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-[200px]"
          >
            <optgroup label="Pré-definidos">
              {templates
                .filter((t) => t.builtin)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </optgroup>
            {templates.some((t) => !t.builtin) && (
              <optgroup label="Meus modelos">
                {templates
                  .filter((t) => !t.builtin)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </Select>

          {!editing && (
            <>
              <Button variant="outline" size="sm" onClick={() => startEdit(isCustom ? "edit" : "duplicate")}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                {isCustom ? "Editar" : "Duplicar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={startNew}>
                + Novo
              </Button>
              {isCustom && (
                <Button variant="ghost" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Description / preview */}
      {!editing && (
        <div className="px-4 py-3">
          {active.description && (
            <p className="text-[11.5px] text-slate-400">{active.description}</p>
          )}
          {active.id !== "raw" && (active.intro || active.outro) && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {active.intro && (
                <div className="rounded-md border border-white/[0.06] bg-black/20 p-2.5">
                  <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
                    Intro
                  </p>
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                    {resolveVars(active.intro, vars)}
                  </pre>
                </div>
              )}
              {active.outro && (
                <div className="rounded-md border border-white/[0.06] bg-black/20 p-2.5">
                  <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
                    Outro
                  </p>
                  <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
                    {resolveVars(active.outro, vars)}
                  </pre>
                </div>
              )}
            </div>
          )}
          {active.id === "raw" && (
            <p className="text-[11px] text-slate-500">
              Sem wrapper — só o relatório auto-gerado é enviado.
            </p>
          )}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Nome do modelo</label>
              <Input
                className="mt-1"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Ex: Saudação corporativa"
              />
            </div>
            <div>
              <label className="label">Descrição (opcional)</label>
              <Input
                className="mt-1"
                value={draft.description ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Tom da mensagem, contexto de uso…"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">Intro (vai antes do relatório)</label>
              <textarea
                ref={introRef}
                className="mt-1 w-full min-h-[110px] rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] font-mono text-slate-200 leading-relaxed focus:border-emerald-400/40 focus:outline-none"
                value={draft.intro}
                onFocus={() => setActiveField("intro")}
                onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))}
                placeholder="Olá! Segue o relatório de {{unitLabel}}…"
              />
            </div>
            <div>
              <label className="label">Outro (vai depois do relatório)</label>
              <textarea
                ref={outroRef}
                className="mt-1 w-full min-h-[110px] rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-[12.5px] font-mono text-slate-200 leading-relaxed focus:border-emerald-400/40 focus:outline-none"
                value={draft.outro}
                onFocus={() => setActiveField("outro")}
                onChange={(e) => setDraft((d) => ({ ...d, outro: e.target.value }))}
                placeholder="Qualquer dúvida estou à disposição. — {{userName}}"
              />
            </div>
          </div>

          {/* Variable picker */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Variáveis disponíveis · clique para inserir em <span className="text-emerald-300">{activeField}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARS_DOC.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  title={v.desc}
                  className="group inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[11px] font-mono text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/[0.06] hover:text-emerald-200"
                >
                  <span>{`{{${v.key}}}`}</span>
                  <span className="text-[9.5px] text-slate-500 group-hover:text-emerald-300/70">
                    = {String(vars[v.key] ?? "—")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] pt-3">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Salvar modelo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lint Bar ─── */

function LintBar({
  issues,
  charCount,
}: {
  issues: LintIssue[];
  charCount: number;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  const tone =
    errors.length > 0
      ? "error"
      : warnings.length > 0
        ? "warning"
        : "ok";

  const toneStyles = {
    error: {
      ring: "ring-rose-500/20",
      bg: "bg-rose-500/[0.06]",
      pillBg: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
      icon: "text-rose-400",
      label: "Bloqueado para envio",
    },
    warning: {
      ring: "ring-amber-500/20",
      bg: "bg-amber-500/[0.05]",
      pillBg: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
      icon: "text-amber-400",
      label: "Avisos antes de enviar",
    },
    ok: {
      ring: "ring-emerald-500/20",
      bg: "bg-emerald-500/[0.05]",
      pillBg: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
      icon: "text-emerald-400",
      label: "Pronto para envio",
    },
  } as const;

  const style = toneStyles[tone];
  const pct = Math.min(100, Math.round((charCount / WA_MAX_CHARS) * 100));
  const barColor =
    charCount > WA_MAX_CHARS
      ? "bg-rose-500"
      : charCount > WA_NEAR_LIMIT
        ? "bg-amber-400"
        : "bg-emerald-400";

  return (
    <div
      className={cn(
        "rounded-xl ring-1 ring-inset",
        style.ring,
        style.bg,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {tone === "ok" ? (
            <Check className={cn("h-4 w-4", style.icon)} />
          ) : (
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                style.icon,
              )}
            >
              !
            </span>
          )}
          <p className="text-[12px] font-semibold text-slate-100">
            {style.label}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[10.5px]">
          {errors.length > 0 && (
            <span className={cn("rounded-full px-2 py-0.5 ring-1 ring-inset", toneStyles.error.pillBg)}>
              {errors.length} erro{errors.length > 1 ? "s" : ""}
            </span>
          )}
          {warnings.length > 0 && (
            <span className={cn("rounded-full px-2 py-0.5 ring-1 ring-inset", toneStyles.warning.pillBg)}>
              {warnings.length} aviso{warnings.length > 1 ? "s" : ""}
            </span>
          )}
          {infos.length > 0 && (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200 ring-1 ring-inset ring-sky-500/25">
              {infos.length} dica{infos.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Char meter */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>Caracteres</span>
          <span className="tabular-nums">
            {charCount.toLocaleString("pt-BR")} / {WA_MAX_CHARS.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn("h-full transition-all duration-300", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Issues list */}
      {issues.length > 0 && (
        <ul className="border-t border-white/[0.04] px-4 py-2 space-y-1">
          {issues.map((iss) => (
            <li
              key={iss.code}
              className="flex items-start gap-2 text-[11.5px]"
            >
              <span
                className={cn(
                  "mt-[2px] inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
                  iss.severity === "error" && "bg-rose-400",
                  iss.severity === "warning" && "bg-amber-400",
                  iss.severity === "info" && "bg-sky-400",
                )}
              />
              <span
                className={cn(
                  iss.severity === "error" && "text-rose-200",
                  iss.severity === "warning" && "text-amber-200",
                  iss.severity === "info" && "text-sky-200",
                )}
              >
                {iss.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── WhatsApp text rendering (parses *bold* _italic_ ~strike~ `mono`) ─── */

function renderWhatsAppLine(line: string, keyPrefix: string): React.ReactNode[] {
  // Token regex: matches *bold*, _italic_, ~strike~, `mono` with non-greedy content
  const tokenRe = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = tokenRe.exec(line)) !== null) {
    if (m.index > lastIdx) {
      parts.push(line.slice(lastIdx, m.index));
    }
    const token = m[0];
    const inner = token.slice(1, -1);
    const k = `${keyPrefix}-${i++}`;

    if (token.startsWith("*")) {
      parts.push(<strong key={k} className="font-semibold">{inner}</strong>);
    } else if (token.startsWith("_")) {
      parts.push(<em key={k} className="italic">{inner}</em>);
    } else if (token.startsWith("~")) {
      parts.push(<s key={k} className="opacity-80">{inner}</s>);
    } else {
      parts.push(
        <code
          key={k}
          className="rounded bg-black/[0.06] px-1 py-[1px] font-mono text-[11.5px]"
        >
          {inner}
        </code>,
      );
    }
    lastIdx = m.index + token.length;
  }
  if (lastIdx < line.length) parts.push(line.slice(lastIdx));
  return parts;
}

function renderWhatsAppText(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, idx) => (
    <Fragment key={idx}>
      {line.length === 0 ? <span>&nbsp;</span> : renderWhatsAppLine(line, `l${idx}`)}
      {idx < lines.length - 1 && <br />}
    </Fragment>
  ));
}

/* ─── WhatsApp Phone Preview ─── */

function WhatsAppPhonePreview({
  text,
  contactName,
  contactPhone,
  imageUrl,
  loading,
}: {
  text: string;
  contactName: string;
  contactPhone: string;
  imageUrl: string | null;
  loading: boolean;
}) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusTime = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const initials = (contactName || "Cliente")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "DD";

  return (
    <div className="flex justify-center">
      {/* Phone outer frame */}
      <div
        className={cn(
          "relative w-[300px] sm:w-[320px] rounded-[44px]",
          "bg-gradient-to-b from-[#1c1c22] via-[#0e0e12] to-[#0a0a0d]",
          "p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.05)_inset]",
          "ring-1 ring-white/[0.06]",
        )}
      >
        {/* Side buttons */}
        <span className="absolute -left-[2px] top-[110px] h-8 w-[3px] rounded-l-full bg-[#2a2a30]" />
        <span className="absolute -left-[2px] top-[160px] h-12 w-[3px] rounded-l-full bg-[#2a2a30]" />
        <span className="absolute -right-[2px] top-[140px] h-16 w-[3px] rounded-r-full bg-[#2a2a30]" />

        {/* Screen */}
        <div className="relative overflow-hidden rounded-[36px] bg-[#0b141a]">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-[#1f2c33] px-5 pt-2 pb-1 text-[10px] font-medium text-white">
            <span className="tabular-nums">{statusTime}</span>
            {/* Dynamic island */}
            <div className="absolute left-1/2 top-1.5 h-[18px] w-[80px] -translate-x-1/2 rounded-full bg-black" />
            <div className="flex items-center gap-1">
              <Signal className="h-2.5 w-2.5" />
              <Wifi className="h-2.5 w-2.5" />
              <Battery className="h-3 w-3" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="flex items-center gap-2.5 bg-[#1f2c33] px-2.5 py-2 text-white">
            <ArrowLeft className="h-4 w-4 text-white/80" />
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 ring-1 ring-white/10">
              <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white">
                {initials}
              </div>
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12.5px] font-medium">
                {contactName || "Destinatário"}
              </div>
              <div className="truncate text-[10px] text-white/60">
                {contactPhone || "online"}
              </div>
            </div>
            <Video className="h-4 w-4 text-white/80" />
            <Phone className="h-4 w-4 text-white/80" />
            <MoreVertical className="h-4 w-4 text-white/80" />
          </div>

          {/* Chat area with WA wallpaper */}
          <div
            className="relative h-[460px] overflow-y-auto px-3 py-3"
            style={{
              backgroundColor: "#0b141a",
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.018) 0 1px, transparent 1.5px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.015) 0 1px, transparent 1.5px), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.012) 0 1px, transparent 1.5px)",
              backgroundSize: "60px 60px, 80px 80px, 40px 40px",
            }}
          >
            {/* Date pill */}
            <div className="mb-3 flex justify-center">
              <span className="rounded-md bg-[#1f2c33]/95 px-2.5 py-1 text-[10px] font-medium text-white/70 shadow-sm">
                HOJE
              </span>
            </div>

            {/* Encrypted notice */}
            <div className="mb-3 flex justify-center">
              <span className="max-w-[240px] rounded-md bg-[#1f2c33]/80 px-2.5 py-1.5 text-center text-[9.5px] leading-tight text-amber-200/80">
                🔒 As mensagens são protegidas com criptografia de
                ponta a ponta.
              </span>
            </div>

            {/* Outgoing bubble */}
            <div className="flex justify-end">
              <div
                className={cn(
                  "relative max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] px-2 pt-1.5 pb-1 text-white shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]",
                  "before:absolute before:-right-[7px] before:top-0 before:h-0 before:w-0",
                  "before:border-y-[8px] before:border-l-[8px] before:border-y-transparent before:border-l-[#005c4b]",
                )}
              >
                {imageUrl && (
                  <div className="mb-1 overflow-hidden rounded-md">
                    <img
                      src={imageUrl}
                      alt="anexo"
                      className="block max-h-[180px] w-full object-cover"
                    />
                  </div>
                )}

                <div className="px-1 text-[12.5px] leading-[1.35] text-white/95 break-words whitespace-pre-wrap">
                  {loading ? (
                    <span className="inline-flex items-center gap-1.5 text-white/60">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      gerando relatório…
                    </span>
                  ) : text ? (
                    renderWhatsAppText(text)
                  ) : (
                    <span className="text-white/50 italic">
                      Sua mensagem aparecerá aqui…
                    </span>
                  )}
                </div>

                <div className="mt-0.5 flex items-center justify-end gap-1 pr-0.5">
                  <span className="text-[9.5px] text-white/60 tabular-nums">
                    {timeLabel}
                  </span>
                  <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
                </div>
              </div>
            </div>
          </div>

          {/* Composer bar */}
          <div className="flex items-center gap-1.5 bg-[#1f2c33] px-2 py-2">
            <div className="flex flex-1 items-center gap-1.5 rounded-full bg-[#2a3942] px-3 py-1.5">
              <Smile className="h-4 w-4 text-white/60" />
              <span className="flex-1 text-[11px] text-white/40">Mensagem</span>
              <Paperclip className="h-4 w-4 text-white/60" />
              <Camera className="h-4 w-4 text-white/60" />
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00a884]">
              <Mic className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex items-center justify-center bg-[#0b141a] py-1.5">
            <div className="h-[3px] w-24 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppComposer(props: {
  reportText: string;
  loading: boolean;
  hasClinic: boolean;
  periodLabel: string;
  opts: FormatOptions;
  patch: (p: Partial<FormatOptions>) => void;
  mode: Mode;
  onReset: () => void;
  whatsappRaw: string;
  setWhatsappRaw: (v: string) => void;
  waValid: boolean;
  image: { file: File; url: string } | null;
  onImagePick: (file: File | null) => void;
  onImageClear: () => void;
  onImageCopy: () => void;
  onImageDownload: () => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onCopyText: () => void;
  onSend: () => void;
  templates: MessageTemplate[];
  activeTemplateId: string;
  onTemplateChange: (id: string) => void;
  onSaveTemplate: (tpl: MessageTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  templateVars: TemplateVars;
  lintIssues: LintIssue[];
  hasLintError: boolean;
}) {
  const {
    reportText, loading, hasClinic, periodLabel,
    opts, patch, mode, onReset,
    whatsappRaw, setWhatsappRaw, waValid,
    image, onImagePick, onImageClear, onImageCopy, onImageDownload, fileInputRef,
    onCopyText, onSend,
    templates, activeTemplateId, onTemplateChange,
    onSaveTemplate, onDeleteTemplate, templateVars,
    lintIssues, hasLintError,
  } = props;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="label">Período do relatório</label>
          <div className="mt-1 flex h-[38px] items-center rounded-md border border-white/[0.08] bg-white/[0.02] px-3 text-[13px] text-slate-200">
            {periodLabel}
          </div>
        </div>
        <div className="md:col-span-2">
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
            whatsappRaw && !waValid ? "text-rose-400" : "text-slate-500",
          )}>
            {whatsappRaw && !waValid
              ? "Número inválido — inclua DDI (55) + DDD + 8 ou 9 dígitos"
              : "Com DDI + DDD. O botão abaixo abre o WhatsApp Web com a mensagem pronta."}
          </p>
        </div>
      </div>

      <TemplatePanel
        templates={templates}
        activeTemplateId={activeTemplateId}
        onChange={onTemplateChange}
        onSave={onSaveTemplate}
        onDelete={onDeleteTemplate}
        vars={templateVars}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Phone preview — coluna principal */}
        <div className="lg:col-span-2 min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Prévia no WhatsApp
            </p>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              {loading && (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> carregando…
                </span>
              )}
              <span className="tabular-nums">
                {formatNumber(reportText.length)} chars
              </span>
            </div>
          </div>

          <div className="lg:sticky lg:top-4">
            <WhatsAppPhonePreview
              text={reportText}
              loading={loading}
              contactName={
                hasClinic ? "Cliente Doutor Digital" : "Selecione uma unidade"
              }
              contactPhone={
                whatsappRaw
                  ? formatPhoneMask(whatsappRaw)
                  : "online"
              }
              imageUrl={image?.url ?? null}
            />

            <p className="mt-3 text-center text-[10.5px] text-slate-500 leading-relaxed">
              Pré-visualização exata de como o destinatário verá a mensagem.
            </p>
          </div>
        </div>

        {/* Coluna direita: imagem + texto cru */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          {/* Imagem anexada */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Imagem anexada (opcional)
            </p>
            <ImageDropzone
              image={image}
              onPick={onImagePick}
              onClear={onImageClear}
              inputRef={fileInputRef}
            />
            {image && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onImageCopy}>
                  <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" /> Copiar imagem
                </Button>
                <Button variant="ghost" size="sm" onClick={onImageDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
                </Button>
              </div>
            )}
            <p className="mt-2 text-[10.5px] text-slate-500 leading-relaxed">
              O wa.me não suporta anexar imagens automaticamente.
              Após abrir o WhatsApp, use <strong>Copiar imagem</strong> e cole com{" "}
              <kbd className="rounded bg-white/[0.06] px-1 text-[10px]">Ctrl</kbd>+
              <kbd className="rounded bg-white/[0.06] px-1 text-[10px]">V</kbd>.
            </p>
          </div>

          {/* Texto cru (colapsável) */}
          <details className="group rounded-xl border border-white/[0.06] bg-white/[0.01]">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.02] group-open:border-b group-open:border-white/[0.05]">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" /> Ver texto cru
              </span>
              <span className="text-slate-500 transition group-open:rotate-180">▾</span>
            </summary>
            <pre
              className={cn(
                "max-h-[260px] overflow-auto whitespace-pre-wrap rounded-b-xl",
                "bg-[rgba(10,10,18,0.85)] p-4",
                "font-mono text-[12px] leading-relaxed text-slate-200",
              )}
            >
              {reportText || (
                <span className="text-slate-500">
                  {hasClinic
                    ? "Sem dados para o período selecionado."
                    : "Selecione uma unidade para gerar a prévia."}
                </span>
              )}
            </pre>
          </details>
        </div>
      </div>

      {/* Ajustes */}
      <details className="group rounded-xl border border-white/[0.06] bg-white/[0.01]">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[12px] font-semibold text-slate-300 hover:bg-white/[0.02] group-open:border-b group-open:border-white/[0.05]">
          <span className="inline-flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Ajustes do texto
          </span>
          <span className="text-slate-500 transition group-open:rotate-180">▾</span>
        </summary>
        <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Seções
            </p>
            {mode === "daily" ? (
              <>
                <Toggle
                  label="Listar atendentes"
                  value={opts.includeAttendants}
                  onChange={(v) => patch({ includeAttendants: v })}
                />
                <Toggle
                  label="Listar observações por lead"
                  value={opts.includeObservations}
                  onChange={(v) => patch({ includeObservations: v })}
                />
              </>
            ) : (
              <>
                <Toggle
                  label="Top origens"
                  value={opts.includeTopOrigens}
                  onChange={(v) => patch({ includeTopOrigens: v })}
                />
                <Toggle
                  label="Detalhe por dia"
                  value={opts.includeDaily}
                  onChange={(v) => patch({ includeDaily: v })}
                />
              </>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Estilo
            </p>
            <Select
              value={opts.style}
              onChange={(e) => patch({ style: e.target.value as ReportStyle })}
            >
              <option value="whatsapp">WhatsApp (*negrito* _itálico_)</option>
              <option value="markdown">Markdown (**negrito**)</option>
              <option value="plain">Texto simples</option>
            </Select>
            <Toggle
              label="Usar emojis"
              value={opts.useEmojis}
              onChange={(v) => patch({ useEmojis: v })}
            />
          </div>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Assinatura
            </p>
            <Input
              value={opts.signature}
              onChange={(e) => patch({ signature: e.target.value })}
              placeholder="Sua assinatura no rodapé"
            />
            <Button variant="ghost" size="sm" onClick={onReset}>
              Resetar formato
            </Button>
          </div>
        </div>
      </details>

      {/* Linter pré-envio */}
      <LintBar issues={lintIssues} charCount={reportText.length} />

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.05] pt-4">
        <Button variant="outline" onClick={onCopyText} disabled={!reportText}>
          <Copy className="mr-1.5 h-4 w-4" /> Copiar texto
        </Button>
        <Button
          onClick={onSend}
          disabled={!reportText || !waValid || hasLintError}
          className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 disabled:opacity-50"
        >
          <Send className="mr-1.5 h-4 w-4" />
          {hasLintError ? "Corrija os erros" : "Enviar no WhatsApp"}
        </Button>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-200">
        <Check className="mr-1 inline h-3 w-3" />
        Integração direta com a API do WhatsApp ainda em desenvolvimento. Por enquanto
        o botão abre o <strong>wa.me</strong> com a mensagem pronta —
        você só precisa tocar em enviar (e colar a imagem, se houver).
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Sub-componentes genéricos
 * ═══════════════════════════════════════════════════════════════ */

function ModeTab({
  label, icon, active, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition",
        active
          ? "bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_1px_rgba(16,185,129,0.25)_inset]"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TabBtn({
  label, icon, active, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition",
        active
          ? "bg-white/[0.08] text-slate-50 shadow-sm"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PresetChip({
  label, active, onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]",
      )}
    >
      {label}
    </button>
  );
}

function Toggle({
  label, value, onChange, className,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 text-[12.5px] text-slate-300",
        className,
      )}
    >
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

function SectionTitle({
  children, icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h4 className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-200">
      {icon && <span className="text-slate-400">{icon}</span>}
      {children}
    </h4>
  );
}

function FunnelRow({
  label, value, total, tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "sky" | "amber" | "emerald" | "indigo";
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const toneClass: Record<string, string> = {
    sky: "from-sky-500 to-sky-400",
    amber: "from-amber-500 to-amber-400",
    emerald: "from-emerald-500 to-emerald-400",
    indigo: "from-indigo-500 to-indigo-400",
  };
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-slate-300">{label}</span>
        <span className="tabular-nums text-[12.5px] text-slate-100">
          {formatNumber(value)}{" "}
          <span className="text-[10.5px] text-slate-500">({formatPercent(pct)})</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", toneClass[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Skeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]"
      style={{ height }}
    />
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04]">
        <BarChart3 className="h-5 w-5 text-slate-500" />
      </div>
      <p className="text-[13px] font-medium text-slate-200">{title}</p>
      <p className="text-[11.5px] text-slate-500">
        Ajuste o período ou selecione outra unidade.
      </p>
    </div>
  );
}

function ImageDropzone({
  image, onPick, onClear, inputRef,
}: {
  image: { file: File; url: string } | null;
  onPick: (file: File | null) => void;
  onClear: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);

  if (image) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black/20">
        <img src={image.url} alt="Prévia" className="max-h-[260px] w-full object-contain" />
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-black/30 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11.5px] text-slate-200">{image.file.name}</p>
            <p className="text-[10px] text-slate-500">
              {formatBytes(image.file.size)} · {image.file.type || "imagem"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      className={cn(
        "flex h-[220px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl",
        "border-2 border-dashed transition",
        dragging
          ? "border-emerald-400/60 bg-emerald-500/[0.05]"
          : "border-white/[0.10] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.03]",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04]">
        <ImageUp className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-[12.5px] font-medium text-slate-200">
        Arraste ou clique para anexar
      </p>
      <p className="text-[10.5px] text-slate-500">PNG, JPG, WebP — até 5 MB</p>
      <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-300">
        <ImageIcon className="h-3 w-3" /> opcional
      </span>
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Construção do texto do relatório
 * ═══════════════════════════════════════════════════════════════ */

function buildDailyText(args: {
  rows: DailyRelatoryDto[];
  date: string;
  unitLabel: string;
  opts: FormatOptions;
}): string {
  const { rows, date, unitLabel, opts } = args;
  const S = styleFns(opts.style);
  const em = (g: string) => (opts.useEmojis ? `${g} ` : "");
  const lines: string[] = [];

  lines.push(em("📊") + S.bold(`Relatório diário — ${unitLabel}`));
  lines.push(em("📅") + `Data: ${formatBrDate(date)}`);
  lines.push(em("🕐") + `Gerado em: ${formatNowBr()}`);
  lines.push("");

  if (rows.length === 0) {
    lines.push(em("ℹ️") + S.italic("Nenhum lead atribuído neste dia."));
  } else {
    const a = aggregateDaily(rows);
    lines.push(em("📈") + S.bold("Resumo geral"));
    lines.push(`• Leads: ${S.bold(String(a.total))}`);
    lines.push(`• Agendamentos: ${S.bold(String(a.agendamentos))}`);
    lines.push(`• Com pagamento: ${S.bold(String(a.comPagamento))}`);
    lines.push(`• Resgates: ${S.bold(String(a.resgastes))}`);
    lines.push("");

    for (const r of rows) {
      lines.push(em("🏥") + S.bold(r.unidade));
      lines.push(`• Leads: ${r.totalLeads}`);
      lines.push(`• Agendamentos: ${r.agendamentos}`);
      lines.push(`• Com pagamento: ${r.comPagamento}`);
      lines.push(`• Resgates: ${r.resgastes}`);
      if (opts.includeAttendants && r.atendentes.length > 0) {
        lines.push(`• Atendentes: ${r.atendentes.join(", ")}`);
      }
      if (opts.includeObservations && r.observacoes) {
        lines.push(em("📝") + S.italic("Observações:"));
        r.observacoes.split(" | ").forEach((obs) => {
          if (obs.trim()) lines.push(`  · ${obs.trim()}`);
        });
      }
      lines.push("");
    }
  }

  lines.push("—".repeat(24));
  lines.push(S.italic(opts.signature || "Relatório gerado automaticamente"));
  return lines.join("\n").trim();
}

function buildMonthlyText(args: {
  data: RelatorioMensalResumoDto;
  opts: FormatOptions;
}): string {
  const { data, opts } = args;
  const S = styleFns(opts.style);
  const em = (g: string) => (opts.useEmojis ? `${g} ` : "");
  const lines: string[] = [];

  lines.push(em("📊") + S.bold(`Relatório mensal — ${data.nomeClinica}`));
  lines.push(em("📅") + `Período: ${MESES_PT[data.mes - 1]} / ${data.ano}`);
  lines.push(em("🕐") + `Gerado em: ${formatNowBr()}`);
  lines.push("");

  lines.push(em("📈") + S.bold("Indicadores"));
  lines.push(`• Total de leads: ${S.bold(String(data.totalLeads))}`);
  lines.push(`• Taxa de conversão: ${S.bold(formatPercent(data.taxaConversaoPercent))}`);
  lines.push(`• Ticket médio: ${S.bold(formatCurrency(data.ticketMedio))}`);
  lines.push("");

  if (data.leadsPorUnidade.length > 0) {
    lines.push(em("🏥") + S.bold("Leads por unidade"));
    data.leadsPorUnidade.slice(0, 8).forEach((u) =>
      lines.push(`• ${u.nome}: ${u.quantidadeLeads}`));
    lines.push("");
  }

  if (opts.includeTopOrigens && data.leadsPorOrigem.length > 0) {
    lines.push(em("📣") + S.bold("Top origens"));
    data.leadsPorOrigem.slice(0, 5).forEach((o) =>
      lines.push(`• ${o.origem}: ${o.quantidade}`));
    lines.push("");
  }

  if (data.leadsPorEtapa.length > 0) {
    lines.push(em("🎯") + S.bold("Por etapa"));
    data.leadsPorEtapa.slice(0, 6).forEach((e) =>
      lines.push(`• ${stageLabel(e.etapa)}: ${e.quantidade}`));
    lines.push("");
  }

  if (opts.includeDaily && data.leadsPorDia.length > 0) {
    lines.push(em("📆") + S.bold("Por dia"));
    data.leadsPorDia.forEach((d) =>
      lines.push(`• Dia ${String(d.dia).padStart(2, "0")}: ${d.quantidade}`));
    lines.push("");
  }

  lines.push("—".repeat(24));
  lines.push(S.italic(opts.signature || "Relatório gerado automaticamente"));
  return lines.join("\n").trim();
}

/* ═══════════════════════════════════════════════════════════════
 *  Helpers
 * ═══════════════════════════════════════════════════════════════ */

function aggregateDaily(rows: DailyRelatoryDto[]) {
  const total = rows.reduce((a, r) => a + r.totalLeads, 0);
  const agendamentos = rows.reduce((a, r) => a + r.agendamentos, 0);
  const comPagamento = rows.reduce((a, r) => a + r.comPagamento, 0);
  const resgastes = rows.reduce((a, r) => a + r.resgastes, 0);
  const atendentes = Array.from(new Set(rows.flatMap((r) => r.atendentes))).filter(Boolean);
  return { total, agendamentos, comPagamento, resgastes, atendentes };
}

function percentChange(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function subtractMonth(mes: number, ano: number) {
  if (mes === 1) return { mes: 12, ano: ano - 1 };
  return { mes: mes - 1, ano };
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBrDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

function formatRelativeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 45_000) return "agora mesmo";
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return `há ${Math.round(diff / 3_600_000)} h`;
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length === 0) return "";
  const countryDigits = digits.startsWith("55") ? digits : `55${digits}`.slice(0, 13);
  const cc = "+" + countryDigits.slice(0, 2);
  const dd = countryDigits.slice(2, 4);
  const rest = countryDigits.slice(4);
  if (rest.length === 0) return cc + (dd ? ` (${dd}` : "");
  if (rest.length <= 4) return `${cc} (${dd}) ${rest}`;
  if (rest.length <= 8) return `${cc} (${dd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${cc} (${dd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
}

/* ─── Templates & vars ─── */

function resolveVars(text: string, vars: TemplateVars): string {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    vars[key] !== undefined && vars[key] !== "" ? String(vars[key]) : m,
  );
}

function applyTemplate(
  template: MessageTemplate,
  body: string,
  vars: TemplateVars,
): string {
  if (!body) return "";
  if (!template.intro && !template.outro) return body;
  return `${resolveVars(template.intro, vars)}${body}${resolveVars(template.outro, vars)}`;
}

/* ─── Linter ─── */

const WA_MAX_CHARS = 4096;
const WA_NEAR_LIMIT = 3500;

function lintMessage(
  text: string,
  ctx: { hasRecipient: boolean; recipientValid: boolean; hasClinic: boolean },
): LintIssue[] {
  const issues: LintIssue[] = [];

  if (!ctx.hasClinic) {
    issues.push({
      severity: "error",
      code: "no-clinic",
      message: "Selecione uma unidade para gerar a mensagem.",
    });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    if (ctx.hasClinic) {
      issues.push({
        severity: "error",
        code: "empty",
        message: "A mensagem está vazia — verifique o período selecionado.",
      });
    }
  } else {
    const len = text.length;
    if (len > WA_MAX_CHARS) {
      issues.push({
        severity: "error",
        code: "over-limit",
        message: `Excede em ${len - WA_MAX_CHARS} caractere(s) o limite do WhatsApp (máx. ${WA_MAX_CHARS}).`,
      });
    } else if (len > WA_NEAR_LIMIT) {
      issues.push({
        severity: "warning",
        code: "near-limit",
        message: `Próximo do limite — ${len.toLocaleString("pt-BR")} de ${WA_MAX_CHARS} caracteres.`,
      });
    }

    // Unclosed inline markers (per line, ignoring code spans)
    const stripCode = text.replace(/`[^`\n]+`/g, "");
    const checkPair = (char: string, label: string) => {
      const lines = stripCode.split("\n");
      let badLines = 0;
      for (const line of lines) {
        const re = new RegExp(`\\${char}`, "g");
        const matches = line.match(re);
        if (matches && matches.length % 2 !== 0) badLines++;
      }
      if (badLines > 0) {
        issues.push({
          severity: "warning",
          code: `unclosed-${char}`,
          message: `${badLines} linha(s) com ${label} aberto sem fechamento (${char}).`,
        });
      }
    };
    checkPair("*", "negrito");
    checkPair("_", "itálico");
    checkPair("~", "tachado");

    // Unresolved variables remaining
    const unresolved = text.match(/\{\{\w+\}\}/g);
    if (unresolved && unresolved.length > 0) {
      const uniq = Array.from(new Set(unresolved));
      issues.push({
        severity: "warning",
        code: "unresolved-vars",
        message: `Variáveis não preenchidas: ${uniq.join(", ")}.`,
      });
    }

    // Excessive blank lines
    if (/\n{4,}/.test(text)) {
      issues.push({
        severity: "info",
        code: "blank-lines",
        message: "Há blocos com 4+ linhas em branco — pode ficar desformatado.",
      });
    }
  }

  if (!ctx.hasRecipient) {
    issues.push({
      severity: "warning",
      code: "no-recipient",
      message: "Nenhum destinatário definido — defina o WhatsApp acima.",
    });
  } else if (!ctx.recipientValid) {
    issues.push({
      severity: "error",
      code: "bad-recipient",
      message: "Telefone inválido — use DDI 55 + DDD + 8/9 dígitos.",
    });
  }

  return issues;
}

function loadCustomTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t): t is MessageTemplate =>
        t && typeof t.id === "string" && typeof t.name === "string",
    );
  } catch {
    return [];
  }
}

function saveCustomTemplates(items: MessageTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage indisponível */
  }
}

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

async function copyImageToClipboard(file: File): Promise<void> {
  if (!navigator.clipboard || !("write" in navigator.clipboard)) {
    throw new Error("Seu navegador não suporta copiar imagens.");
  }
  const img = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/png"),
  );
  if (!blob) throw new Error("Falha ao converter imagem.");
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e instanceof Event ? new Error("Falha ao carregar imagem.") : e);
    };
    img.src = url;
  });
}

/* ═══════════════════════════════════════════════════════════════
 *  CSV
 * ═══════════════════════════════════════════════════════════════ */

function dailyRowsToCsv(rows: DailyRelatoryDto[]): string {
  const header = [
    "Unidade",
    "Leads",
    "Agendamentos",
    "Com pagamento",
    "Resgates",
    "Atendentes",
    "Observações",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      csvCell(r.unidade),
      csvCell(r.totalLeads),
      csvCell(r.agendamentos),
      csvCell(r.comPagamento),
      csvCell(r.resgastes),
      csvCell(r.atendentes.join("; ")),
      csvCell(r.observacoes),
    ].join(","));
  }
  return "﻿" + lines.join("\n");
}

function monthlyLeadsToCsv(data: RelatorioMensalResumoDto): string {
  const header = ["Nome", "Telefone", "Origem", "Etapa", "Criado em"];
  const lines = [header.map(csvCell).join(",")];
  for (const l of data.leads) {
    lines.push([
      csvCell(l.nome),
      csvCell(l.telefone),
      csvCell(l.origem),
      csvCell(stageLabel(l.stage)),
      csvCell(new Date(l.criadoEm).toLocaleString("pt-BR")),
    ].join(","));
  }
  return "﻿" + lines.join("\n");
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
