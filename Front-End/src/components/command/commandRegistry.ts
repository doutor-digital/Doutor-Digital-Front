import {
  BarChart3, Bell, Building2, Cog, Contact, DollarSign, FileBarChart,
  Filter, LayoutDashboard, LineChart, ListChecks, Moon, Radio, Users2,
  Workflow, type LucideIcon,
} from "lucide-react";

export type CommandItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  to?: string;
  keywords?: string[];
  group: "Navegação" | "Ações";
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
