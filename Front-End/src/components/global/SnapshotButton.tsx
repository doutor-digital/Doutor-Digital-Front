import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Botão pra exportar a página como PDF/imagem usando o print do navegador.
 * Sem dependência adicional — abre a UI nativa de impressão (que já permite
 * "Salvar como PDF" / "Salvar como imagem" no Chrome/Edge).
 */
export function SnapshotButton({ className }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  const handle = () => {
    setBusy(true);
    // pequeno timeout pra UI atualizar antes do bloqueio do print
    setTimeout(() => {
      try {
        window.print();
        toast.success("Use \"Salvar como PDF\" no diálogo de impressão.");
      } catch {
        toast.error("Falha ao abrir o snapshot.");
      } finally {
        setBusy(false);
      }
    }, 80);
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[11.5px] font-medium text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50",
        "print:hidden",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Camera className="h-3.5 w-3.5" />
      )}
      Snapshot
    </button>
  );
}
