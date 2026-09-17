/**
 * A fila que a recepção decide: quem recebe alta e quem parou no meio.
 *
 * Duas listas, com origens opostas:
 *  - terminou o protocolo → candidato a ALTA. NUNCA move sozinho: alta é o
 *    "Ganho" do funil de tratamento e o gatilho dela dispara um bot sem nenhuma
 *    condição. Mover 48 cartões de uma vez mandaria 48 "parabéns pela conclusão",
 *    inclusive para quem terminou em 2025. Por isso quem aprova é gente.
 *  - parou no meio → ninguém olha essa lista hoje. Em Araguaína, 28 dos 57
 *    estavam a TRÊS SESSÕES ou menos de concluir. É gente que pagou e não
 *    recebeu o que comprou.
 *
 * A ordem não é alfabética de propósito: primeiro quem está mais perto de
 * terminar, porque é quem tem mais chance de voltar.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  CheckCircle2,
  HeartPulse,
  KeyRound,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { unitsService } from "@/services/units";
import { useAuth } from "@/hooks/useAuth";
import {
  altasService,
  codigoLembrado,
  CodigoInvalido,
  esquecerCodigo,
  lembrarCodigo,
  type CandidatoDaFila,
  UnidadeSemFila,
  type Decisao,
} from "@/services/altas";
import type { Unit } from "@/types";

/** Só unidades que existem no agente — é lá que a fila mora. */
function comSlug(units: Unit[]): Array<Unit & { slug: string }> {
  return units.filter((u): u is Unit & { slug: string } => Boolean(u.slug));
}

function Pedido({
  slug,
  erro,
  onPronto,
}: {
  slug: string;
  erro?: string | null;
  onPronto: (codigo: string) => void;
}) {
  const [valor, setValor] = useState("");
  return (
    <Card>
      <CardBody className="max-w-md space-y-4 py-8">
        <div className="flex items-center gap-2 text-slate-200">
          <KeyRound className="h-5 w-5" />
          <span className="font-medium">Código da unidade</span>
        </div>
        <p className="text-sm text-slate-400">
          É o mesmo código que a recepção usa para pausar a IA. Pedimos uma vez só —
          depois este computador lembra.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const c = valor.trim();
            if (c.length >= 4) onPronto(c);
          }}
        >
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="código"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-slate-500"
          />
          <Button type="submit" disabled={valor.trim().length < 4}>
            Entrar
          </Button>
        </form>
        {erro ? <p className="text-sm text-rose-400">{erro}</p> : null}
        <p className="text-xs text-slate-500">Unidade: {slug}</p>
      </CardBody>
    </Card>
  );
}

