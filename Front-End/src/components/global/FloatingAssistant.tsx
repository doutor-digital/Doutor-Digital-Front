import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarCheck,
  Command,
  ListChecks,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCommandPalette } from "@/hooks/useCommandPalette";
import { useGlobalUI } from "@/hooks/useGlobalUI";
import { cn } from "@/lib/utils";

const ROBOT_ICON =
  "https://cdn-icons-png.flaticon.com/512/4712/4712010.png";

type Suggestion = {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Sparkles;
  onClick: () => void;
  tone?: "emerald" | "sky" | "amber" | "violet";
};

type Message = {
  id: string;
  from: "bot" | "user";
  text: string;
  ts: number;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const TIPS = [
  "Use ⌘K (Ctrl+K) para abrir a paleta de comandos.",
  "Cliquei no relatório? Há um preview em formato de celular agora!",
  "Você pode salvar templates personalizados de mensagem WhatsApp.",
  "O painel de Atividades mostra eventos em tempo real.",
  "Defina metas mensais no Dashboard e veja a projeção do mês.",
];

function pickTip(): string {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

export function FloatingAssistant() {
  const { open, setOpen, toggleAssistant } = (() => {
    const s = useGlobalUI();
    return { open: s.assistantOpen, setOpen: s.setAssistantOpen, toggleAssistant: s.toggleAssistant };
  })();
  const openCmd = useCommandPalette((s) => s.setOpen);
  const openActivity = useGlobalUI((s) => s.setActivityOpen);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [tip, setTip] = useState<string>(() => pickTip());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Mensagem inicial quando abre pela primeira vez
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          from: "bot",
          ts: Date.now(),
          text: `${greeting()}! Sou o assistente do Doutor Digital. Como posso ajudar?`,
        },
      ]);
    }
  }, [open, messages.length]);

  // Auto-scroll
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [open, messages.length]);

  // Atalho ESC para fechar
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const reply = (text: string, delay = 350) => {
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, from: "bot", ts: Date.now(), text },
      ]);
    }, delay);
  };

  const sendUser = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      from: "user",
      ts: Date.now(),
      text: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const lower = text.toLowerCase();
    if (lower.includes("relat") || lower.includes("report")) {
      reply("Te levei pra Relatórios! 📊");
      setTimeout(() => navigate("/reports"), 600);
    } else if (lower.includes("lead")) {
      reply("Abrindo a lista de leads…");
      setTimeout(() => navigate("/leads"), 600);
    } else if (lower.includes("atividade") || lower.includes("activity")) {
      reply("Abrindo o feed de atividades.");
      setTimeout(() => openActivity(true), 400);
    } else if (lower.includes("comando") || lower.includes("⌘") || lower.includes("ctrl")) {
      reply("Abrindo a paleta de comandos…");
      setTimeout(() => openCmd(true), 300);
    } else if (lower.includes("dica") || lower.includes("tip")) {
      reply("Aqui vai uma: " + pickTip());
    } else if (lower.includes("atualiz") || lower.includes("refresh")) {
      reply("Recarregando todos os dados…");
      qc.invalidateQueries();
    } else {
      reply(
        "Ainda estou aprendendo! Tente: \"abrir relatórios\", \"ver leads\", \"atividades\" ou use os botões abaixo. ✨",
      );
    }
  };

  const suggestions: Suggestion[] = [
    {
      id: "cmd",
      label: "Paleta de comandos",
      hint: "⌘K",
      icon: Command,
      tone: "violet",
      onClick: () => openCmd(true),
    },
    {
      id: "activity",
      label: "Atividades recentes",
      hint: "feed",
      icon: Activity,
      tone: "sky",
      onClick: () => openActivity(true),
    },
    {
      id: "leads",
      label: "Leads quentes",
      icon: ListChecks,
      tone: "amber",
      onClick: () => navigate("/leads"),
    },
    {
      id: "report",
      label: "Gerar relatório",
      icon: CalendarCheck,
      tone: "emerald",
      onClick: () => navigate("/reports"),
    },
    {
      id: "refresh",
      label: "Atualizar dados",
      icon: RefreshCw,
      onClick: () => {
        qc.invalidateQueries();
        reply("✓ Dados recarregados.");
      },
    },
  ];

  const toneClass: Record<NonNullable<Suggestion["tone"]>, string> = {
    emerald:
      "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200 hover:bg-emerald-400/[0.10]",
    sky: "border-sky-400/20 bg-sky-400/[0.06] text-sky-200 hover:bg-sky-400/[0.10]",
    amber:
      "border-amber-400/20 bg-amber-400/[0.06] text-amber-200 hover:bg-amber-400/[0.10]",
    violet:
      "border-violet-400/20 bg-violet-400/[0.06] text-violet-200 hover:bg-violet-400/[0.10]",
  };
  const defaultTone =
    "border-white/[0.08] bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]";

  return (
    <>
      {/* Painel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-24 right-5 z-[80] w-[340px] sm:w-[360px]",
            "rounded-2xl border border-white/[0.08] bg-[rgba(12,14,22,0.96)] backdrop-blur",
            "shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]",
            "animate-fade-in flex flex-col max-h-[70vh]",
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-emerald-400/20 to-sky-500/20 ring-1 ring-inset ring-white/[0.08]">
              <img
                src={ROBOT_ICON}
                alt="Assistente"
                className="h-full w-full object-contain p-1"
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0c0e16]" />
            </div>

            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold text-slate-100">
                Assistente Digital
              </p>
              <p className="text-[10.5px] text-emerald-300/80">
                online · responde na hora
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
              className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensagens */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-2 px-4 py-3 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.05]"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.from === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed",
                    m.from === "user"
                      ? "rounded-br-sm bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-400/20"
                      : "rounded-bl-sm bg-white/[0.04] text-slate-200 ring-1 ring-inset ring-white/[0.06]",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Tip card */}
            {messages.length <= 1 && (
              <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
                <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300/90">
                  <Sparkles className="h-3 w-3" /> Dica
                </p>
                <p className="text-[11.5px] leading-relaxed text-amber-100/90">
                  {tip}
                </p>
                <button
                  type="button"
                  onClick={() => setTip(pickTip())}
                  className="mt-1.5 text-[10.5px] text-amber-300/70 underline-offset-2 transition hover:text-amber-200 hover:underline"
                >
                  outra dica →
                </button>
              </div>
            )}
          </div>

          {/* Sugestões rápidas */}
          <div className="border-t border-white/[0.05] px-3 py-2.5">
            <p className="mb-1.5 px-1 text-[9.5px] font-semibold uppercase tracking-widest text-slate-500">
              Atalhos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={s.onClick}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      s.tone ? toneClass[s.tone] : defaultTone,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{s.label}</span>
                    {s.hint && (
                      <span className="text-[9.5px] opacity-60">{s.hint}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendUser(input);
            }}
            className="flex items-center gap-2 border-t border-white/[0.05] px-3 py-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo… (ex: abrir relatórios)"
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-400/40 focus:bg-white/[0.04]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={toggleAssistant}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        className={cn(
          "fixed bottom-5 right-5 z-[81] group",
          "h-14 w-14 rounded-full",
          "bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600",
          "shadow-[0_10px_30px_-5px_rgba(16,185,129,0.5),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
          "ring-2 ring-[#0a0a0d]",
          "transition-all duration-200",
          "hover:scale-105 hover:shadow-[0_14px_36px_-4px_rgba(16,185,129,0.6),0_0_0_1px_rgba(255,255,255,0.12)_inset]",
          "active:scale-95",
        )}
      >
        {/* Ping animation when closed */}
        {!open && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        )}

        <span className="relative flex h-full w-full items-center justify-center">
          <img
            src={ROBOT_ICON}
            alt="Assistente"
            className={cn(
              "h-9 w-9 object-contain transition-transform duration-200",
              "drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]",
              "group-hover:rotate-[-6deg]",
              open && "rotate-[12deg]",
            )}
          />
        </span>

        {/* Status dot */}
        <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-300 ring-2 ring-[#0a0a0d]">
          <span className="absolute inset-0 animate-pulse rounded-full bg-emerald-200/60" />
        </span>
      </button>
    </>
  );
}
