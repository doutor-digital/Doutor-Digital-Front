import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useNavigation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * nprogress-style. Verde sutil no topo.
 * Ativa quando:
 * - react-router tá navegando
 * - há query/mutation pendente no react-query
 */
export function TopProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  let nav: { state?: string } = {};
  try {
    // useNavigation pode lançar fora de um <Route>; envelopamos pra segurança
    nav = useNavigation();
  } catch {
    nav = {};
  }

  const active = fetching > 0 || mutating > 0 || nav.state === "loading";

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: ReturnType<typeof setTimeout> | undefined;
    if (active) {
      setVisible(true);
      setProgress((p) => (p < 5 ? 8 : p));
      const tick = () => {
        setProgress((p) => {
          if (p >= 90) return p + 0.1;
          return Math.min(90, p + (90 - p) * 0.08);
        });
        frame = setTimeout(tick, 180);
      };
      tick();
    } else {
      setProgress(100);
      const hide = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 260);
      return () => clearTimeout(hide);
    }
    return () => {
      if (frame) clearTimeout(frame);
    };
  }, [active]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[120] h-[2px]",
        visible ? "opacity-100" : "opacity-0",
        "transition-opacity duration-200",
      )}
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-sky-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
        style={{
          width: `${progress}%`,
          transition: "width 180ms ease-out",
        }}
      />
    </div>
  );
}
