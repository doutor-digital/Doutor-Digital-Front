import { ReactElement, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { Loader2 } from "lucide-react";

// ─── Pages (lazy) ─────────────────────────────────────────────────────────────

const DashboardLayout  = lazy(() => import("@/components/layout/DashboardLayout"));
const LoginPage        = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage   = lazy(() => import("@/pages/ForgotPasswordPage"));
const VerifyResetCodePage  = lazy(() => import("@/pages/VerifyResetCodePage"));
const ResetPasswordPage    = lazy(() => import("@/pages/ResetPasswordPage"));
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
const ContactsDuplicatesPage = lazy(() => import("@/pages/ContactsDuplicatesPage"));
const ContactDetailPage = lazy(() => import("@/pages/ContactDetailPage"));
const ContactFormPage  = lazy(() => import("@/pages/ContactFormPage"));
const RecentLeadsPage  = lazy(() => import("@/pages/RecentLeadsPage"));
const FinancePage      = lazy(() => import("@/pages/FinancePage"));
const NotFoundPage     = lazy(() => import("@/pages/NotFoundPage"));

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

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>

        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-code" element={<VerifyResetCodePage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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
          <Route path="/contacts/duplicates" element={<ContactsDuplicatesPage />} />
          <Route path="/contacts/new"      element={<ContactFormPage />}  />
          <Route path="/contacts/:id/edit" element={<ContactFormPage />}  />
          <Route path="/contacts/:id"      element={<ContactDetailPage />} />
          <Route path="*"                  element={<NotFoundPage />}     />
        </Route>

      </Routes>
    </Suspense>
  );
}