import { useMemo } from "react";
import type { LeadDetail } from "@/types";

/**
 * De onde este lead veio.
 *
 * O CAMPO DA KOMMO É A FONTE, NÃO O CAMPO DO NOSSO BANCO
 * ------------------------------------------------------
 * A coluna `source` do lead vale "Kommo" nos 8.772 leads da unidade: ela diz por qual
 * sistema o lead entrou aqui, não de onde veio a pessoa. A origem de verdade está no
 * campo "Origem" do cartão — Meta-Instagram, Meta-Facebook, Indicação, Google. É esse
 * que aparece aqui.
 *
 * CANAL É DEDUZIDO, E A TELA DIZ ISSO
 * -----------------------------------
 * Não existe campo de canal na Kommo desta unidade. O canal sai da própria origem, e o
 * rótulo avisa que foi deduzido — quem lê precisa saber a diferença entre o que foi
 * registrado e o que foi inferido.
 *
 * CAMPANHA E ANÚNCIO NÃO SÃO INVENTADOS
 * -------------------------------------
 * Nenhum lead desta unidade carrega id de anúncio: o rastreio de clique roda por
 * conversa, no fluxo do n8n, e não escreve no cartão. Mostrar "DESCONHECIDO" em duas
 * linhas passa a impressão de dado que falhou; a tela diz o que existe e onde ver o
 * desempenho por anúncio.
 */

/** Acha um campo do cartão pelo nome, ignorando o símbolo que a Kommo prefixa. */
function campo(lead: LeadDetail, alvo: string): string | null {
  const achado = (lead.camposKommo ?? []).find(
    (c) =>
      c.preenchido &&
      c.nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(alvo),
  );
  const v = achado?.valor?.trim();
  return v ? v : null;
}

/** O canal sai da origem: "Meta-Instagram" é Instagram, um fb.me é Facebook. */
function canalDa(origem: string | null): string | null {
  if (!origem) return null;
  const o = origem.toLowerCase();
  if (o.includes("whatsapp") || o.includes("wa.me")) return "WhatsApp";
  if (o.includes("instagram")) return "Instagram";
  if (o.includes("facebook") || o.includes("fb.me")) return "Facebook";
  if (o.includes("google")) return "Google";
  if (o.includes("site")) return "Site";
  if (o.includes("indica")) return "Indicação";
  if (o.includes("fachada")) return "Presencial";
  return null;
}

export function RastreamentoLead({ lead }: { lead: LeadDetail }) {
  const { origem, canal, ehLink, utm } = useMemo(() => {
    const o = campo(lead, "origem");
    const source = campo(lead, "utm_source");
    const medium = campo(lead, "utm_medium");
    return {
      origem: o,
      canal: canalDa(o),
      ehLink: !!o && /^https?:\/\//i.test(o),
      utm: [source, medium].filter(Boolean).join(" · ") || null,
    };
  }, [lead]);

  return (
    <div className="border-t border-white/[0.05]">
      <p className="px-4 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        De onde veio
      </p>

      <div className="px-4 pb-3">
        {origem ? (
          <>
            {ehLink ? (
              <a
                href={origem}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[12.5px] text-indigo-300 underline decoration-dotted underline-offset-2 hover:text-indigo-200"
                title={origem}
              >
                {origem.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <p className="text-[13px] font-medium text-indigo-300">{origem}</p>
            )}
            <p className="mt-0.5 text-[10.5px] text-slate-600">
              campo “Origem” do cartão
              {canal && <> · chegou por {canal}</>}
            </p>
          </>
        ) : (
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-slate-500">
            O campo “Origem” do cartão está em branco. Sem ele não dá para dizer por onde
            este lead chegou.
          </p>
        )}

        {/* utm chega em 66 dos 8.772 leads — raro, mas quando chega é dado real. */}
        {utm && (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            {utm}
            <span className="ml-1.5 font-sans text-[10px] text-slate-600">utm do link</span>
          </p>
        )}

        <p className="mt-3 max-w-[34ch] border-t border-white/[0.05] pt-2.5 text-[10.5px] leading-relaxed text-slate-600">
          Campanha e anúncio não vêm gravados no cartão nesta unidade — nenhum dos leads
          carrega id de anúncio. O desempenho por criativo está em{" "}
          <a href="/midia" className="text-slate-400 underline underline-offset-2 hover:text-slate-200">
            Mídia
          </a>
          .
        </p>
      </div>
    </div>
  );
}
