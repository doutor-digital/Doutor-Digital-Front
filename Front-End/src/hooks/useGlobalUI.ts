import { create } from "zustand";

interface GlobalUIStore {
  activityOpen: boolean;
  setActivityOpen: (v: boolean) => void;
  toggleActivity: () => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
  toggleAssistant: () => void;
}

export const useGlobalUI = create<GlobalUIStore>((set) => ({
  activityOpen: false,
  setActivityOpen: (v) => set({ activityOpen: v }),
  toggleActivity: () => set((s) => ({ activityOpen: !s.activityOpen })),
  assistantOpen: false,
  setAssistantOpen: (v) => set({ assistantOpen: v }),
  toggleAssistant: () => set((s) => ({ assistantOpen: !s.assistantOpen })),
}));
