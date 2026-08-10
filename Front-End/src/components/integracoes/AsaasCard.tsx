import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useClinic } from "@/hooks/useClinic";

/**
 * Liga o webhook do Asaas na unidade.
 *
 * O SEGREDO APARECE UMA VEZ
 * -------------------------
 * Depois de gerado ele fica cifrado e nem o painel consegue lê-lo de volta. Guardar
 * de um jeito que dê para reexibir é justamente o que torna uma chave vazável. Por
 * isso o token fica visível nesta tela até você sair dela — e quem perder gera outro,
 * que é barato.
 *
 * O AVISO SOBRE O externalReference NÃO É RODAPÉ
 * ----------------------------------------------
 * A integração pode estar perfeitamente ligada e não escrever nada, se as cobranças
 * nascerem sem o id do lead. É o erro mais provável aqui e o mais difícil de notar,
 * porque nada quebra — então vem junto do botão, não numa documentação à parte.
 */

interface StatusAsaas {
  ligado: boolean;
  urlWebhook: string;
  eventosSugeridos: string[];
}

interface Gerado {
  url: string;
  token: string;
  eventos: string[];
  aviso: string;
}

export function AsaasCard() {
  const { unitId } = useClinic();
  const qc = useQueryClient();
  const [gerado, setGerado] = useState<Gerado | null>(null);

  const status = useQuery<StatusAsaas>({
    queryKey: ["asaas-status", unitId],
    queryFn: async () => (await api.get(`/api/integrations/asaas/${unitId}`)).data,
    enabled: !!unitId,
    retry: false,
  });

  const ligar = useMutation({
    mutationFn: async () => (await api.post(`/api/integrations/asaas/${unitId}`)).data as Gerado,
    onSuccess: (d) => {
      setGerado(d);
      qc.invalidateQueries({ queryKey: ["asaas-status", unitId] });
      toast.success("Token gerado — copie agora, ele não aparece de novo.");
    },
    onError: () => toast.error("Não foi possível gerar o token."),
  });

  const desligar = useMutation({
    mutationFn: async () => (await api.delete(`/api/integrations/asaas/${unitId}`)).data,
    onSuccess: () => {
      setGerado(null);
      qc.invalidateQueries({ queryKey: ["asaas-status", unitId] });
      toast.success("Webhook do Asaas desligado.");
    },
  });

  if (!unitId) return null;

  const ligado = status.data?.ligado ?? false;
  const url = gerado?.url ?? status.data?.urlWebhook ?? "";

  return (
    <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[14px] font-medium text-slate-100">Asaas</h3>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]",
                ligado ? "bg-emerald-400/15 text-emerald-200" : "bg-white/[0.06] text-slate-500",
              )}
            >
              {ligado ? "ligado" : "desligado"}
            </span>
          </div>
          <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-slate-500">
            Quando uma cobrança é criada, paga, vence ou é estornada, o Asaas avisa e os campos
            financeiros do cartão do lead na Kommo são atualizados.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => ligar.mutate()}
            disabled={ligar.isPending}
            className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[12px] text-sky-100 transition hover:bg-sky-400/[0.18] disabled:opacity-40"
          >
            {ligar.isPending ? "gerando…" : ligado ? "Gerar token novo" : "Ligar"}
          </button>
          {ligado && (
            <button
              onClick={() => desligar.mutate()}
              disabled={desligar.isPending}
              className="rounded-md border border-white/[0.09] px-3 py-1.5 text-[12px] text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200"
            >
              Desligar
            </button>
          )}
        </div>
      </div>

      {(ligado || gerado) && (
        <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4">
          <Campo rotulo="URL do webhook" valor={url} />

          {gerado ? (
            <>
              <Campo rotulo="Token de autenticação" valor={gerado.token} destaque />
              <p className="text-[11.5px] leading-relaxed text-amber-200/70">
                Copie o token agora. Ele fica cifrado no servidor e não é exibido de novo —
                se perder, gere outro por este mesmo botão.
              </p>
            </>
          ) : (
            <p className="text-[11.5px] text-slate-600">
              O token já foi gerado e não pode ser exibido de novo. Se você não o tem em mãos,
              gere outro e atualize no Asaas.
            </p>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
              Eventos para marcar no Asaas
            </p>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-400">
              {(gerado?.eventos ?? status.data?.eventosSugeridos ?? []).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* O jeito mais provável de isto parecer quebrado sem estar. */}
      <p className="mt-4 max-w-[70ch] border-t border-white/[0.06] pt-3.5 text-[11.5px] leading-relaxed text-slate-500">
        <span className="text-slate-300">Toda cobrança precisa nascer com o id do lead da Kommo
        no campo <span className="font-mono">externalReference</span>.</span>{" "}
        É por ele que a cobrança encontra o paciente. Cobrança criada à mão dentro do painel do
        Asaas não tem esse campo, e o evento é recusado — de propósito: sem ele, a única
        alternativa seria adivinhar de quem é a dívida.
      </p>
    </section>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{rotulo}</p>
      <button
        onClick={() => {
          navigator.clipboard.writeText(valor);
          toast.success("Copiado.");
        }}
        className={cn(
          "mt-1 block w-full break-all rounded-md border px-3 py-2 text-left font-mono text-[11.5px] transition",
          destaque
            ? "border-amber-400/25 bg-amber-400/[0.05] text-amber-100 hover:bg-amber-400/[0.09]"
            : "border-white/[0.07] bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]",
        )}
      >
        {valor}
      </button>
    </div>
  );
}
