import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SavedView {
  id: string;
  name: string;
  scope: "leads" | "contacts" | "reports";
  url: string; // path + query string, ex: "/leads?stage=hot"
  icon?: string; // emoji
  createdAt: number;
}

interface SavedViewsStore {
  views: SavedView[];
  add: (view: Omit<SavedView, "id" | "createdAt">) => string;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

export const useSavedViews = create<SavedViewsStore>()(
  persist(
    (set) => ({
      views: [],
      add: (v) => {
        const id = `view-${Date.now().toString(36)}`;
        set((s) => ({
          views: [
            ...s.views,
            { ...v, id, createdAt: Date.now() },
          ].slice(-20),
        }));
        return id;
      },
      remove: (id) =>
        set((s) => ({ views: s.views.filter((v) => v.id !== id) })),
      rename: (id, name) =>
        set((s) => ({
          views: s.views.map((v) => (v.id === id ? { ...v, name } : v)),
        })),
    }),
    { name: "doutor.digital.saved-views" },
  ),
);
