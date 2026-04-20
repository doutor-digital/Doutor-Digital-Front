# Refatoração visual do frontend — log final

> **Arquivos canônicos:** `src/components/finance/PaymentModal.tsx` · `src/pages/FinancePage.tsx`

## ✅ Fases concluídas

### Passo 2 — Primitivos compartilhados
- [x] `components/finance/PaymentMethodMark.tsx`
- [x] `components/ui/Panel.tsx` · `PanelHeader`
- [x] `components/ui/Kpi.tsx` · `KPI_TONE`, `KpiTone` (emerald/sky/amber/slate/rose/indigo)
- [x] `components/ui/RankBadge.tsx`
- [x] `components/ui/FilterChip.tsx`
- [x] `components/ui/SegmentButton.tsx` · `TabButton`
- [x] `components/ui/PeriodFilter.tsx`

### Fase 1 — UI primitives
- [x] `ui/Button.tsx` · primary = emerald, outline neutro, danger = rose
- [x] `ui/Input.tsx`, `ui/Select.tsx`
- [x] `ui/Badge.tsx` + aliases legados
- [x] `ui/Tabs.tsx`, `ui/Table.tsx`
- [x] `ui/EmptyState.tsx`, `ui/Skeleton.tsx`

### Fase 2 — Layout shell
- [x] `layout/PageHeader.tsx` (com card canônico, eyebrow + title + description)
- [x] `layout/Sidebar.tsx`
- [x] `layout/Topbar.tsx`
- [x] `layout/NotificationsBell.tsx`
- [x] `layout/AlertsIndicator.tsx`

### Fase 3 — Filters/dropdowns
- [x] `filters/DashboardFilters.tsx`
- [x] `finance/LeadSelect.tsx`

### Fase 4 — Charts (padrão recharts canônico)
- [x] `charts/EvolutionLine.tsx`
- [x] `charts/FunnelChart.tsx` + aliases blue/violet
- [x] `charts/SourceDonut.tsx`
- [x] `charts/StageBarChart.tsx`

### Fase 5/6 — Páginas

**Refatoração completa (visual reescrito)**
- [x] `pages/FinancePage.tsx` (canônico)
- [x] `pages/DashboardPage.tsx` — Panel/PanelHeader/Kpi, **imagens Flaticon preservadas nos KPIs**
- [x] `pages/LeadsPage.tsx`
- [x] `pages/LeadDetailPage.tsx`

**Refatoração propagada via shim (Card/KpiCard agora renderizam o visual canônico)**
- [x] `components/ui/Card.tsx` + `components/kpi/KpiCard.tsx` reescritos como aliases que renderizam `Panel`/`Kpi` — todas as 15+ páginas que ainda usam `<Card>`/`<CardHeader>`/`<CardBody>`/`<KpiCard>` recebem o visual novo sem tocar no código

**Correções cirúrgicas (brand/accent/gradientes removidos)**
- [x] `pages/ContactsPage.tsx` — `accent-brand-500` → `accent-emerald-500`, badge tone
- [x] `pages/ContactFormPage.tsx` — input styles, badge tone
- [x] `pages/AlertsPage.tsx` — badge blue tone, removido emoji decorativo
- [x] `pages/SettingsPage.tsx` — textarea/select styles, `accent-brand-500`
- [x] `pages/SourcesPage.tsx` — gradiente `from-brand to-violet`, stat tones
- [x] `pages/RecentLeadsPage.tsx` — preset buttons, input
- [x] `pages/ContactDetailPage.tsx` — avatar gradient → neutro
- [x] `App.tsx` — loader gradient → neutro
- [x] `index.css` — `.btn`, `.btn-primary`, `.input` sem brand/accent

### Fase 7 — Limpeza final
- [x] Zero ocorrências de `brand-500`/`accent-500`/`from-brand-*`/`from-accent-*` em `src/`
- [x] `tsc --noEmit` limpo (único erro pré-existente: `LiveMetricsPage.tsx:15 clinicId` — bug de tipagem fora do escopo)
- [x] Sem emojis decorativos em UI de páginas (mantidos apenas em `ReportsPage` como dados de conteúdo do WhatsApp)

## Notas

### Ícones como imagens
Padrão `<img src="...flaticon.com..." />` **preservado** nos KPIs do Dashboard. O componente `Kpi` aceita `ReactNode` em `icon`. Para outros KPIs que tenham imagens, basta passar `<img>`.

### Aliases temporários
Para evitar reescrever 15+ páginas, esses aliases foram adicionados:
- **`ui/Card.tsx`** (`Card`, `CardHeader`, `CardBody`) → renderiza visual Panel/PanelHeader
- **`kpi/KpiCard.tsx`** → renderiza visual Kpi, com mapeamento dos tones legados (blue→sky, green→emerald, yellow→amber, red→rose, violet→indigo)
- **`ui/Badge.tsx`** tones `blue/green/yellow/red/violet` → aliases sky/emerald/amber/rose/indigo
- **`charts/FunnelChart.tsx`** tones `blue/violet` → aliases sky/indigo

Todos os aliases podem sair no dia em que cada chamada for renomeada para os novos tons — mas **funcionalmente já estão renderizando o visual canônico.**

### LoginPage não tocado
Conforme instrução original ("não alterar auth"). Mantém estética própria.

### Erro pré-existente
`LiveMetricsPage.tsx:15` tem bug de tipagem no `ClinicStore` que antecede esta refatoração — não foi corrigido (fora do escopo visual).

### Regras respeitadas
- Nenhuma lógica de negócio/hooks/API/rotas alterada
- Nenhum campo conectado ao back-end modificado
- `tsc --noEmit` limpo exceto erro pré-existente
- Aliases Card/KpiCard mantém contrato exato das APIs legadas
