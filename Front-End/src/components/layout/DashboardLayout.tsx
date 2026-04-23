import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTopbar } from "./MobileTopbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileDrawer } from "./MobileDrawer";

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    </div>
  );
}
