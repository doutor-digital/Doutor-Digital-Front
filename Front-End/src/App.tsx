import { ReactElement, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Loader2 } from "@/components/icons";
import { RequireCadastraAuth } from "@/components/cadastro/RequireCadastraAuth";
import { SplashScreen } from "@/components/SplashScreen";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { isAdminLevel, isReadOnly } from "@/lib/roles";

// ─── Pages (lazy) ─────────────────────────────────────────────────────────────

const DashboardLayout  = lazy(() => import("@/components/layout/DashboardLayout"));
const LoginPage        = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage   = lazy(() => import("@/pages/ForgotPasswordPage"));
const VerifyResetCodePage  = lazy(() => import("@/pages/VerifyResetCodePage"));
const ResetPasswordPage    = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage    = lazy(() => import("@/pages/DashboardPage"));
const DesempenhoPage   = lazy(() => import("@/pages/DesempenhoPage"));
const DashboardLeadListPage = lazy(() => import("@/pages/DashboardLeadListPage"));
const UnitSelectPage   = lazy(() => import("@/pages/UnitSelectPage"));
const LeadsPage        = lazy(() => import("@/pages/LeadsPage"));
const LeadDetailPage   = lazy(() => import("@/pages/LeadDetailPage"));
const LeadReviewPage   = lazy(() => import("@/pages/LeadReviewPage"));
const FunnelPage       = lazy(() => import("@/pages/FunnelPage"));
const SourcesPage      = lazy(() => import("@/pages/SourcesPage"));
const EvolutionPage    = lazy(() => import("@/pages/EvolutionPage"));
const AnalyticsPage    = lazy(() => import("@/pages/AnalyticsPage"));
const AlertsPage       = lazy(() => import("@/pages/AlertsPage"));
const AttendantsPage   = lazy(() => import("@/pages/AttendantsPage"));
const UnitsPage        = lazy(() => import("@/pages/UnitsPage"));
const UnitCreatePage   = lazy(() => import("@/pages/UnitCreatePage"));
const WebhookMonitorPage = lazy(() => import("@/pages/WebhookMonitorPage"));
const ReportsPage      = lazy(() => import("@/pages/ReportsPage"));
const SettingsPage     = lazy(() => import("@/pages/SettingsPage"));
const TechnicalSettingsPage = lazy(() => import("@/pages/TechnicalSettingsPage"));
const ImportCloudiaPage = lazy(() => import("@/pages/ImportCloudiaPage"));
const CustomFieldsPage = lazy(() => import("@/pages/CustomFieldsPage"));
const LogsPage         = lazy(() => import("@/pages/LogsPage"));
const AmanheceuPage    = lazy(() => import("@/pages/AmanheceuPage"));
const ContactsPage     = lazy(() => import("@/pages/ContactsPage"));
const ContactsDuplicatesPage = lazy(() => import("@/pages/ContactsDuplicatesPage"));
const DuplicatesPage   = lazy(() => import("@/pages/DuplicatesPage"));
const ContactDetailPage = lazy(() => import("@/pages/ContactDetailPage"));
const ContactFormPage  = lazy(() => import("@/pages/ContactFormPage"));
const RecentLeadsPage  = lazy(() => import("@/pages/RecentLeadsPage"));
const RecuperacaoPage  = lazy(() => import("@/pages/RecuperacaoPage"));
const MudancasEtapasPage = lazy(() => import("@/pages/MudancasEtapasPage"));
const JourneyPage      = lazy(() => import("@/pages/JourneyPage"));
const ConversaoPage    = lazy(() => import("@/pages/ConversaoPage"));
const IaAnalyticsPage = lazy(() => import("@/pages/IaAnalyticsPage"));
const BuscarLeadsPage = lazy(() => import("@/pages/BuscarLeadsPage"));
const FinancePage      = lazy(() => import("@/pages/FinancePage"));

// ─── Insights (CAPI mockada + analytics agregadas) ────────────────────────
const InsightsHubPage     = lazy(() => import("@/pages/InsightsHubPage"));
const SystemOverviewPage  = lazy(() => import("@/pages/SystemOverviewPage"));
const AttributionPathPage = lazy(() => import("@/pages/AttributionPathPage"));
const UtmExplorerPage     = lazy(() => import("@/pages/UtmExplorerPage"));
const SlaPage             = lazy(() => import("@/pages/SlaPage"));
const HeatmapPage         = lazy(() => import("@/pages/HeatmapPage"));
const CohortPage          = lazy(() => import("@/pages/CohortPage"));
const LostReasonsPage     = lazy(() => import("@/pages/LostReasonsPage"));
const ForecastPage        = lazy(() => import("@/pages/ForecastPage"));
const LeadsMapPage        = lazy(() => import("@/pages/LeadsMapPage"));
const QualityScorePage    = lazy(() => import("@/pages/QualityScorePage"));

