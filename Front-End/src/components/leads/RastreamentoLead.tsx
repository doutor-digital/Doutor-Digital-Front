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
 * O ANÚNCIO ESTÁ NO CARTÃO, NÃO NAS COLUNAS DO LEAD
 * -------------------------------------------------
 * O n8n grava o rastreio do clique — ctwa_clid, id, título, plataforma, URL e imagem —
 * nos campos customizados do cartão, e não nas colunas `Ad`/`LastAdId` da tabela de
 * leads, que ficam vazias. Quem procurar pelas colunas conclui que o rastreio não
 * existe; ele existe em 130 leads da unidade. Daqui se lê o cartão.
 *
 * Quando não há anúncio, a tela diz por que não há em vez de mostrar travessão: só
 * chega rastreio de quem veio de anúncio com clique para o WhatsApp.
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
  const { origem, canal, ehLink, utm, anuncio } = useMemo(() => {
    const o = campo(lead, "origem");
    const source = campo(lead, "utm_source");
    const medium = campo(lead, "utm_medium");

    // O rastreio do clique é gravado pelo n8n nos campos do cartão, não nas
    // colunas do lead — foi por olhar só as colunas que eu concluí, errado, que
    // este dado não existia.
    const titulo = campo(lead, "titulo do anuncio");
    const id = campo(lead, "id do anuncio");
    const plataforma = campo(lead, "plataforma de origem");
    const url = campo(lead, "url de origem do clique");
    const imagem = campo(lead, "imagem do anuncio");
    const campanha = campo(lead, "campanha");
    const conjunto = campo(lead, "conjunto de anuncio");
    const ctwa = campo(lead, "ctwa_clid");

    return {
      origem: o,
      canal: canalDa(o),
      ehLink: !!o && /^https?:\/\//i.test(o),
      utm: [source, medium].filter(Boolean).join(" · ") || null,
      anuncio: id || titulo ? { titulo, id, plataforma, url, imagem, campanha, conjunto, ctwa } : null,
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

        {/* O anúncio que trouxe a pessoa, quando o rastreio do clique pegou. */}
        {anuncio && (
          <div className="mt-3 border-t border-white/[0.05] pt-3">
            <div className="flex gap-2.5">
              {anuncio.imagem && (
                <img
                  src={anuncio.imagem}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded bg-white/[0.03] object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-[12.5px] text-slate-200">
                  {anuncio.titulo ?? "Anúncio sem título"}
                </p>
                <p className="mt-0.5 text-[10.5px] text-slate-600">
                  anúncio que trouxe este lead
                  {anuncio.plataforma && <> · {anuncio.plataforma}</>}
                </p>
              </div>
            </div>

            <dl className="mt-2.5 flex flex-col gap-1 text-[11px]">
              {anuncio.campanha && <Linha rotulo="Campanha" valor={anuncio.campanha} />}
              {anuncio.conjunto && <Linha rotulo="Conjunto" valor={anuncio.conjunto} />}
              {anuncio.id && <Linha rotulo="Id do anúncio" valor={anuncio.id} mono />}
            </dl>

            {anuncio.url && (
              <a
                href={anuncio.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate text-[11px] text-indigo-300 underline decoration-dotted underline-offset-2 hover:text-indigo-200"
              >
                abrir a peça
              </a>
            )}
          </div>
        )}

        <p className="mt-3 max-w-[34ch] border-t border-white/[0.05] pt-2.5 text-[10.5px] leading-relaxed text-slate-600">
          {anuncio
            ? "O rastreio do clique pegou este lead. O desempenho por criativo está em "
            : "O rastreio do clique não pegou este lead — só chega quando a pessoa vem de anúncio com clique para o WhatsApp. O desempenho por criativo está em "}
          <a href="/midia" className="text-slate-400 underline underline-offset-2 hover:text-slate-200">
            Mídia
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Linha({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-slate-600">{rotulo}</dt>
      <dd className={mono ? "truncate font-mono text-slate-400" : "truncate text-slate-300"}>
        {valor}
      </dd>
    </div>
  );
}
