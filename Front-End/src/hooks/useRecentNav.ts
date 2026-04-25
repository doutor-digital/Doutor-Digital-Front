import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentNavStore {
  recent: string[];
  push: (path: string) => void;
  clear: () => void;
}

const MAX = 8;
const IGNORE = ["/login", "/select-unit", "/logs"];

export const useRecentNav = create<RecentNavStore>()(
  persist(
    (set) => ({
      recent: [],
      push: (path) =>
        set((s) => {
          if (IGNORE.includes(path)) return s;
          const cleaned = s.recent.filter((p) => p !== path);
          return { recent: [path, ...cleaned].slice(0, MAX) };
        }),
      clear: () => set({ recent: [] }),
    }),
    { name: "doutor.digital.recent-nav" },
  ),
);

/** Mountar uma vez no DashboardLayout para tracking automático. */
export function useTrackRecentNav() {
  const { pathname } = useLocation();
  const push = useRecentNav((s) => s.push);
  useEffect(() => {
    push(pathname);
  }, [pathname, push]);
}
