import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

/**
 * Onboarding self-service do token do CRM da franquia (Doutor Hérnia / Spine).
 *
 * POR QUE O CAMPO FICA AQUI, E NÃO NO CONSOLE DA IA
 * -------------------------------------------------
 * Quem assina só o dashboard não tem login no console do agente. Mandar essa unidade
 * "configurar lá" seria mandá-la para uma porta trancada. O backend já guardava o token
 * por unidade (cifrado, com prévia mascarada) — faltava a tela.
 *
 * O TOKEN É VALIDADO ANTES DE SALVAR
 * ----------------------------------
 * O PUT bate na API da franquia e só grava se ela aceitar. É de propósito: token errado
 * que "salva com sucesso" cria a pior falha que existe aqui — a unidade acha que conectou,
 * nenhum dado aparece, e ninguém sabe onde procurar. Foi o que aconteceu com o token da
 * Kommo, que venceu em silêncio e congelou duas unidades por meses.
 *
 * NUNCA REEXIBIMOS O TOKEN
 * ------------------------
 * Só a prévia mascarada (6 primeiros … 4 últimos). Guardar de um jeito que dê para
 * reexibir é justamente o que torna uma credencial vazável. Quem perder pede outro ao
 * suporte da franquia.
 */

interface StatusFranquia {
  unitId: number;
  configurado: boolean;
  atualizadoEm: string | null;
  previa: string | null;
}

export function CrmFranquiaCard() {
  const { unitId } = useClinic();
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [editando, setEditando] = useState(false);

  const status = useQuery<StatusFranquia>({
    queryKey: ["spine-config", unitId],
    queryFn: async () => (await api.get(`/api/spine/config?unitId=${unitId}`)).data,
    enabled: !!unitId,
    retry: false,
  });

  const salvar = useMutation({
    mutationFn: async () =>
      (await api.put(`/api/spine/config?unitId=${unitId}`, { token: token.trim() })).data,
    onSuccess: () => {
      setToken("");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["spine-config", unitId] });
      toast.success("Conectado — a franquia aceitou o token.");
    },
    onError: (e: unknown) => {
      const detalhe =
        (e as { response?: { data?: { title?: string; detail?: string } } })?.response?.data;
      toast.error(detalhe?.title ?? "Não foi possível salvar o token.", {
        description: detalhe?.detail,
      });
    },
  });

  const remover = useMutation({
    mutationFn: async () => (await api.delete(`/api/spine/config?unitId=${unitId}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spine-config", unitId] });
      toast.success("Token removido — a unidade ficou desconectada da franquia.");
    },
    onError: () => toast.error("Não foi possível remover o token."),
  });

  if (!unitId) return null;

  const configurado = status.data?.configurado ?? false;
  const atualizadoEm = status.data?.atualizadoEm
    ? new Date(status.data.atualizadoEm).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14px] font-medium text-slate-100">CRM da franquia</h3>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]",
                configurado
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-white/[0.06] text-slate-500",
              )}
            >
              {configurado ? "conectado" : "desconectado"}
            </span>
          </div>
          <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-slate-500">
            É a credencial que libera a agenda, os tratamentos e as avaliações do Doutor Hérnia.
            Sem ela, os cards de consulta e comparecimento ficam vazios — o lado do CRM comercial
            continua funcionando normalmente.
          </p>
        </div>

        <div className="flex gap-2">
          {configurado && !editando ? (
            <>
              <button
                onClick={() => setEditando(true)}
                className="rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-slate-200 transition hover:bg-white/[0.08]"
              >
                Trocar token
              </button>
              <button
                onClick={() => remover.mutate()}
                disabled={remover.isPending}
                className="rounded-md border border-rose-400/25 bg-rose-400/[0.08] px-3 py-1.5 text-[12px] text-rose-200 transition hover:bg-rose-400/[0.15] disabled:opacity-40"
              >
                Desconectar
              </button>
            </>
          ) : null}
        </div>
      </div>

      {configurado && !editando ? (
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-white/[0.06] pt-3.5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Token</p>
            <p className="mt-1.5 font-mono text-[11px] text-slate-400">{status.data?.previa}</p>
          </div>
          {atualizadoEm ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
                Configurado em
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400">{atualizadoEm}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <label
            htmlFor="spine-token"
            className="text-[10px] uppercase tracking-[0.12em] text-slate-600"
          >
            Token de integração da franquia
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id="spine-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole aqui o token que o suporte do Doutor Hérnia enviou"
              className="min-w-[280px] flex-1 rounded-md border border-white/[0.1] bg-black/20 px-3 py-2 font-mono text-[12px] text-slate-200 placeholder:font-sans placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
            />
            <button
              onClick={() => salvar.mutate()}
              disabled={salvar.isPending || token.trim().length < 20}
              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-[12px] text-sky-100 transition hover:bg-sky-400/[0.18] disabled:opacity-40"
            >
              {salvar.isPending ? "Validando…" : "Conectar"}
            </button>
            {editando ? (
              <button
                onClick={() => {
                  setEditando(false);
                  setToken("");
                }}
                className="rounded-md border border-white/[0.1] px-3 py-2 text-[12px] text-slate-400 transition hover:bg-white/[0.05]"
              >
                Cancelar
              </button>
            ) : null}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">
            Ao salvar, testamos o token na hora contra a API do Doutor Hérnia.{" "}
            <span className="text-slate-300">Se ela recusar, nada é gravado</span> — assim a
            unidade não fica achando que conectou enquanto os dados não chegam.
          </p>
        </div>
      )}

      <p className="mt-4 max-w-[70ch] border-t border-white/[0.06] pt-3.5 text-[11.5px] leading-relaxed text-slate-500">
        O token é de <span className="text-slate-300">uma unidade só</span> e é pedido ao suporte
        do Doutor Hérnia. Guardamos cifrado e nunca reexibimos — só a prévia acima. Se perder,
        peça outro: é mais barato que um token que dá para copiar de volta da tela.
      </p>
    </section>
  );
}
