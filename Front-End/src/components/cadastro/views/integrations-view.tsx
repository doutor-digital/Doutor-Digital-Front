// Legacy view do dashboard de cadastro (não está mais roteado).
// Mantido como stub apenas pra dashboard-content.tsx compilar.
// A nova tela de integrações ativa é /integracoes (IntegracoesPage).

interface Props {
  onBack?: () => void;
}

export function IntegrationsView({ onBack }: Props) {
  return (
    <div className="p-6 text-slate-400">
      <p>
        Esta tela foi descontinuada. Use a página{" "}
        <a href="/integracoes" className="text-brand-400 hover:underline">
          /integracoes
        </a>{" "}
        ou{" "}
        <a href="/units" className="text-brand-400 hover:underline">
          /units
        </a>
        .
      </p>
      {onBack && (
        <button
          onClick={onBack}
          className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          Voltar
        </button>
      )}
    </div>
  );
}
