import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Lock } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { isPathAllowedForReadOnly, isReadOnly } from "@/lib/roles";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTopbar } from "./MobileTopbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileDrawer } from "./MobileDrawer";
import { CommandPalette } from "@/components/command/CommandPalette";
import { ActivityFeed } from "@/components/global/ActivityFeed";
import { FloatingAssistant } from "@/components/global/FloatingAssistant";
import { FloatingAiChat } from "@/components/ai/FloatingAiChat";
import { ShortcutsModal } from "@/components/shortcuts/ShortcutsModal";
import { useTrackRecentNav } from "@/hooks/useRecentNav";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { LocationConsentPrompt } from "./LocationConsentPrompt";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  hasUnseenRelease,
  WhatsNewModal,
} from "@/components/overlay/WhatsNewModal";

// Papel somente-leitura (trafego_pago) só acessa "os números". Em rota não
// permitida (digitada na URL), mostra a mensagem em vez da página.
function ReadOnlyGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (isReadOnly(user?.role) && !isPathAllowedForReadOnly(pathname)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-white/[0.06]">
            <Lock className="h-6 w-6 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Você não é habilitado</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Seu acesso é só aos números. Esta página não está liberada pro seu perfil.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Voltar pro dashboard
          </Link>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

// Lazy: overlays não-críticos
const FeedbackWidget = lazy(() =>
  import("@/components/overlay/FeedbackWidget").then((m) => ({
    default: m.FeedbackWidget,
  })),
);

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // Tracking: salva últimas rotas visitadas para o ⌘K
  useTrackRecentNav();

  // Heartbeat de presença (alimenta "minutos logada" no log avançado)
  useHeartbeat();

  // Auto-abrir "Novidades" se houver release não vista
  useEffect(() => {
    if (hasUnseenRelease()) {
      const t = setTimeout(() => setWhatsNewOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="min-h-screen flex bg-surface-2">
      {/* Sidebar: desktop (lg+) — inalterado */}
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar desktop original — escondido em mobile */}
        <div className="hidden lg:block">
          <Topbar />
        </div>

        {/* Topbar mobile (lg:hidden dentro do componente) */}
        <MobileTopbar onOpenMenu={() => setDrawerOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] w-full p-4 lg:p-6 animate-fade-in pb-20 lg:pb-6">
            <ReadOnlyGate />
          </div>
        </main>

        {/* Bottom tab bar — só mobile */}
        <MobileBottomNav />
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Globais críticos */}
      <CommandPalette />
      <ActivityFeed />
      <FloatingAssistant />
      <FloatingAiChat />

      {/* Atalhos (?) e novidades */}
      <ShortcutsModal />
      <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />

      {/* Consentimento de localização (LGPD) — papéis operacionais */}
      <LocationConsentPrompt />

      {/* Convite para instalar o app — só mobile */}
      <InstallPrompt />

      {/* Lazy: overlays não-críticos (não bloqueiam a primeira renderização).
          Feedback fica escondido no celular (lg+) pra deixar o mobile mais limpo. */}
      <div className="hidden lg:block">
        <Suspense fallback={null}>
          <FeedbackWidget mailto="doutordigitalconsultoria@gmail.com" />
        </Suspense>
      </div>
    </div>
  );
}
