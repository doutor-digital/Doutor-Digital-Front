import { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { redeComparativo } from "@/services/spine";
import { webhooksService } from "@/services/webhooks";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { AjudaKpi } from "@/components/dashboard/AjudaKpi";

const nf = new Intl.NumberFormat("pt-BR");
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * O dashboard da rede: as clínicas conectadas numa tela só.
 *
 * POR QUE ESTA PÁGINA TEM CASCA PRÓPRIA
 * -------------------------------------
 * O resto do app é escuro. Esta tela é clara de propósito — é o formato aprovado — e
 * clarear o DashboardLayout faria as outras 54 páginas, todas escuras, ficarem com casca
 * errada. Então ela traz o próprio menu e o próprio topo, e roda fora do layout comum.
 * Quando (se) o app inteiro migrar para claro, esta casca sai e a página volta pro layout.
 *
 * DE ONDE VEM CADA NÚMERO
 * -----------------------
 * Leads é o único da Kommo: é a boca do funil comercial. Agendados, consultas, faltas e
 * tratamentos vêm todos da agenda da franquia, no mesmo recorte — a DATA DO FATO, o que
 * aconteceu na clínica no período. Por isso a tela confere com a tela da franquia, número
 * a número, e não depende de card arrastado à mão.
 *
 * O PERÍODO MANDA NAS DUAS FONTES
 * -------------------------------
 * Trocar o período refaz as duas consultas com as mesmas datas — a da Kommo e a da
 * franquia. Não existe número aqui preso a uma janela fixa.
 *
 * UNIDADE SEM TOKEN NÃO VIRA ZERO
 * -------------------------------
 * Ela sai da tabela e aparece nomeada no card escuro, como pendência de conexão. Zero
 * diria que a clínica não agendou nada, quando na verdade é a nossa vista que está tapada.
 */
export default function RedeDashboardPage() {
  const [dias, setDias] = useState(30);
  const { tenantId } = useClinic();
  const { user, logout } = useAuth();

  const { de, ate, desde, ateIso } = useMemo(() => {
    const fim = new Date();
    const ini = new Date(fim.getTime() - (dias - 1) * 24 * 3600_000);
    ini.setHours(0, 0, 0, 0);
    return { de: iso(ini), ate: iso(fim), desde: ini.toISOString(), ateIso: fim.toISOString() };
  }, [dias]);

  const rede = useQuery({
    queryKey: ["rede-dash", "comparativo", de, ate],
    queryFn: () => redeComparativo(de, ate),
    staleTime: 60_000,
  });

  // Leads é o único número que não vem da franquia — vem do funil comercial da Kommo,
  // agregado por tenant (sem unidade selecionada).
  const leads = useQuery({
    queryKey: ["rede-dash", "leads", tenantId, desde, ateIso],
    queryFn: () =>
      webhooksService.dashboardOverview({
        clinicId: tenantId ?? undefined,
        dateFrom: desde,
        dateTo: ateIso,
      }),
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const carregando = rede.isLoading || leads.isLoading;
  const t = rede.data?.totais;
  const unidades = (rede.data?.unidades ?? []).filter((u) => !u.erro);
  const comErro = (rede.data?.unidades ?? []).filter((u) => u.erro);
  const semToken = rede.data?.semToken ?? [];

  const totalLeads = leads.data?.total_leads ?? null;
  const faltas = unidades.reduce((a, u) => a + u.naoCompareceram, 0);
  const agendados = t?.agendadas ?? null;
  const consultas = t?.compareceram ?? null;
  const tratamentos = t?.tratamentos ?? null;

  const taxa = (a: number | null, b: number | null) =>
    a == null || b == null || a === 0 ? null : (b / a) * 100;

  // A explicação de cada KPI vive junto do KPI, não num manual à parte. Todas dizem o
  // recorte que o nome esconde — é o recorte, não o nome, que faz duas pessoas olharem
  // o mesmo painel e discordarem do que ele diz.
  const etapas = [
    {
      nome: "Leads",
      valor: totalLeads,
      fonte: "kommo" as const,
      ajuda:
        "Pessoas que chegaram no período e viraram card na Kommo — anúncio, WhatsApp, " +
        "indicação registrada. É o único número desta linha que depende de alguém ter " +
        "mexido no CRM; todos os outros vêm da agenda da clínica.",
    },
    {
      nome: "Agendados",
      valor: agendados,
      fonte: "franquia" as const,
      ajuda:
        "Avaliações marcadas na agenda da franquia para o período. Conta SÓ avaliação: " +
        "sessão de tratamento e retorno ficam de fora, porque não são paciente novo. " +
        "O que foi desmarcado ou remarcado também sai da conta.",
    },
    {
      nome: "Consultas",
      valor: consultas,
      fonte: "franquia" as const,
      ajuda:
        "Das avaliações marcadas, quantas o paciente de fato compareceu — situação " +
        "ATENDIDO na agenda da franquia. Não é quem marcou: é quem sentou na cadeira.",
    },
    {
      nome: "Tratamentos",
      valor: tratamentos,
      fonte: "franquia" as const,
      ajuda:
        "Tratamentos lançados no período, pela rota oficial da franquia. Conta o que foi " +
        "lançado no mês mesmo que depois vire desistência — senão o número do passado " +
        "mudaria sozinho conforme a recepção edita a situação.",
    },
    {
      nome: "Receita",
      valor: null,
      fonte: "franquia" as const,
      porque: "Sem fonte: a franquia não expõe o valor do tratamento.",
      ajuda:
        "Ainda não existe. A franquia não expõe o valor do tratamento em nenhuma rota, e " +
        "o campo de valor está vazio em todas as linhas do nosso banco. Fica em branco " +
        "de propósito: um zero aqui seria lido como 'não vendeu nada'.",
    },
  ];

  const taxas = [
    { v: taxa(totalLeads, agendados), rot: "agendamento" },
    { v: taxa(agendados, consultas), rot: "comparecimento" },
    { v: taxa(consultas, tratamentos), rot: "fechamento" },
    { v: null as number | null, rot: "ticket médio" },
  ];
  const furou = taxas[0].v != null && taxas[0].v > 100;

  // O teto das barras é a maior unidade: a comparação é entre elas, não contra uma meta
  // que ninguém definiu.
  const maiorAgenda = Math.max(1, ...unidades.map((u) => u.agendadas));
  const topAgenda = [...unidades].sort((a, b) => b.agendadas - a.agendadas).slice(0, 7);
  const pior = [...unidades].sort((a, b) => a.taxaComparecimento - b.taxaComparecimento)[0];
  const ranking = [...unidades].sort((a, b) => b.taxaComparecimento - a.taxaComparecimento).slice(0, 4);

  // O trilho do gauge é "sem desfecho registrado" — o que sobra depois de comparecimento
  // e falta. Não é uma série colorida: é o resto, e fica neutro de propósito.
  const pctComp = t && t.agendadas > 0 ? (t.compareceram / t.agendadas) * 100 : 0;
  const pctFalta = t && t.agendadas > 0 ? (faltas / t.agendadas) * 100 : 0;
  const semDesfecho = t ? Math.max(0, t.agendadas - t.compareceram - faltas) : 0;

  const iniciais = (user?.email ?? "?").slice(0, 2).toUpperCase();

  const nav = [
    { to: "/", label: "A Rede", end: true },
    { to: "/classico", label: "Dashboard clássico" },
    { to: "/conferencia", label: "Conferência" },
    { to: "/calendario", label: "Calendário" },
    { to: "/leads", label: "Leads" },
  ];
  const navGeral = [
    { to: "/integracoes", label: "Integrações" },
    { to: "/settings", label: "Configurações" },
  ];

  const linkCls = (ativo: boolean) =>
    `flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13.5px] transition ${
      ativo
        ? "bg-[#e6f3ff] font-bold text-[#004f91]"
        : "font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen bg-[#EDF1F6] p-4 sm:p-6">
      <div className="mx-auto grid max-w-[1240px] grid-cols-1 overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(14,22,32,.04),0_8px_24px_rgba(14,22,32,.06)] lg:grid-cols-[236px_1fr]">
        {/* ─── Menu ────────────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
          <Link to="/" className="flex items-center gap-2.5 px-2">
            <img src="/logo-official.png" alt="" className="h-[30px] w-[30px]" />
            <span className="text-[15.5px] font-extrabold leading-tight tracking-tight text-slate-900">
              Doutor Digital
              <span className="block text-[9.5px] font-bold tracking-[0.13em] text-slate-400">
                REDE
              </span>
            </span>
          </Link>

          <div>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400">MENU</p>
            <nav className="flex flex-col gap-0.5">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => linkCls(isActive)}>
                  {({ isActive }) => (
                    <>
                      <i
                        className={`h-4 w-4 flex-none rounded-[5px] ${
                          isActive ? "bg-[#0086f7]" : "bg-slate-300"
                        }`}
                      />
                      {n.label}
                      {n.end && rede.data && (
                        <span className="ml-auto rounded-md bg-[#cce8ff] px-1.5 py-0.5 text-[10.5px] font-bold text-[#004f91]">
                          {unidades.length}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400">GERAL</p>
            <nav className="flex flex-col gap-0.5">
              {navGeral.map((n) => (
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

          {semToken.length > 0 && (
            <div className="mt-auto rounded-[20px] bg-[#00355e] p-[18px] text-white">
              <h4 className="mb-1.5 text-[14px] font-bold">
                {semToken.length} {semToken.length === 1 ? "clínica fora" : "clínicas fora"} do mapa
              </h4>
              <p className="mb-3 text-[11.5px] leading-relaxed text-[#9FC4E4]">
                Não entram nos números porque falta o token do Doutor Hérnia.
              </p>
              <Link
                to="/integracoes"
                className="block rounded-[10px] bg-[#ffb500] py-2 text-center text-[12.5px] font-extrabold text-[#3d2b00] hover:bg-[#ffbf00]"
              >
                Conectar unidade
              </Link>
            </div>
          )}
        </aside>

        {/* ─── Conteúdo ────────────────────────────────────────────────── */}
        <div className="flex flex-col">
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

          <div className="flex flex-col gap-4 px-6 pb-7 pt-[22px]">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900">A Rede</h1>
                <p className="mt-1 max-w-[62ch] text-[13px] text-slate-500">
                  O funil inteiro numa linha. Cada número diz de onde veio — e só o primeiro
                  depende de alguém ter mexido num card.
                </p>
              </div>
              <div className="flex gap-2">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDias(d)}
                    className={`rounded-[11px] px-[15px] py-2.5 text-[12.5px] font-bold transition ${
                      dias === d
                        ? "bg-[#0086f7] text-white"
                        : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {d} dias
                  </button>
                ))}
              </div>
            </div>

            {/* ─── O FUNIL ─────────────────────────────────────────────── */}
            <section className="rounded-[20px] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap">
                {etapas.map((e) => (
                  <div
                    key={e.nome}
                    className={`flex min-w-[140px] flex-1 flex-col gap-2 border-l border-slate-200 px-3.5 first:border-l-0 first:pl-1 ${
                      e.valor == null ? "rounded-xl bg-slate-50/70" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-tight text-slate-900">
                      {e.nome}
                      <AjudaKpi titulo={e.nome} texto={e.ajuda} />
                    </span>
                    <span
                      className={`text-[30px] font-extrabold leading-none tracking-tight tabular-nums ${
                        e.valor == null ? "text-slate-300" : "text-slate-900"
                      }`}
                    >
                      {carregando ? "—" : e.valor == null ? "—" : nf.format(e.valor)}
                    </span>
                    <span
                      className={`self-start rounded-md px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] ${
                        e.fonte === "kommo"
                          ? "bg-[#fff8e6] text-[#664800] ring-1 ring-[#F0D290]"
                          : "bg-[#e6f3ff] text-[#004f91] ring-1 ring-[#B9DCFA]"
                      }`}
                    >
                      {e.fonte === "kommo" ? "Kommo" : "Franquia"}
                    </span>
                    {e.valor == null && !carregando && "porque" in e && (
                      <span className="text-[10.5px] leading-snug text-slate-400">{e.porque}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3.5 hidden border-t border-dashed border-slate-200 pt-3 sm:flex">
                {taxas.map((tx, i) => (
                  <div key={i} className="flex min-w-0 flex-1 items-center justify-center gap-2">
                    <span
                      className={`text-[15px] font-extrabold tracking-tight ${
                        tx.v == null
                          ? "text-slate-300"
                          : i === 0 && furou
                            ? "text-[#8a5a00]"
                            : "text-slate-800"
                      }`}
                    >
                      {tx.v == null ? "—" : `${Math.round(tx.v)}%`}
                    </span>
                    <span
                      className={`h-0.5 flex-1 rounded ${
                        tx.v == null ? "bg-slate-200" : i === 0 && furou ? "bg-[#cc9100]" : "bg-[#0086f7]"
                      }`}
                    />
                    <span className="whitespace-nowrap text-[10px] font-semibold text-slate-400">
                      {tx.rot}
                    </span>
                  </div>
                ))}
              </div>

              {furou && (
                <p className="mt-3.5 rounded-xl border border-[#F5DFA8] bg-[#fff8e6] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#6b4e05]">
                  <b className="font-extrabold">A primeira taxa passou de 100%</b> porque os dois
                  números não são da mesma população: a agenda da franquia conta todo mundo que
                  ocupou horário — inclusive indicação, telefone e balcão, que nunca viraram lead
                  na Kommo.
                </p>
              )}
            </section>

            {rede.isError && (
              <p className="py-8 text-center text-[13px] text-[#9A3412]">
                Não consegui falar com a franquia agora. Tente de novo em instantes.
              </p>
            )}

            {/* ─── Apoio ───────────────────────────────────────────────── */}
            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <article className="rounded-[20px] border border-slate-200 bg-white p-[18px] lg:col-span-6">
                <h3 className="mb-3.5 text-[14.5px] font-bold tracking-tight text-slate-900">
                  Agenda por unidade
                </h3>
                <div className="flex h-[152px] items-end gap-2.5 pt-5">
                  {topAgenda.map((u) => (
                    <div key={u.unitId} className="flex h-full flex-1 flex-col items-center gap-2">
                      <div className="flex flex-1 w-full items-end">
                        <div
                          className="relative w-full rounded-t-[9px] bg-[#0086f7]"
                          style={{ height: `${Math.max(3, (u.agendadas / maiorAgenda) * 100)}%` }}
                          title={`${u.unidade}: ${nf.format(u.agendadas)} agendados`}
                        />
                      </div>
                      <span className="w-full truncate text-center text-[10px] font-semibold text-slate-400">
                        {u.unidade.replace(/^doutor[- ]h[ée]rnia[- ]/i, "").slice(0, 8)}
                      </span>
                    </div>
                  ))}
                  {topAgenda.length === 0 && (
                    <p className="w-full text-center text-[12px] text-slate-400">
                      {carregando ? "carregando…" : "nenhuma unidade conectada"}
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-[20px] border border-slate-200 bg-white p-[18px] lg:col-span-3">
                <h3 className="mb-3.5 flex items-center gap-1.5 text-[14.5px] font-bold tracking-tight text-slate-900">
                  Desfecho da agenda
                  <AjudaKpi
                    titulo="Desfecho da agenda"
                    texto={
                      "O que aconteceu com cada avaliação marcada. Compareceram e faltaram são " +
                      "os dois desfechos registrados; 'sem desfecho' é o que sobra — horário que " +
                      "ninguém marcou o que deu, normalmente desmarcado ou remarcado. Quando essa " +
                      "fatia cinza é grande, o problema é de preenchimento, não de operação."
                    }
                  />
                </h3>
                <div className="relative mx-auto max-w-[220px]">
                  <svg
                    viewBox="0 0 240 132"
                    className="w-full"
                    role="img"
                    aria-label={`Comparecimento da rede: ${Math.round(pctComp)}%. Compareceram ${consultas ?? 0}, faltaram ${faltas}, sem desfecho ${semDesfecho}.`}
                  >
                    <path d="M26 118 A94 94 0 0 1 214 118" fill="none" stroke="#E2E8F0"
                      strokeWidth="26" strokeLinecap="round" pathLength={100} />
                    <path d="M26 118 A94 94 0 0 1 214 118" fill="none" stroke="#cc9100"
                      strokeWidth="26" strokeLinecap="round" pathLength={100}
                      strokeDasharray={`${pctFalta} ${100 - pctFalta}`}
                      strokeDashoffset={-(pctComp + 1)} />
                    <path d="M26 118 A94 94 0 0 1 214 118" fill="none" stroke="#0086f7"
                      strokeWidth="26" strokeLinecap="round" pathLength={100}
                      strokeDasharray={`${pctComp} ${100 - pctComp}`} />
                  </svg>
                  <div className="absolute inset-x-0 bottom-1.5 text-center">
                    <b className="block text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-slate-900">
                      {carregando ? "—" : `${nf.format(Math.round(pctComp * 10) / 10)}%`}
                    </b>
                    <span className="text-[11.5px] text-slate-400">compareceram</span>
                  </div>
                </div>
                {/* Rótulo direto em cada fatia: é o que dá alívio ao amarelo, que fica logo
                    abaixo de 3:1 de contraste sobre o branco. */}
                <div className="mt-3.5 flex flex-col gap-1.5 text-[11.5px] text-slate-500">
                  <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#0086f7] align-[-1px]" />Compareceram <b className="tabular-nums">{nf.format(consultas ?? 0)}</b></span>
                  <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#cc9100] align-[-1px]" />Faltaram <b className="tabular-nums">{nf.format(faltas)}</b></span>
                  <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-[3px] bg-[#E2E8F0] align-[-1px]" />Sem desfecho <b className="tabular-nums">{nf.format(semDesfecho)}</b></span>
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[20px] border border-[#00355e] bg-[#00355e] p-[18px] text-white lg:col-span-3">
                <h3 className="mb-3.5 text-[14.5px] font-bold tracking-tight">Fora do mapa</h3>
                <p className="text-[11.5px] font-semibold text-[#9FC4E4]">Sem franquia conectada</p>
                <p className="my-2 text-[30px] font-extrabold leading-none tracking-tight tabular-nums">
                  {semToken.length}
                </p>
                <p className="text-[11.5px] font-semibold text-[#9FC4E4]">
                  de {semToken.length + unidades.length + comErro.length} clínicas
                </p>
                <ul className="relative z-10 mt-3 flex list-none flex-wrap gap-1.5 p-0">
                  {semToken.slice(0, 8).map((u) => (
                    <li key={u.unitId} className="rounded-[7px] bg-white/10 px-2 py-1 text-[11px] text-[#DCEAF7]">
                      {u.unidade.replace(/^doutor[- ]h[ée]rnia[- ]/i, "")}
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-3.5 lg:grid-cols-12">
              <article className="rounded-[20px] border border-slate-200 bg-white p-[18px] lg:col-span-7">
                <h3 className="mb-3.5 text-[14.5px] font-bold tracking-tight text-slate-900">Unidades</h3>
                <div className="flex flex-col gap-0.5">
                  {unidades.map((u) => {
                    const critico = u.taxaComparecimento < 45;
                    const atencao = !critico && u.taxaComparecimento < 65;
                    return (
                      <div key={u.unitId} className="flex items-center gap-3 rounded-[11px] px-2 py-2.5 hover:bg-slate-50">
                        <div
                          className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-[11.5px] font-extrabold text-white ${
                            critico ? "bg-[#cc9100]" : "bg-[#0086f7]"
                          }`}
                        >
                          {u.unidade.replace(/^doutor[- ]h[ée]rnia[- ]/i, "").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
                            {u.unidade}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {nf.format(u.agendadas)} agendados · {nf.format(u.compareceram)} consultas
                            {u.tratamentos ? ` · ${nf.format(u.tratamentos)} tratam.` : ""}
                          </div>
                        </div>
                        {/* O estado nunca é só cor: a etiqueta carrega a palavra junto do número. */}
                        <span
                          className={`ml-auto whitespace-nowrap rounded-[7px] px-2 py-1 text-[10.5px] font-bold ${
                            critico
                              ? "bg-[#FFE9C2] text-[#664800] ring-1 ring-[#F2C765]"
                              : atencao
                                ? "bg-[#fff8e6] text-[#7a5600]"
                                : "bg-[#e6f3ff] text-[#004f91]"
                          }`}
                        >
                          {nf.format(Math.round(u.taxaComparecimento * 10) / 10)}%
                          {critico ? " · crítico" : atencao ? " · atenção" : ""}
                        </span>
                      </div>
                    );
                  })}
                  {comErro.map((u) => (
                    <div key={u.unitId} className="flex items-center gap-3 px-2 py-2.5 text-[12px] text-slate-400">
                      <span className="truncate">{u.unidade}</span>
                      <span className="ml-auto truncate">{u.erro}</span>
                    </div>
                  ))}
                  {unidades.length === 0 && !carregando && (
                    <p className="py-6 text-center text-[12.5px] text-slate-400">
                      Nenhuma unidade conectada à franquia ainda.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-[20px] border border-slate-200 bg-white p-[18px] lg:col-span-5">
                <h3 className="mb-3.5 text-[14.5px] font-bold tracking-tight text-slate-900">Ranking</h3>
                <div className="flex flex-col gap-0.5">
                  {ranking.map((u, i) => (
                    <div key={u.unitId} className="flex items-center gap-3 rounded-[11px] px-2 py-2.5 hover:bg-slate-50">
                      <div className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] text-[11.5px] font-extrabold text-white ${i === 0 ? "bg-[#0086f7]" : "bg-slate-300"}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-900">{u.unidade}</div>
                        <div className="text-[11px] text-slate-400">{nf.format(u.agendadas)} agendados</div>
                      </div>
                      <span className="ml-auto rounded-[7px] bg-[#e6f3ff] px-2 py-1 text-[10.5px] font-bold text-[#004f91]">
                        {nf.format(Math.round(u.taxaComparecimento * 10) / 10)}%
                      </span>
                    </div>
                  ))}
                </div>

                {pior && pior.taxaComparecimento < 65 && (
                  <div className="mt-4 border-t border-slate-200 pt-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Precisa de atenção
                    </p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                      <b>{pior.unidade}</b> reservou {nf.format(pior.agendadas)} horários e atendeu{" "}
                      {nf.format(pior.compareceram)}. É o pior comparecimento da rede.
                    </p>
                  </div>
                )}
              </article>
            </section>

            <p className="max-w-[92ch] text-[11.5px] leading-relaxed text-slate-400">
              Leads vêm da Kommo; agendados, consultas, faltas e tratamentos vêm da agenda da
              franquia, no recorte da <b className="font-semibold text-slate-500">data do fato</b>.
              Unidade sem token fica fora da conta em vez de entrar como zero — zero diria que ela
              não agendou nada, quando é a nossa vista que está tapada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
