import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockedAt: number;
}

interface BadgesStore {
  unlocked: Badge[];
  unlock: (badge: Omit<Badge, "unlockedAt">) => void;
}

export const useBadges = create<BadgesStore>()(
  persist(
    (set, get) => ({
      unlocked: [],
      unlock: (b) => {
        const exists = get().unlocked.some((u) => u.id === b.id);
        if (exists) return;
        set((s) => ({
          unlocked: [...s.unlocked, { ...b, unlockedAt: Date.now() }],
        }));
        toast.success(`🏆 Conquista desbloqueada: ${b.emoji} ${b.name}`);
      },
    }),
    { name: "doutor.digital.badges" },
  ),
);

/** Avalia condições e desbloqueia badges automaticamente. */
export function useEvaluateBadges(metrics: {
  totalLeads: number;
  conversionPct: number;
  streakDays: number;
}) {
  const unlock = useBadges((s) => s.unlock);
  useEffect(() => {
    if (metrics.totalLeads >= 10)
      unlock({
        id: "first-10-leads",
        name: "Primeiros 10 leads",
        emoji: "🌱",
        description: "Atingiu 10 leads no período.",
      });
    if (metrics.totalLeads >= 100)
      unlock({
        id: "century",
        name: "Centena",
        emoji: "💯",
        description: "100 leads no período selecionado.",
      });
    if (metrics.totalLeads >= 500)
      unlock({
        id: "high-volume",
        name: "Alto volume",
        emoji: "🚀",
        description: "500 leads — operação em escala.",
      });
    if (metrics.conversionPct >= 50)
      unlock({
        id: "great-conversion",
        name: "Mestre da conversão",
        emoji: "🎯",
        description: "Conversão acima de 50%.",
      });
    if (metrics.streakDays >= 3)
      unlock({
        id: "streak-3",
        name: "Sequência de 3 dias",
        emoji: "🔥",
        description: "Bateu a meta 3 dias seguidos.",
      });
    if (metrics.streakDays >= 7)
      unlock({
        id: "streak-7",
        name: "Semana perfeita",
        emoji: "⚡",
        description: "Bateu a meta 7 dias seguidos.",
      });
    if (metrics.streakDays >= 30)
      unlock({
        id: "streak-30",
        name: "Mestre da consistência",
        emoji: "🏆",
        description: "30 dias batendo a meta.",
      });
  }, [metrics.totalLeads, metrics.conversionPct, metrics.streakDays, unlock]);
}
