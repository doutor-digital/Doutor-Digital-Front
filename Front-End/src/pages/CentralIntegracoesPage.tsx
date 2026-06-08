import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Plug, RefreshCw, Settings2, XCircle } from "@/components/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/Input";
import { useClinic } from "@/hooks/useClinic";
import {
  integrationsService,
  type AdAccount,
  type AdsCredentialStatus,
  type AdsProvider,
} from "@/services/integrations";
import { cn } from "@/lib/utils";

interface ProviderMeta {
  id: AdsProvider;
  name: string;
  logoUrl: string;
  desc: string;
  ring: string;
  btn: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: "meta",
    name: "Meta Ads",
    logoUrl: "/source-icons/facebook.png",
    desc: "Puxa o investimento por campanha/dia do Meta Ads (Facebook/Instagram).",
    ring: "ring-blue-500/25",
    btn: "bg-blue-500/15 text-blue-100 hover:bg-blue-500/25 ring-1 ring-inset ring-blue-400/25",
  },
  {
    id: "google",
    name: "Google Ads",
    logoUrl: "/source-icons/google.png",
    desc: "Puxa o investimento por campanha/dia do Google Ads (Search/Display).",
    ring: "ring-amber-500/25",
    btn: "bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 ring-1 ring-inset ring-amber-400/25",
  },
];

