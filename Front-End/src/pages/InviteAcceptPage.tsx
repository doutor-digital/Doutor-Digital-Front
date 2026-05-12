import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Building2, AlertTriangle } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { invitationsService, type InvitationInfo } from "@/services/invitations";
import { GoogleSignInButton } from "@/components/google/GoogleSignInButton";
import { toast } from "sonner";

export default function InviteAcceptPage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { setContext } = useClinic();

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invitationsService
      .getInfo(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err?.response?.data?.message ||
            "Convite não encontrado, expirado ou já aceito.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onCredential = useCallback(
    async (idToken: string) => {
      setAccepting(true);
      try {
        const data = await invitationsService.accept(token, idToken);
        login(
          {
            name: data.userName,
            email: data.email,
            role: data.role,
            photoUrl: data.photoUrl,
          },
          data.accessToken,
        );
        setContext(data.selectedUnit.clinicId, data.selectedUnit.id);
        toast.success("Convite aceito! Bem-vindo(a).");
        navigate("/");
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Falha ao aceitar convite";
        toast.error(msg);
      } finally {
        setAccepting(false);
      }
    },
    [token, login, setContext, navigate],
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020B18] p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#0a0a0d] p-8 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.06] pb-5 mb-6">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
            <img
              src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
              alt="Doutor Digital"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <div className="text-[15px] font-bold text-white">
              Doutor Digital
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              Convite de acesso
            </div>
          </div>
        </div>

        {loadError && (
          <div className="flex items-start gap-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Não foi possível abrir o convite</p>
              <p className="mt-1 text-rose-200/80">{loadError}</p>
            </div>
          </div>
        )}

        {!info && !loadError && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando convite…
          </div>
        )}

        {info && (
          <>
            <div className="space-y-4 mb-6">
              <p className="text-[14px] text-slate-300">
                Você foi convidado(a) para acessar o painel.
              </p>
              <dl className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3 rounded-md bg-white/[0.03] border border-white/[0.06] p-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-widest text-slate-500">
                      Email
                    </dt>
                    <dd className="text-[13px] text-slate-100 truncate">
                      {info.email}
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-white/[0.03] border border-white/[0.06] p-3">
                  <Building2 className="h-5 w-5 text-sky-400" />
                  <div className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-widest text-slate-500">
                      Unidade
                    </dt>
                    <dd className="text-[13px] text-slate-100 truncate">
                      {info.unitName || `#${"-"}`} ·{" "}
                      <span className="text-slate-400">{info.role}</span>
                    </dd>
                  </div>
                </div>
              </dl>
              <p className="text-[12px] text-slate-500">
                Use a conta Google deste email para aceitar. O convite expira em{" "}
                {new Date(info.expiresAt).toLocaleString()}.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              {accepting ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Validando…
                </div>
              ) : (
                <GoogleSignInButton
                  onCredential={onCredential}
                  text="continue_with"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
