import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema: escuro" : "Tema: claro"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        "text-slate-500 transition-[color,background-color,transform] duration-200",
        "hover:bg-white/[0.06] hover:text-slate-200",
        "active:scale-90",
        className
      )}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
