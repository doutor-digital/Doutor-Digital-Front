import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * O que o sistema da franquia sabe deste lead.
 *
 * A KOMMO É A VENDA, A FRANQUIA É O ATENDIMENTO
 * ---------------------------------------------
 * O cartão da Kommo diz que o paciente agendou. Quem diz se ele apareceu é o sistema
 * clínico da franquia — e é dele que vem a resposta para a pergunta que ninguém
 * conseguia responder na tela do lead: veio ou faltou, quantas vezes, com quem.
 *
 * O CASAMENTO É POR NOME, E ISSO TEM CONSEQUÊNCIA
 * ----------------------------------------------
 * A API da franquia não expõe CPF e os leads daqui não têm telefone gravado, então o
 * único elo é o nome exato. Nome repetido devolve mais de um cadastro; nesse caso a
 * tela mostra os candidatos em vez de escolher um por conta própria — escolher errado
 * aqui é atribuir a consulta de um paciente a outro.
 */

interface Atendimento {
  idSchedule: number;
  quandoLocal: string;
  categoria?: string | null;
  profissional?: string | null;
  statusName?: string | null;
  grupo: "realizado" | "falta" | "cancelado" | "pendente" | "desconhecido";
}

interface Paciente {
  idClient: number;
  nome: string;
  origem?: string | null;
  status?: string | null;
  idade?: number | null;
  sexo?: string | null;
  cidade?: string | null;
  uf?: string | null;
  totalAtendimentos: number;
  totalFaltas: number;
  primeiroAtendimento?: string | null;
  ultimoAtendimento?: string | null;
  historico: Atendimento[];
}

interface Candidato {
  idClient: number;
  nome: string;
  whatsapp?: string | null;
  cidade?: string | null;
  uf?: string | null;
  origem?: string | null;
}

interface Resolucao {
  nome: string;
  detalhe?: Paciente | null;
  candidatos: Candidato[];
}

const dia = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const TOM: Record<Atendimento["grupo"], string> = {
  realizado: "text-emerald-300",
  falta: "text-rose-300",
  cancelado: "text-slate-500",
  pendente: "text-sky-300",
  desconhecido: "text-slate-500",
};

export function FichaFranquia({ nome, unitId }: { nome?: string | null; unitId?: number | null }) {
  const { data, isLoading, error } = useQuery<Resolucao>({
    queryKey: ["franquia-paciente", unitId, nome],
    queryFn: async () =>
      (await api.get("/api/spine/paciente", { params: { unitId, nome } })).data,
    enabled: !!unitId && !!nome && nome.trim().length >= 2,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (!nome || !unitId) return null;

  return (
    <div className="border-t border-white/[0.05]">
      <p className="px-4 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
        Na clínica
      </p>

      <div className="px-4 pb-3">
        {isLoading && <p className="text-[11.5px] text-slate-600">consultando a franquia…</p>}

        {error && (
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-slate-500">
            O sistema da franquia não respondeu. Os dados de consulta aparecem aqui quando
            ele voltar.
          </p>
        )}

        {data && !data.detalhe && data.candidatos.length === 0 && (
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-slate-500">
            Nenhum cadastro com este nome na franquia. Ou o paciente nunca foi atendido, ou
            o nome está grafado diferente nos dois sistemas.
          </p>
        )}

        {data && data.candidatos.length > 0 && (
          <div>
            <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-amber-200/70">
              {data.candidatos.length} cadastros com este mesmo nome. Não dá para saber qual é
              sem conferir:
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.candidatos.map((c) => (
                <li key={c.idClient} className="text-[11.5px] text-slate-400">
                  <span className="font-mono tabular-nums text-slate-500">#{c.idClient}</span>{" "}
                  {[c.cidade, c.uf].filter(Boolean).join("/") || "sem cidade"}
                  {c.origem && <span className="text-slate-600"> · {c.origem}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {data?.detalhe && <Ficha p={data.detalhe} />}
      </div>
    </div>
  );
}

function Ficha({ p }: { p: Paciente }) {
  const marcados = p.historico.length;

  return (
    <div className="flex flex-col gap-3">
      {/* Compareceu / faltou é o par que importa: um sozinho não diz nada. */}
      <div className="flex items-baseline gap-5">
        <div>
          <p className="font-mono text-[19px] leading-none tabular-nums text-emerald-300">
            {p.totalAtendimentos}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">compareceu</p>
        </div>
        <div>
          <p
            className={cn(
              "font-mono text-[19px] leading-none tabular-nums",
              p.totalFaltas > 0 ? "text-rose-300" : "text-slate-600",
            )}
          >
            {p.totalFaltas}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">faltou</p>
        </div>
        <div>
          <p className="font-mono text-[19px] leading-none tabular-nums text-slate-300">
            {marcados}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">marcados</p>
        </div>
      </div>

      <dl className="flex flex-col gap-1 text-[11.5px]">
        <Linha rotulo="Cadastro" valor={`#${p.idClient}`} />
        {p.origem && <Linha rotulo="Origem lá" valor={p.origem} />}
        {p.idade != null && (
          <Linha rotulo="Idade" valor={`${p.idade} anos${p.sexo ? ` · ${p.sexo}` : ""}`} />
        )}
        {(p.cidade || p.uf) && (
          <Linha rotulo="Cidade" valor={[p.cidade, p.uf].filter(Boolean).join("/")} />
        )}
      </dl>

      {p.historico.length > 0 && (
        <div className="border-t border-white/[0.05] pt-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Consultas</p>
          <ul className="mt-2 flex flex-col gap-2">
            {p.historico.slice(0, 8).map((h) => (
              <li key={h.idSchedule} className="text-[11.5px] leading-snug">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="tabular-nums text-slate-300">{dia(h.quandoLocal)}</span>
                  <span className={cn("shrink-0 text-[10.5px]", TOM[h.grupo])}>
                    {h.statusName ?? h.grupo}
                  </span>
                </div>
                <p className="truncate text-[10.5px] text-slate-600">
                  {[h.categoria, h.profissional].filter(Boolean).join(" · ") || "—"}
                </p>
              </li>
            ))}
          </ul>
          {p.historico.length > 8 && (
            <p className="mt-2 text-[10.5px] text-slate-600">
              e mais {p.historico.length - 8} consulta
              {p.historico.length - 8 > 1 ? "s" : ""} antes dessas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="truncate text-slate-300">{valor}</dd>
    </div>
  );
}
