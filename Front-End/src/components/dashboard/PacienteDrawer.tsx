import { useQuery } from "@tanstack/react-query";
import { X, Check, Phone, MapPin, User, Calendar } from "@/components/icons";
import {
  pacientePorNome,
  pacientePorId,
  type SpinePaciente,
  type SpinePacienteHistorico,
} from "@/services/spine";
import { useState } from "react";

interface PacienteDrawerProps {
  unitId: number;
  /** Nome vindo do horário clicado na agenda. */
  nome: string | null;
  onClose: () => void;
}

const COR_GRUPO: Record<string, string> = {
  realizado: "#34d399",
  falta: "#fbbf24",
  cancelado: "#94a3b8",
  pendente: "#60a5fa",
  desconhecido: "#f472b6",
};

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const horaBR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

function LinhaInfo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-white/70">
      <span className="text-white/30">{icone}</span>
      {children}
    </div>
  );
}

function ItemHistorico({ h }: { h: SpinePacienteHistorico }) {
  const cor = COR_GRUPO[h.grupo] ?? COR_GRUPO.desconhecido;
  return (
    <div className="flex items-center gap-3 border-l-2 py-2 pl-3" style={{ borderColor: cor }}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-white/85">{h.categoria ?? "—"}</span>
          {h.grupo === "realizado" && <Check className="h-3 w-3 text-emerald-400" />}
        </div>
        <div className="text-[11px] text-white/40">
          {dataBR(h.quandoLocal)} · {horaBR(h.quandoLocal)}
          {h.profissional ? ` · ${h.profissional}` : ""}
        </div>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: `${cor}22`, color: cor }}
      >
        {h.situacao}
      </span>
    </div>
  );
}

function Ficha({ p }: { p: SpinePaciente }) {
  return (
    <>
      {/* Identidade */}
      <div className="border-b border-white/10 px-5 pb-4 pt-1">
        <h2 className="text-lg font-semibold text-white">{p.nome}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
          {p.status && (
            <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
              {p.status}
            </span>
          )}
          {p.origem && <span>Origem: {p.origem}</span>}
          <span className="text-white/25">#{p.idClient}</span>
        </div>
      </div>

      {/* Contato e perfil */}
      <div className="space-y-2 px-5 py-4">
        {p.telefone && (
          <LinhaInfo icone={<Phone className="h-3.5 w-3.5" />}>
            <a href={`https://wa.me/${p.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
              className="text-emerald-300 hover:underline">
              {p.telefone}
            </a>
          </LinhaInfo>
        )}
        {(p.idade != null || p.sexo) && (
          <LinhaInfo icone={<User className="h-3.5 w-3.5" />}>
            {[p.sexo, p.idade != null ? `${p.idade} anos` : null].filter(Boolean).join(" · ")}
            {p.nascimento && <span className="text-white/35"> ({dataBR(p.nascimento)})</span>}
          </LinhaInfo>
        )}
        {(p.cidade || p.endereco) && (
          <LinhaInfo icone={<MapPin className="h-3.5 w-3.5" />}>
            {[p.endereco, [p.cidade, p.uf].filter(Boolean).join("/")].filter(Boolean).join(" — ")}
          </LinhaInfo>
        )}
      </div>

      {/* Resumo do tratamento */}
      <div className="mx-5 mb-4 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-emerald-400">{p.totalAtendimentos}</div>
          <div className="text-[10px] text-white/40">atendimentos</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-amber-400">{p.totalFaltas}</div>
          <div className="text-[10px] text-white/40">faltas</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-white/80">{p.historico.length}</div>
          <div className="text-[10px] text-white/40">na agenda</div>
        </div>
      </div>

      {/* Histórico */}
      <div className="px-5 pb-6">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
          <Calendar className="h-3 w-3" /> Histórico na clínica
        </p>
        {p.historico.length === 0 ? (
          <p className="text-[12px] text-white/35">Nenhum agendamento registrado.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {p.historico.map((h) => (
              <ItemHistorico key={h.idSchedule} h={h} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Painel lateral com a ficha completa do paciente, aberto ao clicar num horário
 * do calendário. Resolve o nome da agenda → cadastro no Doutor Hérnia; se houver
 * dois cadastros com o mesmo nome (duplicata), mostra as opções para escolher.
 */
export function PacienteDrawer({ unitId, nome, onClose }: PacienteDrawerProps) {
  const [idEscolhido, setIdEscolhido] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["spine-paciente-nome", unitId, nome],
    queryFn: () => pacientePorNome(unitId, nome!),
    enabled: !!nome && idEscolhido == null,
    retry: false,
  });

  const qId = useQuery({
    queryKey: ["spine-paciente-id", unitId, idEscolhido],
    queryFn: () => pacientePorId(unitId, idEscolhido!),
    enabled: idEscolhido != null,
    retry: false,
  });

  if (!nome) return null;

  const detalhe = qId.data ?? q.data?.detalhe ?? null;
  const candidatos = q.data?.candidatos ?? [];
  const carregando = q.isLoading || qId.isLoading;
  const erro = q.isError || qId.isError;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0b1220] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b1220]/95 px-5 py-3 backdrop-blur">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
            Paciente
          </span>
          <button onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>

        {carregando && (
          <div className="space-y-3 p-5">
            <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/5" />
          </div>
        )}

        {erro && (
          <p className="p-5 text-[12px] text-white/40">
            Não foi possível carregar a ficha. Confira o token da unidade.
          </p>
        )}

        {!carregando && !erro && detalhe && <Ficha p={detalhe} />}

        {/* Colisão de nome — escolher qual cadastro */}
        {!carregando && !detalhe && candidatos.length > 1 && (
          <div className="p-5">
            <p className="mb-3 text-[12px] text-white/50">
              Há {candidatos.length} cadastros com esse nome. Qual é o paciente?
            </p>
            <div className="space-y-2">
              {candidatos.map((c) => (
                <button
                  key={c.idClient}
                  onClick={() => setIdEscolhido(c.idClient)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:bg-white/5"
                >
                  <div className="text-[13px] font-medium text-white/85">{c.nome}</div>
                  <div className="mt-0.5 text-[11px] text-white/40">
                    {[c.whatsapp, [c.cidade, c.uf].filter(Boolean).join("/"), c.origem]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · "}#{c.idClient}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nenhum cadastro encontrado */}
        {!carregando && !erro && !detalhe && candidatos.length === 0 && (
          <div className="p-5">
            <p className="text-[13px] text-white/70">{nome}</p>
            <p className="mt-2 text-[12px] text-white/40">
              Sem cadastro correspondente no Doutor Hérnia. O nome na agenda pode estar
              grafado diferente do cadastro.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
