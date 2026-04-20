import { ReactElement, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Loader2 } from "lucide-react";

// ─── Pages (lazy) ─────────────────────────────────────────────────────────────

const DashboardLayout  = lazy(() => import("@/components/layout/DashboardLayout"));
const LoginPage        = lazy(() => import("@/pages/LoginPage"));
const DashboardPage    = lazy(() => import("@/pages/DashboardPage"));
const UnitSelectPage   = lazy(() => import("@/pages/UnitSelectPage"));
const LeadsPage        = lazy(() => import("@/pages/LeadsPage"));
const LeadDetailPage   = lazy(() => import("@/pages/LeadDetailPage"));
const FunnelPage       = lazy(() => import("@/pages/FunnelPage"));
const SourcesPage      = lazy(() => import("@/pages/SourcesPage"));
const EvolutionPage    = lazy(() => import("@/pages/EvolutionPage"));
const LiveMetricsPage  = lazy(() => import("@/pages/LiveMetricsPage"));
const AnalyticsPage    = lazy(() => import("@/pages/AnalyticsPage"));
const AlertsPage       = lazy(() => import("@/pages/AlertsPage"));
const AttendantsPage   = lazy(() => import("@/pages/AttendantsPage"));
const UnitsPage        = lazy(() => import("@/pages/UnitsPage"));
const ReportsPage      = lazy(() => import("@/pages/ReportsPage"));
const SettingsPage     = lazy(() => import("@/pages/SettingsPage"));
const LogsPage         = lazy(() => import("@/pages/LogsPage"));
const AmanheceuPage    = lazy(() => import("@/pages/AmanheceuPage"));
const ContactsPage     = lazy(() => import("@/pages/ContactsPage"));
const ContactDetailPage = lazy(() => import("@/pages/ContactDetailPage"));
const ContactFormPage  = lazy(() => import("@/pages/ContactFormPage"));
const RecentLeadsPage  = lazy(() => import("@/pages/RecentLeadsPage"));
const FinancePage      = lazy(() => import("@/pages/FinancePage"));
const NotFoundPage     = lazy(() => import("@/pages/NotFoundPage"));

// ─── Fullscreen loader ────────────────────────────────────────────────────────

function RouteLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#0a0a0d]/95 backdrop-blur">
      <div className="mb-1 flex items-center gap-2 select-none">
        <div className="h-8 w-8 rounded-md bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] grid place-items-center">
          <span className="text-[13px] font-semibold text-slate-100">D</span>
        </div>
        <span className="text-[14px] font-semibold tracking-tight text-slate-200">
          Doutor Digital
        </span>
      </div>

      <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />

      {/* Texto */}
      <p className="text-[11px] text-slate-600 tracking-widest uppercase">
        Carregando…
      </p>
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

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>

        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Painel de logs — rota isolada, autenticação própria (admin + senha configurada no backend) */}
        <Route path="/logs" element={<LogsPage />} />

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
          <Route path="/leads"             element={<LeadsPage />}        />
          <Route path="/leads/:id"         element={<LeadDetailPage />}   />
          <Route path="/funnel"            element={<FunnelPage />}       />
          <Route path="/sources"           element={<SourcesPage />}      />
          <Route path="/evolution"         element={<EvolutionPage />}    />
          <Route path="/live"              element={<LiveMetricsPage />}  />
          <Route path="/analytics"         element={<AnalyticsPage />}    />
          <Route path="/alerts"            element={<AlertsPage />}       />
          <Route path="/attendants"        element={<AttendantsPage />}   />
          <Route path="/units"             element={<UnitsPage />}        />
          <Route path="/reports"           element={<ReportsPage />}      />
          <Route path="/finance"           element={<FinancePage />}      />
          <Route path="/settings"          element={<SettingsPage />}     />
          <Route path="/amanheceu"         element={<AmanheceuPage />}    />
          <Route path="/recent-leads"      element={<RecentLeadsPage />}  />
          <Route path="/contacts"          element={<ContactsPage />}     />
          <Route path="/contacts/new"      element={<ContactFormPage />}  />
          <Route path="/contacts/:id/edit" element={<ContactFormPage />}  />
          <Route path="/contacts/:id"      element={<ContactDetailPage />} />
          <Route path="*"                  element={<NotFoundPage />}     />
        </Route>

      </Routes>
    </Suspense>
  );
}