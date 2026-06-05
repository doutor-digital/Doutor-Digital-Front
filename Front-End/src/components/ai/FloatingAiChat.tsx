import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "@/components/icons";
import { useClinic } from "@/hooks/useClinic";
import { aiService } from "@/services/ai";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  toolsCalled?: string[];
}

const STORAGE_KEY = "doutor.digital.ai.chat.history";

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(msgs: ChatMessage[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)));
  } catch {
    /* ignore quota */
  }
}

/**
 * Chat flutuante (botão bottom-right) que aparece em qualquer página dentro do
 * DashboardLayout. Context-aware: passa rota atual + unidade selecionada pro
 * backend, que enxerta esses fatos no system prompt do gpt-4o-mini.
 *
 * Inclui gravação de áudio via MediaRecorder + transcrição Whisper.
 */
export function FloatingAiChat() {
  const location = useLocation();
  const { unitId, tenantId } = useClinic();

  const settings = useQuery({
    queryKey: ["ai-settings", tenantId],
    queryFn: () => aiService.getSettings(tenantId),
    staleTime: 5 * 60_000,
  });

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Fecha gravação se desmontar
  useEffect(
    () => () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    },
    [],
  );

  if (!settings.data?.hasKey) {
    // Sem chave configurada — botão pequeno informativo
    return (
      <button
        type="button"
        onClick={() => (window.location.href = "/ia-analytics")}
        title="Configure sua chave da OpenAI em /ia-analytics"
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg grid place-items-center bg-slate-700 text-slate-300 hover:bg-slate-600"
      >
        ⚙
      </button>
    );
  }

  async function send(content: string) {
    if (!content.trim() || sending) return;
    setError(null);
    setSending(true);
    const userMsg: ChatMessage = { role: "user", content: content.trim(), ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");

    try {
      const reply = await aiService.chat({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        unitId,
        currentPath: location.pathname,
        tenantId,
      });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: reply.content,
          ts: Date.now(),
          toolsCalled: reply.toolsCalled,
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages(next); // mantém a pergunta do user
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const text = await aiService.transcribe(blob, "audio.webm", tenantId);
          // Se o usuário já digitou algo, anexa. Senão, substitui.
          setInput((prev) => (prev ? `${prev} ${text}`.trim() : text));
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Falha na transcrição");
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Microfone bloqueado");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function clearHistory() {
    if (confirm("Limpar a conversa?")) setMessages([]);
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Pergunta pra I.A."
        className={cn(
          "fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full shadow-lg grid place-items-center transition-transform",
          "bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white text-[20px]",
          "hover:scale-110 active:scale-95",
          open && "scale-90",
        )}
      >
        {open ? "×" : "✦"}
      </button>

      {/* Painel do chat */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-40 flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{
            width: "min(380px, calc(100vw - 2.5rem))",
            height: "min(560px, calc(100vh - 7rem))",
            background: "#fff",
            border: "1px solid #E5E7EB",
          }}
        >
          <header
            className="flex items-center justify-between px-4 py-2.5"
            style={{ background: "linear-gradient(90deg, #3730A3 0%, #4F46E5 100%)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[16px]">✦</span>
              <div>
                <p className="text-[12.5px] font-semibold text-white leading-none">I.A. do Painel</p>
                <p className="text-[9.5px] text-white/70 mt-0.5">
                  {unitId ? `Unidade #${unitId} · ${location.pathname}` : "Selecione uma unidade no topo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearHistory}
                title="Limpar conversa"
                className="text-white/80 hover:text-white text-[10.5px] px-2"
              >
                limpar
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-[12px] text-slate-500 px-2 py-3">
                <p className="font-medium text-slate-700 mb-2">Oi! Sou a I.A. do painel.</p>
                <p className="mb-2">Posso te ajudar com:</p>
                <ul className="space-y-1 list-disc list-inside text-[11.5px]">
                  <li>Resumos dos números desta unidade</li>
                  <li>Onde clicar pra fazer X no painel</li>
                  <li>Comparar período/desfecho/canal</li>
                  <li>Sugestão de próxima ação</li>
                </ul>
                <p className="mt-2 text-[11px] text-slate-400">Use o microfone se preferir falar.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-[12.5px] whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-indigo-500 text-white"
                      : "bg-white text-slate-700 border border-slate-200",
                  )}
                >
                  {m.content}
                </div>
                {m.role === "assistant" && m.toolsCalled && m.toolsCalled.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[85%]">
                    {Array.from(new Set(m.toolsCalled)).map((tool) => (
                      <span
                        key={tool}
                        className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono"
                        title={`Consultou: ${tool}`}
                      >
                        🔧 {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 text-[12px] bg-white border border-slate-200 text-slate-500 inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  pensando…
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-md px-3 py-2 text-[11.5px] bg-rose-50 text-rose-700 border border-rose-200">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-slate-200 bg-white">
            {recording && (
              <div className="mb-2 flex items-center gap-2 text-[11px] text-rose-600">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Gravando…
              </div>
            )}
            {transcribing && (
              <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Transcrevendo…
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !sending) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Pergunte algo ou clique 🎙 pra falar"
                rows={1}
                className="flex-1 resize-none rounded-md px-2.5 py-1.5 text-[12.5px] outline-none bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400"
                style={{ minHeight: 32, maxHeight: 120 }}
                disabled={sending || transcribing}
              />
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={sending || transcribing}
                title={recording ? "Parar gravação" : "Falar"}
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-md text-[14px]",
                  recording
                    ? "bg-rose-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {recording ? "■" : "🎙"}
              </button>
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || sending}
                className={cn(
                  "h-8 px-3 rounded-md text-[12px] font-semibold text-white",
                  "bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
