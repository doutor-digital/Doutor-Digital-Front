import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * A casca clara do dashboard.
 *
 * POR QUE EXISTE UMA SEGUNDA CASCA
 * --------------------------------
 * O app tem 54 páginas escuras que dividem o DashboardLayout. Clarear aquele layout
 * deixaria todas elas com conteúdo escuro dentro de moldura clara — quebradas. Então o
 * dashboard, que é a tela que migrou para claro, roda nesta casca própria.
 *
 * Isto é transitório de propósito: quando o app inteiro migrar, esta casca some e o
 * dashboard volta para o layout comum. Enquanto isso, as duas convivem, e a diferença
 * entre elas é só a cor — a navegação é a mesma.
 */
const MENU = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/rede", label: "A Rede" },
  { to: "/conferencia", label: "Conferência" },
  { to: "/calendario", label: "Calendário" },
  { to: "/leads", label: "Leads" },
  { to: "/contacts", label: "Contatos" },
];

const GERAL = [
  { to: "/integracoes", label: "Integrações" },
  { to: "/reports", label: "Relatórios" },
  { to: "/settings", label: "Configurações" },
];

export default function LightShell() {
  const { user, logout } = useAuth();
  const iniciais = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const linkCls = (ativo: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] transition ${
      ativo
        ? "bg-[#e6f3ff] font-bold text-[#004f91]"
        : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen bg-[#EDF1F6] p-4 sm:p-6">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(14,22,32,.04),0_8px_24px_rgba(14,22,32,.06)] lg:grid-cols-[236px_1fr]">
        <aside className="flex flex-col gap-6 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
          <Link to="/" className="flex items-center gap-2.5 px-2">
            <img src="/logo-official.png" alt="" className="h-[30px] w-[30px]" />
            <span className="text-[15.5px] font-extrabold leading-tight tracking-tight text-slate-900">
              Doutor Digital
              <span className="block text-[9.5px] font-bold tracking-[0.13em] text-slate-400">
                DASH
              </span>
            </span>
          </Link>

          <div>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400">MENU</p>
            <nav className="flex flex-col gap-0.5">
              {MENU.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => linkCls(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      <i
                        className={`h-4 w-4 flex-none rounded-[5px] ${
                          isActive ? "bg-[#0086f7]" : "bg-slate-300"
                        }`}
                      />
                      {n.label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400">
              GERAL
            </p>
            <nav className="flex flex-col gap-0.5">
              {GERAL.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => linkCls(isActive)}>
                  <i className="h-4 w-4 flex-none rounded-[5px] bg-slate-300" />
                  {n.label}
                </NavLink>
              ))}
              <button type="button" onClick={logout} className={`${linkCls(false)} text-left`}>
                <i className="h-4 w-4 flex-none rounded-[5px] bg-slate-300" />
                Sair
              </button>
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-4 border-b border-slate-200 px-6 py-[18px]">
            <div className="hidden flex-1 items-center gap-2.5 rounded-[11px] border border-slate-200 bg-[#F3F7FB] px-3 py-2.5 text-[13px] text-slate-400 sm:flex sm:max-w-[420px]">
              <span aria-hidden="true">⌕</span> Buscar unidade ou paciente
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#00355e] text-[12.5px] font-bold text-white">
                {iniciais}
              </div>
              <div className="hidden sm:block">
                <b className="block text-[13px] font-bold leading-tight text-slate-900">
                  {user?.email?.split("@")[0] ?? "—"}
                </b>
                <span className="text-[11px] text-slate-400">Franqueador master</span>
              </div>
            </div>
          </div>

          {/* O conteúdo da página. Fundo branco: os cards já trazem a própria borda. */}
          <div className="min-w-0 px-6 pb-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