const NotFoundPage     = lazy(() => import("@/pages/NotFoundPage"));
const InviteAcceptPage = lazy(() => import("@/pages/InviteAcceptPage"));
const IntegracoesPage  = lazy(() => import("@/pages/IntegracoesPage"));
const CentralIntegracoesPage = lazy(() => import("@/pages/CentralIntegracoesPage"));
const ChefAuditPage    = lazy(() => import("@/pages/ChefAuditPage"));
const LoginSessionsPage   = lazy(() => import("@/pages/admin/LoginSessionsPage"));
const LocationConsentsPage = lazy(() => import("@/pages/admin/LocationConsentsPage"));
const EntityChangesPage   = lazy(() => import("@/pages/admin/EntityChangesPage"));
const PerfilPage       = lazy(() => import("@/pages/PerfilPage"));

// ─── Aceite de convite legado (mantido por compat — para tokens já enviados antes da migração)
const CadastroPublicLayout  = lazy(() => import("@/components/cadastro/CadastroPublicLayout"));
const AceitarConvitePage    = lazy(() => import("@/pages/cadastro/AceitarConvitePage"));

// ─── SDR Unificado (/sdr/*) — pages dentro do DashboardLayout principal ────
const PainelSdrPage          = lazy(() => import("@/pages/sdr/PainelSdrPage"));
const CadastroGeralPage      = lazy(() => import("@/pages/sdr/CadastroGeralPage"));
const RevisarLeadSdrPage     = lazy(() => import("@/pages/sdr/RevisarLeadSdrPage"));
const SdrLeadsAprovadosPage  = lazy(() => import("@/pages/sdr/LeadsAprovadosPage"));
const SdrConsultasPage       = lazy(() => import("@/pages/sdr/ConsultasPage"));
const SdrTratamentosPage     = lazy(() => import("@/pages/sdr/TratamentosPage"));
const SdrTarefasPage         = lazy(() => import("@/pages/sdr/TarefasPage"));
const SdrAgendaPage          = lazy(() => import("@/pages/sdr/AgendaPage"));
const SdrMetasPage           = lazy(() => import("@/pages/sdr/MetasPage"));
const SdrAuditoriaPage       = lazy(() => import("@/pages/sdr/AuditoriaPage"));
const SdrRelatoriosPage      = lazy(() => import("@/pages/sdr/RelatoriosPage"));
const SdrListasDominioPage   = lazy(() => import("@/pages/sdr/ListasDominioPage"));

// ─── Fullscreen loader ────────────────────────────────────────────────────────

function RouteLoader() {
 return (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0a0a0d]/95 backdrop-blur">
    <div className="flex flex-col items-center select-none gap-4 mb-2">
      <img
        src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
        alt="Doutor Digital"
        className="h-24 w-auto object-contain opacity-90 animate-pulse"
      />
    </div>

    <div className="flex flex-col items-center gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      <p className="text-[11px] text-slate-600 tracking-widest uppercase">
        Carregando…
      </p>
    </div>
  </div>
);

}

// ─── Guards ───────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireClinic({ children }: { children: ReactElement }) {
  const { unitId, tenantId } = useClinic();
  if (!unitId && !tenantId) return <Navigate to="/select-unit" replace />;
  return children;
}

