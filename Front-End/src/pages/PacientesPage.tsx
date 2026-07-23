import { useState } from "react";
import { Search } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { useClinic } from "@/hooks/useClinic";
import { PacienteFichaConteudo } from "@/components/dashboard/PacienteDrawer";

/**
 * Busca de paciente — abre a evolução de qualquer paciente pelo nome, sem
 * precisar achá-lo no calendário. Reusa o mesmo miolo do painel do calendário
 * (resolução nome → ficha, colisão de cadastro, evolução por protocolo).
 */
export default function PacientesPage() {
  const { unitId } = useClinic();
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState<string | null>(null);

  const submeter = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = texto.trim();
    if (nome.length >= 2) setBusca(nome);
  };

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <PageHeader
        title="Pacientes"
        description="Busque um paciente e veja a evolução do tratamento, direto do sistema clínico"
      />

      {!unitId && (
        <p className="mt-4 text-[13px] text-amber-300/80">
          Selecione uma unidade específica para buscar pacientes.
        </p>
      )}

      {unitId && (
        <>
          <form onSubmit={submeter} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Nome do paciente (mínimo 2 letras)…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-[14px] text-white/90 placeholder:text-white/35 focus:border-emerald-400/40 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={texto.trim().length < 2}
              className="rounded-xl bg-emerald-500/90 px-5 text-[13px] font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Buscar
            </button>
          </form>

          <p className="mt-2 text-[11px] text-white/35">
            A busca usa o nome exato do cadastro. Se houver mais de um paciente com o
            mesmo nome, você escolhe qual.
          </p>

          {busca && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <PacienteFichaConteudo unitId={unitId} nome={busca} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