export default function CentralIntegracoesPage() {
  const { tenantId, unitId } = useClinic();
  const qc = useQueryClient();

  const accounts = useQuery({
    queryKey: ["integrations-ads", tenantId],
    queryFn: () => integrationsService.listAds(tenantId),
  });

  const byProvider = useMemo(() => {
    const m = new Map<AdsProvider, AdAccount>();
    for (const a of accounts.data?.items ?? []) m.set(a.provider, a);
    return m;
  }, [accounts.data]);

  const liveOf = useMemo(() => {
    const m = new Map<AdsProvider, boolean>();
    for (const p of accounts.data?.providers ?? []) m.set(p.provider, p.live);
    return m;
  }, [accounts.data]);

  const creds = useQuery({
    queryKey: ["integrations-ads-credentials", tenantId],
    queryFn: () => integrationsService.getCredentials(),
  });
  const credsByProvider = useMemo(() => {
    const m = new Map<AdsProvider, AdsCredentialStatus>();
    for (const c of creds.data?.items ?? []) m.set(c.provider, c);
    return m;
  }, [creds.data]);

  const [openCreds, setOpenCreds] = useState<AdsProvider | null>(null);

  // Toast pós-callback do OAuth (?connected= / ?error=) + limpa a URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${connected === "google" ? "Google Ads" : "Meta Ads"} conectado!`);
      accounts.refetch();
    }
    if (error) toast.error(`Falha ao conectar: ${error}`);
    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useMutation({
    mutationFn: (provider: AdsProvider) =>
      integrationsService.connect(provider, { clinicId: tenantId, unitId }),
    onSuccess: ({ auth_url }) => {
      window.location.href = auth_url;
    },
    onError: () => toast.error("Não foi possível iniciar a conexão."),
  });

  const sync = useMutation({
    mutationFn: (id: number) => integrationsService.sync(id),
    onSuccess: (r) => {
      toast.success(`Sincronizado (${r.rows} linhas).`);
      qc.invalidateQueries({ queryKey: ["integrations-ads", tenantId] });
    },
    onError: () => toast.error("Falha ao sincronizar."),
  });

  const disconnect = useMutation({
    mutationFn: (id: number) => integrationsService.disconnect(id),
    onSuccess: () => {
      toast.success("Desconectado.");
      qc.invalidateQueries({ queryKey: ["integrations-ads", tenantId] });
    },
    onError: () => toast.error("Falha ao desconectar."),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        badge="Mídia paga"
        title="Central de Integrações"
        description="Conecte Meta Ads e Google Ads. Nossa API puxa o investimento por campanha/dia e grava no banco — é a fonte do 'Investimento' no dashboard de Desempenho."
      />

      {accounts.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PROVIDERS.map((p) => {
            const acct = byProvider.get(p.id);
            const connected = acct?.status === "connected";
            const credStatus = credsByProvider.get(p.id);
            const live = credStatus?.live ?? liveOf.get(p.id) ?? acct?.live ?? false;
            const busy =
              (connect.isPending && connect.variables === p.id) ||
              (sync.isPending && sync.variables === acct?.id) ||
              (disconnect.isPending && disconnect.variables === acct?.id);

            return (
              <div
                key={p.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 ring-1",
                  p.ring,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                      <img src={p.logoUrl} alt={p.name} className="h-9 w-9 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-white">{p.name}</h3>
                      <span
                        className={cn(
                          "mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wider ring-1 ring-inset",
                          live
                            ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                            : "bg-amber-400/10 text-amber-300 ring-amber-400/20",
                        )}
                      >
                        {live ? "produção" : "demo (mock)"}
                      </span>
                    </div>
                  </div>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                      <CheckCircle2 className="h-3 w-3" /> Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-inset ring-white/[0.06]">
                      <XCircle className="h-3 w-3" /> Desconectado
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[12.5px] leading-relaxed text-white/50">{p.desc}</p>

                {connected && acct && (
                  <p className="mt-3 text-[11px] text-white/40">
                    {acct.name ?? acct.external_account_id ?? "conta"} ·{" "}
                    {acct.last_sync_at
                      ? `sync ${new Date(acct.last_sync_at).toLocaleString("pt-BR")}`
                      : "ainda não sincronizado"}
                    {acct.last_sync_note ? ` · ${acct.last_sync_note}` : ""}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!connected ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => connect.mutate(p.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-60",
                        p.btn,
                      )}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
                      Conectar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => acct && sync.mutate(acct.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-medium text-slate-100 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.1] disabled:opacity-60"
                      >
                        {sync.isPending && sync.variables === acct?.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sincronizar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => acct && disconnect.mutate(acct.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 px-3 py-1.5 text-[12.5px] font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
                      >
                        Desconectar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenCreds((v) => (v === p.id ? null : p.id))}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Credenciais
                  </button>
                </div>

                {openCreds === p.id && (
                  <CredentialsForm
                    provider={p.id}
                    status={credStatus}
                    onSaved={() => {
                      qc.invalidateQueries({ queryKey: ["integrations-ads-credentials", tenantId] });
                      qc.invalidateQueries({ queryKey: ["integrations-ads", tenantId] });
                      setOpenCreds(null);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-white/35">
        Em modo <span className="text-amber-300">demo</span>, o "Conectar" cria uma conta de exemplo e
        gera gasto mock por campanha/dia. Preencha as <span className="text-slate-200">Credenciais</span>{" "}
        (App ID/Secret do Meta, Client/Secret/Developer Token do Google) pra virar{" "}
        <span className="text-emerald-300">produção</span> — os mesmos botões passam a usar a API real.
      </p>
    </div>
  );
}

/** Formulário inline pra salvar as credenciais do app de um provedor. */
function CredentialsForm({
  provider,
  status,
  onSaved,
}: {
  provider: AdsProvider;
  status?: AdsCredentialStatus;
  onSaved: () => void;
}) {
  const isMeta = provider === "meta";
  const [clientId, setClientId] = useState(status?.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [devToken, setDevToken] = useState(status?.developer_token ?? "");

  const save = useMutation({
    mutationFn: () =>
      integrationsService.saveCredentials(provider, {
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
        developer_token: devToken.trim() || undefined,
      }),
    onSuccess: (r) => {
      toast.success(r.live ? "Credenciais salvas — modo produção ativo!" : "Credenciais salvas.");
      onSaved();
    },
    onError: () => toast.error("Falha ao salvar as credenciais."),
  });

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {isMeta
          ? "Meta for Developers → App ID + App Secret"
          : "Google Cloud OAuth (Client ID/Secret) + Developer Token (Google Ads)"}
        {status?.source === "config" && " · hoje via variável de ambiente"}
      </p>
      <Input
        placeholder={isMeta ? "App ID" : "OAuth Client ID"}
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
      />
      <Input
        type="password"
        placeholder={status?.has_secret ? "•••••• (deixe vazio p/ manter)" : isMeta ? "App Secret" : "Client Secret"}
        value={clientSecret}
        onChange={(e) => setClientSecret(e.target.value)}
      />
      {!isMeta && (
        <Input
          placeholder="Developer Token"
          value={devToken}
          onChange={(e) => setDevToken(e.target.value)}
        />
      )}
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[12px] font-semibold text-[#06231a] transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Salvar credenciais
      </button>
    </div>
  );
}
