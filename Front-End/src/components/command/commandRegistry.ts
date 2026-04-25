import {
  Activity, BarChart3, Bell, Bot, Building2, Cog, Contact, Copy,
  DollarSign, FileBarChart, Filter, LayoutDashboard, LineChart, ListChecks,
  Moon, RefreshCw, Radio, UserPlus, Users2, Workflow,
  type LucideIcon,
} from "lucide-react";

export type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  to?: string;
  action?: () => void;
  keywords?: string[];
  group: "Navegação" | "Ações" | "Recentes";
  shortcut?: string;
};

export const PAGE_COMMANDS: CommandItem[] = [
  { id: "nav:dashboard", title: "Dashboard", icon: LayoutDashboard, to: "/", group: "Navegação", shortcut: "g d", keywords: ["home", "início", "visão"] },
  { id: "nav:live", title: "Ao vivo", icon: Radio, to: "/live", group: "Navegação", shortcut: "g v", keywords: ["live", "tempo real"] },
  { id: "nav:amanheceu", title: "Amanheceu", icon: Moon, to: "/amanheceu", group: "Navegação", keywords: ["madrugada", "manhã"] },
  { id: "nav:analytics", title: "Analytics", icon: BarChart3, to: "/analytics", group: "Navegação", shortcut: "g a" },
  { id: "nav:leads", title: "Leads", icon: ListChecks, to: "/leads", group: "Navegação", shortcut: "g l" },
  { id: "nav:contacts", title: "Contatos", icon: Contact, to: "/contacts", group: "Navegação", shortcut: "g c" },
  { id: "nav:funnel", title: "Funil", icon: Workflow, to: "/funnel", group: "Navegação", shortcut: "g f" },
  { id: "nav:sources", title: "Origens", icon: Filter, to: "/sources", group: "Navegação", shortcut: "g o" },
  { id: "nav:evolution", title: "Evolução", icon: LineChart, to: "/evolution", group: "Navegação", shortcut: "g e" },
  { id: "nav:attendants", title: "Atendentes", icon: Users2, to: "/attendants", group: "Navegação" },
  { id: "nav:units", title: "Unidades", icon: Building2, to: "/units", group: "Navegação", shortcut: "g u" },
  { id: "nav:reports", title: "Relatórios", icon: FileBarChart, to: "/reports", group: "Navegação", shortcut: "g r" },
  { id: "nav:finance", title: "Financeiro", icon: DollarSign, to: "/finance", group: "Navegação" },
  { id: "nav:alerts", title: "Alertas", icon: Bell, to: "/alerts", group: "Navegação" },
  { id: "nav:logs", title: "Logs", icon: Bell, to: "/logs", group: "Navegação", keywords: ["debug"] },
  { id: "nav:settings", title: "Configurações", icon: Cog, to: "/settings", group: "Navegação", shortcut: "g s" },
];

/**
 * Cria os comandos de "Ações" — recebe callbacks injetados pelo CommandPalette
 * para evitar acoplamento direto com hooks/QueryClient no registry estático.
 */
export function buildActionCommands(handlers: {
  openActivityFeed: () => void;
  openAssistant: () => void;
  refreshAll: () => void;
  copyCurrentUrl: () => void;
}): CommandItem[] {
  return [
    {
      id: "act:activity-feed",
      title: "Abrir feed de atividades",
      subtitle: "Eventos recentes de leads e atendimentos",
      icon: Activity,
      action: handlers.openActivityFeed,
      group: "Ações",
      keywords: ["atividade", "feed", "evento", "tempo real"],
    },
    {
      id: "act:assistant",
      title: "Abrir assistente",
      subtitle: "Chat com o robô do Doutor Digital",
      icon: Bot,
      action: handlers.openAssistant,
      group: "Ações",
      keywords: ["bot", "ajuda", "chat", "robo"],
    },
    {
      id: "act:refresh",
      title: "Atualizar todos os dados",
      subtitle: "Reexecuta as queries da página",
      icon: RefreshCw,
      action: handlers.refreshAll,
      group: "Ações",
      keywords: ["recarregar", "reload", "refresh"],
    },
    {
      id: "act:copy-url",
      title: "Copiar URL da página",
      subtitle: "Compartilha o estado atual (filtros + período)",
      icon: Copy,
      action: handlers.copyCurrentUrl,
      group: "Ações",
      keywords: ["link", "share", "compartilhar"],
    },
    {
      id: "act:new-contact",
      title: "Novo contato",
      subtitle: "Abrir formulário",
      icon: UserPlus,
      to: "/contacts/new",
      group: "Ações",
      keywords: ["criar", "adicionar"],
    },
  ];
}

export function scoreCommand(cmd: CommandItem, query: string): number {
  if (!query) return 0.5;
  const q = query.toLowerCase().trim();
  const haystack = [
    cmd.title.toLowerCase(),
    cmd.subtitle?.toLowerCase() ?? "",
    ...(cmd.keywords?.map((k) => k.toLowerCase()) ?? []),
  ].join(" ");

  if (haystack.includes(q)) {
    // prefixo do título ganha boost
    if (cmd.title.toLowerCase().startsWith(q)) return 3;
    if (cmd.title.toLowerCase().includes(q)) return 2;
    return 1;
  }
  // fuzzy: todos os chars de q aparecem em ordem em haystack?
  let idx = 0;
  for (const ch of q) {
    idx = haystack.indexOf(ch, idx);
    if (idx === -1) return -1;
    idx++;
  }
  return 0.3;
}
