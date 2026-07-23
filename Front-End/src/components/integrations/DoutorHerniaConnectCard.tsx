import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Loader2 } from "@/components/icons";
import { spineConfig } from "@/services/spine";

interface Props {
  unitId?: number | null;
  unitName?: string | null;
}

/**
 * Onboarding self-service do Doutor Hérnia: a unidade cola o próprio token e a
 * integração conecta. O token é validado contra a API na hora de salvar (o back
 * recusa token errado/revogado antes de gravar) e persistido cifrado. Sem isso,
 * cada unidade precisaria de cadastro manual no banco — não escala para a rede.
 */
export function DoutorHerniaConnectCard({ unitId, unitName }: Props) {
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [editando, setEditando] = useState(false);

  const status = useQuery({
    queryKey: ["spine-config", unitId],
    queryFn: () => spineConfig.status(unitId!),
    enabled: !!unitId,
  });

  const salvar = useMutation({
    mutationFn: () => spineConfig.salvar(unitId!, token.trim()),
    onSuccess: () => {
      toast.success("Doutor Hérnia conectado.");
      setToken("");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["spine-config", unitId] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail || e?.response?.data?.title || "Não foi possível conectar.");
    },
  });

  const remover = useMutation({
    mutationFn: () => spineConfig.remover(unitId!),
    onSuccess: () => {
      toast.message("Doutor Hérnia desconectado.");
      qc.invalidateQueries({ queryKey: ["spine-config", unitId] });
    },
  });

  const configurado = status.data?.configurado ?? false;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0a0a0d] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-50">Doutor Hérnia</h2>
            {configurado ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300">
                <Check className="h-3 w-3" /> Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                Não conectado
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-slate-400">
            Agenda, comparecimento e ficha do paciente vêm direto do sistema clínico.
            {unitName ? ` Unidade: ${unitName}.` : ""}
          </p>
        </div>
      </div>

      {!unitId && (
        <p className="mt-4 text-[13px] text-amber-300/80">
          Selecione uma unidade específica para configurar o token.
        </p>
      )}

      {unitId && (
        <div className="mt-4">
          {configurado && !editando ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="text-[13px] text-slate-300">
                Token ativo{" "}
                <span className="font-mono text-slate-500">{status.data?.previa}</span>
                {status.data?.atualizadoEm && (
                  <span className="ml-2 text-[11px] text-slate-500">
                    · atualizado em {new Date(status.data.atualizadoEm).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditando(true)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-white/10"
                >
                  Trocar token
                </button>
                <button
                  onClick={() => remover.mutate()}
                  disabled={remover.isPending}
                  className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-[12px] text-red-300 hover:bg-red-500/10"
                >
                  Desconectar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[12px] text-slate-400">
                  Token de integração do Doutor Hérnia
                </label>
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole aqui o token fornecido pelo suporte do Doutor Hérnia…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Peça o token ao suporte do Doutor Hérnia (WhatsApp ou
                  suporte@doutorhernia.com.br). Ele é validado na hora e guardado cifrado.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => salvar.mutate()}
                  disabled={salvar.isPending || token.trim().length < 20}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-4 py-2 text-[13px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {salvar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Conectar e validar
                </button>
                {editando && (
                  <button
                    onClick={() => {
                      setEditando(false);
                      setToken("");
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[13px] text-slate-300 hover:bg-white/5"
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