// Restringe rotas a papéis admin-level (super_admin / analista_ti) — ex.: logs avançados.
function RequireAdminLevel({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (!isAdminLevel(user?.role)) return <Navigate to="/" replace />;
  return children;
}

// Bloqueia papéis somente-leitura (trafego_pago) em telas operacionais.
function RequireWritable({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (isReadOnly(user?.role)) return <Navigate to="/" replace />;
  return children;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <SplashScreen />
      <Suspense fallback={<RouteLoader />}>
      <Routes>

        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-code" element={<VerifyResetCodePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        {/* Painel de logs — rota isolada, autenticação própria (admin + senha configurada no backend) */}
        <Route path="/logs" element={<LogsPage />} />

        {/* Aceite de convite legado (compat) — novos convites usam /invite/:token */}
        <Route element={<CadastroPublicLayout />}>
          <Route path="/cadastro/aceitar-convite/:token" element={<AceitarConvitePage />} />
        </Route>

        {/* Seleção de unidade — requer login, mas não clínica */}
        <Route
          path="/select-unit"
          element={
            <RequireAuth>
              <UnitSelectPage />
            </RequireAuth>
          }
        />

        {/* Área protegida — requer login + clínica */}
        <Route
          element={
            <RequireAuth>
              <RequireClinic>
                <DashboardLayout />
              </RequireClinic>
            </RequireAuth>
          }
        >
          <Route index path="/"            element={<DashboardPage />}   />
          <Route path="/desempenho"        element={<DesempenhoPage />}   />
          <Route path="/dashboard/agendadas"   element={<DashboardLeadListPage kind="scheduled" />} />
          <Route path="/dashboard/compareceram" element={<DashboardLeadListPage kind="attended" />} />
          <Route path="/leads"             element={<LeadsPage />}        />
          <Route path="/leads/:id"         element={<LeadDetailPage />}   />
          <Route path="/leads/:id/revisar" element={<LeadReviewPage />}   />
          <Route path="/leads/:id/journey" element={<JourneyPage />}      />
          <Route path="/funnel"            element={<FunnelPage />}       />
          <Route path="/sources"           element={<SourcesPage />}      />
          <Route path="/evolution"         element={<EvolutionPage />}    />
          <Route path="/analytics"         element={<AnalyticsPage />}    />
          <Route path="/alerts"            element={<AlertsPage />}       />
          <Route path="/attendants"        element={<AttendantsPage />}   />
          <Route path="/units"             element={<UnitsPage />}        />
          <Route path="/units/new"         element={<UnitCreatePage />}   />
          <Route path="/webhooks-monitor"  element={<WebhookMonitorPage />} />
          <Route path="/reports"           element={<ReportsPage />}      />
          <Route path="/finance"           element={<FinancePage />}      />
          <Route path="/settings"          element={<SettingsPage />}     />
          <Route path="/campos-customizados" element={<CustomFieldsPage />} />
          <Route path="/amanheceu"         element={<AmanheceuPage />}    />
          <Route path="/recent-leads"      element={<RecentLeadsPage />}  />
          <Route path="/recuperacao"       element={<RecuperacaoPage />}  />
          <Route path="/mudancas-etapas"   element={<MudancasEtapasPage />} />
          <Route path="/conversao"         element={<ConversaoPage />}    />
          <Route path="/ia-analytics"      element={<IaAnalyticsPage />} />
          <Route path="/buscar-leads"      element={<BuscarLeadsPage />} />
          <Route path="/contacts"          element={<ContactsPage />}     />
          <Route path="/duplicates"        element={<DuplicatesPage />}   />
          <Route path="/contacts/duplicates" element={<ContactsDuplicatesPage />} />
          <Route path="/contacts/new"      element={<ContactFormPage />}  />
          <Route path="/contacts/:id/edit" element={<ContactFormPage />}  />
          <Route path="/contacts/:id"      element={<ContactDetailPage />} />

          {/* SDR Unificado — operacional, bloqueado para papéis somente-leitura */}
          <Route element={<RequireWritable><Outlet /></RequireWritable>}>
            <Route path="/sdr"                 element={<PainelSdrPage />}         />
            <Route path="/sdr/cadastro-geral"     element={<CadastroGeralPage />}     />
            <Route path="/sdr/cadastro-geral/:id" element={<RevisarLeadSdrPage />}    />
            <Route path="/sdr/leads-aprovados"    element={<SdrLeadsAprovadosPage />} />
            <Route path="/sdr/consultas"       element={<SdrConsultasPage />}      />
            <Route path="/sdr/tratamentos"     element={<SdrTratamentosPage />}    />
            <Route path="/sdr/tarefas"         element={<SdrTarefasPage />}        />
            <Route path="/sdr/agenda"          element={<SdrAgendaPage />}         />
            <Route path="/sdr/metas"           element={<SdrMetasPage />}          />
            <Route path="/sdr/auditoria"       element={<SdrAuditoriaPage />}      />
            <Route path="/sdr/listas"          element={<SdrListasDominioPage />}  />
            <Route path="/sdr/relatorios"      element={<SdrRelatoriosPage />}     />
          </Route>

          {/* Convites da equipe */}
          <Route path="/integracoes"        element={<IntegracoesPage />}     />

          {/* Chef (auditoria global) + Perfil */}
          <Route path="/chef/audit-logs"    element={<RequireAdminLevel><ChefAuditPage /></RequireAdminLevel>} />

          {/* Logs avançados — super_admin / analista_ti */}
          <Route element={<RequireAdminLevel><Outlet /></RequireAdminLevel>}>
            <Route path="/settings/technical" element={<TechnicalSettingsPage />} />
            <Route path="/admin/import-cloudia" element={<ImportCloudiaPage />} />
            <Route path="/integracoes/ads"  element={<CentralIntegracoesPage />} />
            <Route path="/admin/sessions"  element={<LoginSessionsPage />}    />
            <Route path="/admin/locations" element={<LocationConsentsPage />} />
            <Route path="/admin/changes"   element={<EntityChangesPage />}    />
          </Route>
          <Route path="/perfil"             element={<PerfilPage />}          />

          <Route path="*"                  element={<NotFoundPage />}     />
        </Route>

      </Routes>
      </Suspense>
    </>
  );
}