import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StreakStore {
  current: number;
  best: number;
  lastDate: string | null; // ISO YYYY-MM-DD
  hits: string[]; // dates that hit
  recordHit: (today: string) => void;
}

function isYesterday(prev: string, today: string): boolean {
  const p = new Date(prev);
  const t = new Date(today);
  const diff = (t.getTime() - p.getTime()) / 86_400_000;
  return Math.round(diff) === 1;
}

export const useStreak = create<StreakStore>()(
  persist(
    (set) => ({
      current: 0,
      best: 0,
      lastDate: null,
      hits: [],
      recordHit: (today) =>
        set((s) => {
          if (s.lastDate === today) return s; // já registrado hoje
          let next = 1;
          if (s.lastDate && isYesterday(s.lastDate, today)) next = s.current + 1;
          const hits = s.hits.includes(today) ? s.hits : [...s.hits, today].slice(-90);
          return {
            current: next,
            best: Math.max(s.best, next),
            lastDate: today,
            hits,
          };
        }),
    }),
    { name: "doutor.digital.streak" },
  ),
);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registra um hit quando `goalReached` é true. Usa data local pra evitar pular
 * dias por timezone. Idempotente — só conta uma vez por dia.
 */
export function useRecordStreakOnGoal(goalReached: boolean) {
  const recordHit = useStreak((s) => s.recordHit);
  useEffect(() => {
    if (goalReached) recordHit(todayIso());
  }, [goalReached, recordHit]);
}
