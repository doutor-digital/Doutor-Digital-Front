import { useEffect, useMemo, useState } from "react";

const COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa", "#2dd4bf"];

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  size: number;
  drift: number;
}

/**
 * Confetti CSS-only. Sem dependência. ~50 partículas, ~2s.
 * Auto-dispara quando `trigger` muda de false para true.
 */
export function Confetti({
  trigger,
  count = 50,
  duration = 2400,
}: {
  trigger: boolean;
  count?: number;
  duration?: number;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(t);
  }, [trigger, duration]);

  const pieces = useMemo<Piece[]>(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 200,
      duration: duration * 0.7 + Math.random() * (duration * 0.3),
      color: COLORS[i % COLORS.length],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
      drift: -40 + Math.random() * 80,
    }));
  }, [active, count, duration]);

  if (!active) return null;

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translate3d(0,-10vh,0) rotate(0); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translate3d(var(--drift,0), 110vh, 0) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
      >
        {pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 0.4,
              background: p.color,
              borderRadius: 1,
              transform: `rotate(${p.rotate}deg)`,
              animation: `confetti-fall ${p.duration}ms cubic-bezier(.2,.6,.4,1) ${p.delay}ms forwards`,
              ["--drift" as never]: `${p.drift}px`,
            }}
          />
        ))}
      </div>
    </>
  );
}
