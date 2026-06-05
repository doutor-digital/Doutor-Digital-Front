import { Suspense, useEffect, useState } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Outlet } from "react-router-dom";
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
            <Outlet />
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