function Linha({
  c,
  ocupado,
  onDecidir,
}: {
  c: CandidatoDaFila;
  ocupado: boolean;
  onDecidir: (d: Decisao) => void;
}) {
  const alta = c.classe === "ALTA";
  return (
    <div className="flex flex-col gap-3 border-b border-slate-800 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-100">
          {c.nome?.trim() || `Paciente do cartão ${c.leadId}`}
        </div>
        <div className="text-sm text-slate-400">{c.resumo}</div>
      </div>
      <div className={cn("flex shrink-0 flex-wrap gap-2", ocupado && "pointer-events-none opacity-50")}>
        {alta ? (
          <Button size="sm" onClick={() => onDecidir("alta")}>
            <Award className="h-4 w-4" />
            Dar alta
          </Button>
        ) : (
          <Button size="sm" onClick={() => onDecidir("recuperar")}>
            <PhoneCall className="h-4 w-4" />
            Chamar de volta
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onDecidir("segue")}>
          <HeartPulse className="h-4 w-4" />
          Ainda em tratamento
        </Button>
        {!alta ? (
          <Button size="sm" variant="outline" onClick={() => onDecidir("desistiu")}>
            <XCircle className="h-4 w-4" />
            Desistiu
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function AltasPage() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();

  const unitsQ = useQuery({
    queryKey: ["units"],
    queryFn: () => unitsService.list(),
    staleTime: 60_000,
  });
  const unidades = useMemo(() => comSlug(unitsQ.data ?? []), [unitsQ.data]);

  const [slug, setSlug] = useState<string>("");
  useEffect(() => {
    if (!slug && unidades.length > 0) setSlug(unidades[0].slug);
  }, [unidades, slug]);

  const [codigo, setCodigo] = useState("");
  useEffect(() => {
    if (slug) setCodigo(codigoLembrado(slug));
  }, [slug]);

  const [erroCodigo, setErroCodigo] = useState<string | null>(null);
  const [feito, setFeito] = useState<{ nome: string; decisao: Decisao } | null>(null);

  const fila = useQuery({
    queryKey: ["altas", slug, codigo],
    queryFn: () => altasService.listar(slug, codigo),
    enabled: Boolean(slug && codigo),
    retry: false,
  });

  useEffect(() => {
    if (fila.error instanceof CodigoInvalido) {
      esquecerCodigo(slug);
      setCodigo("");
      setErroCodigo("Esse código não confere. Confira com a gerência da unidade.");
    }
  }, [fila.error, slug]);

  const decidir = useMutation({
    mutationFn: (v: { c: CandidatoDaFila; decisao: Decisao }) =>
      altasService.decidir(slug, codigo, {
        id: v.c.id,
        decisao: v.decisao,
        por: user?.name?.slice(0, 80),
      }),
    onSuccess: (_r, v) => {
      setFeito({ nome: v.c.nome?.trim() || `cartão ${v.c.leadId}`, decisao: v.decisao });
      void qc.invalidateQueries({ queryKey: ["altas", slug, codigo] });
    },
  });

  if (!slug) {
    return (
      <>
        <PageHeader title="Altas e recuperação" description="Carregando unidades…" />
        <Card>
          <CardBody className="py-10 text-slate-400">Um instante…</CardBody>
        </Card>
      </>
    );
  }

  if (!codigo) {
    return (
      <>
        <PageHeader
          title="Altas e recuperação"
          description="A recepção decide quem recebe alta e quem precisa voltar"
          actions={
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
            >
              {unidades.map((u) => (
                <option key={u.slug} value={u.slug}>
                  {u.name ?? u.slug}
                </option>
              ))}
            </select>
          }
        />
        <Pedido
          slug={slug}
          erro={erroCodigo}
          onPronto={(c) => {
            lembrarCodigo(slug, c);
            setCodigo(c);
            setErroCodigo(null);
          }}
        />
      </>
    );
  }

  const dados = fila.data;
  const total = (dados?.altas.length ?? 0) + (dados?.parados.length ?? 0);

  return (
    <>
      <PageHeader
        title="Altas e recuperação"
        badge={total > 0 ? `${total} esperando` : undefined}
        description={
          dados
            ? `${dados.unidade} · ${dados.altas.length} prontos para alta · ${dados.parados.length} pararam no meio`
            : "Buscando a fila…"
        }
        actions={
          <>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100"
            >
              {unidades.map((u) => (
                <option key={u.slug} value={u.slug}>
                  {u.name ?? u.slug}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void fila.refetch()}
              disabled={fila.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", fila.isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </>
        }
      />

      {feito ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            {feito.decisao === "alta"
              ? `Alta registrada para ${feito.nome} — o cartão já andou no CRM.`
              : feito.decisao === "recuperar"
                ? `Tarefa de contato aberta para ${feito.nome}.`
                : feito.decisao === "segue"
                  ? `${feito.nome} segue em tratamento. Só volta para a lista se fizer sessão nova.`
                  : `${feito.nome} registrado como desistência.`}
          </span>
        </div>
      ) : null}

      {fila.error instanceof UnidadeSemFila ? (
        <Card>
          <CardBody className="py-8">
            <EmptyState
              icon={<Award className="h-6 w-6" />}
              title="Esta unidade ainda não tem fila"
              description="A fila de alta é montada pelo cruzamento com a agenda da franquia. Assim que essa unidade entrar no cruzamento, os nomes aparecem aqui."
            />
          </CardBody>
        </Card>
      ) : fila.isError && !(fila.error instanceof CodigoInvalido) ? (
        <Card>
          <CardBody className="py-8 text-rose-400">
            Não consegui falar com o agente. {String((fila.error as Error)?.message ?? "")}
          </CardBody>
        </Card>
      ) : null}

      {dados ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Prontos para alta"
              subtitle="Terminaram o protocolo. Nada é movido sem alguém clicar."
            />
            <CardBody>
              {dados.altas.length === 0 ? (
                <EmptyState
                  icon={<Award className="h-6 w-6" />}
                  title="Ninguém esperando alta"
                  description="Quando alguém terminar o protocolo, aparece aqui."
                />
              ) : (
                dados.altas.map((c) => (
                  <Linha
                    key={c.id}
                    c={c}
                    ocupado={decidir.isPending}
                    onDecidir={(d) => decidir.mutate({ c, decisao: d })}
                  />
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Pararam no meio"
              subtitle="Quem está mais perto de terminar aparece primeiro — é quem tem mais chance de voltar."
            />
            <CardBody>
              {dados.parados.length === 0 ? (
                <EmptyState
                  icon={<RotateCcw className="h-6 w-6" />}
                  title="Ninguém parado"
                  description="Todo mundo em dia com as sessões."
                />
              ) : (
                dados.parados.map((c) => (
                  <Linha
                    key={c.id}
                    c={c}
                    ocupado={decidir.isPending}
                    onDecidir={(d) => decidir.mutate({ c, decisao: d })}
                  />
                ))
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
