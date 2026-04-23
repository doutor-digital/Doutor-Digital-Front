/**
 * Confetti simples baseado em canvas. Sem deps.
 * Uso: confetti({ particleCount: 80 })
 */

interface ConfettiOptions {
  particleCount?: number;
  /** ms de duração total */
  duration?: number;
  /** cores hex */
  colors?: string[];
  /** origem { x: 0..1, y: 0..1 } relativo à viewport. Default: centro. */
  origin?: { x: number; y: number };
  /** amplitude horizontal inicial (px/s) */
  spread?: number;
}

const DEFAULT_COLORS = [
  "#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa", "#fb7185",
];

export function confetti(opts: ConfettiOptions = {}): void {
  if (typeof window === "undefined") return;
  const {
    particleCount = 60,
    duration = 1800,
    colors = DEFAULT_COLORS,
    origin = { x: 0.5, y: 0.35 },
    spread = 420,
  } = opts;

  // Respeita prefers-reduced-motion
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  };
  resize();

  type P = {
    x: number; y: number;
    vx: number; vy: number;
    w: number; h: number;
    rot: number; vrot: number;
    color: string;
  };

  const cx = window.innerWidth * origin.x;
  const cy = window.innerHeight * origin.y;

  const particles: P[] = Array.from({ length: particleCount }).map(() => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const v = 400 + Math.random() * (spread - 100);
    return {
      x: cx,
      y: cy,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      w: 8 + Math.random() * 6,
      h: 5 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });

  const start = performance.now();
  const gravity = 1100;
  const drag = 0.992;

  const tick = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dt = 1 / 60;
    particles.forEach((p) => {
      p.vy += gravity * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - t / duration);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (t < duration) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(tick);
}
