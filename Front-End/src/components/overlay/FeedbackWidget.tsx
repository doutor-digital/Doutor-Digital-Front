import { useState } from "react";
import { Frown, MessageSquareText, Send, Smile, X, Meh } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mood = "good" | "meh" | "bad" | null;

/**
 * Widget flutuante de feedback. Bolinha no canto inferior.
 * Integra com `onSubmit` (ex: POST /feedback) ou fallback pra mailto:.
 */
export function FeedbackWidget({
  onSubmit,
  mailto,
}: {
  onSubmit?: (payload: { mood: Mood; message: string; path: string }) => Promise<void>;
  mailto?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const payload = { mood, message: message.trim(), path: window.location.pathname };
    if (!payload.message && !payload.mood) {
      toast.error("Conte o que está pensando 🙂");
      return;
    }
    try {
      setSending(true);
      if (onSubmit) {
        await onSubmit(payload);
      } else if (mailto) {
        const subject = encodeURIComponent(`[feedback] ${payload.path}`);
        const body = encodeURIComponent(
          `Página: ${payload.path}\nHumor: ${payload.mood ?? "—"}\n\n${payload.message}`,
        );
        window.location.href = `mailto:${mailto}?subject=${subject}&body=${body}`;
      }
      toast.success("Feedback enviado, obrigado!");
      setOpen(false);
      setMood(null);
      setMessage("");
    } catch {
      toast.error("Não conseguimos enviar agora. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        className={cn(
          "fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12px] font-medium",
          "border border-white/[0.10] bg-[rgba(12,14,22,0.96)] text-slate-200 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]",
          "backdrop-blur-md transition hover:text-white hover:border-white/[0.18]",
        )}
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enviar feedback"
          className="fixed inset-0 z-[95] flex items-end justify-start p-4 md:items-center md:justify-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

          <div
            className={cn(
              "relative w-[min(420px,100%)] overflow-hidden rounded-2xl",
              "border border-white/[0.08] bg-[rgba(12,14,22,0.96)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]",
            )}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-[13px] font-semibold text-slate-100">Enviar feedback</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="text-slate-500 transition hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <MoodBtn active={mood === "good"} onClick={() => setMood("good")} tone="emerald" icon={<Smile className="h-4 w-4" />} label="Gostei" />
                <MoodBtn active={mood === "meh"}  onClick={() => setMood("meh")}  tone="amber"   icon={<Meh className="h-4 w-4" />} label="Tanto faz" />
                <MoodBtn active={mood === "bad"}  onClick={() => setMood("bad")}  tone="rose"    icon={<Frown className="h-4 w-4" />} label="Chato" />
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Conte o que funcionou, o que não, ou o que você queria que existisse…"
                rows={4}
                className={cn(
                  "w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] text-slate-100 outline-none",
                  "placeholder:text-slate-600 focus:border-white/[0.18]",
                )}
              />

              <p className="text-[10.5px] text-slate-500">
                Página: <span className="text-slate-300">{window.location.pathname}</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.05] bg-white/[0.015] px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-[12px] text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MoodBtn({
  active, onClick, icon, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "emerald" | "amber" | "rose";
}) {
  const TONE = {
    emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25",
    amber:   "bg-amber-500/15   text-amber-200   ring-amber-500/25",
    rose:    "bg-rose-500/15    text-rose-200    ring-rose-500/25",
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[12px] transition",
        active
          ? `${TONE[tone]} ring-1 ring-inset`
          : "bg-white/[0.02] text-slate-400 hover:text-slate-200",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
