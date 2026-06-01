import { FormEvent, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { toast } from "sonner";
import { authService } from "@/services/auth";
import { GoogleSignInButton } from "@/components/google/GoogleSignInButton";

export default function LoginPage() {
  const { login } = useAuth();
  const { setContext } = useClinic();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const data = await authService.login({ email, password });
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
      toast.success("Login realizado com sucesso!");
      navigate("/select-unit");
    } catch {
      toast.error("Email ou senha inválidos");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setLoading(true);
      try {
        const data = await authService.googleLogin(idToken);
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
        toast.success("Login realizado com sucesso!");
        navigate("/select-unit");
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Falha ao entrar com Google";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [login, setContext, navigate],
  );

  return (
    <>
      {/* ══════════ MOBILE (novo visual dark com a logo) ══════════ */}
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 text-white lg:hidden"
        style={{
          background:
            "radial-gradient(ellipse at top, #1a3565 0%, #0a1a36 45%, #050d22 100%)",
          fontFamily: "'PT Sans', ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative w-full max-w-md animate-fade-in">
          <div className="mb-7 flex justify-center">
            <img
              src="/logo-dd.png"
              alt="Doutor Digital Dash"
              className="w-[240px] max-w-[72%] select-none drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              draggable={false}
            />
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl">
            <div className="text-center">
              <h1 className="text-[22px] font-bold tracking-tight">Bem-vindo de volta</h1>
              <p className="mt-1 text-sm text-white/50">
                Acesse o painel com suas credenciais
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  E-mail
                </label>
                <div className="mt-1.5">
                  <Input
                    type="email"
                    icon={<Mail className="h-4 w-4" />}
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                    Senha
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-medium text-emerald-300 transition hover:text-emerald-200"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="mt-1.5">
                  <Input
                    type="password"
                    icon={<Lock className="h-4 w-4" />}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full justify-center bg-emerald-500 font-bold text-[#04210f] shadow-[0_0_24px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400"
                loading={loading}
              >
                Entrar no painel
              </Button>

              <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/40">
                <div className="h-px flex-1 bg-white/10" />
                ou
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex justify-center">
                <GoogleSignInButton onCredential={handleGoogleCredential} />
              </div>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-white/30">
            © {new Date().getFullYear()} Doutor Digital · Converse com seus dados
          </p>
        </div>
      </div>

      {/* ══════════ DESKTOP (layout original — inalterado) ══════════ */}
      <div className="hidden min-h-screen bg-white lg:grid lg:grid-cols-2">
        {/* LADO ESQUERDO — Hero com imagem */}
        <div className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <img
            src="https://i.postimg.cc/DwB0GsB4/Chat-GPT-Image-23-de-abr-de-2026-15-36-56.png"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#020B18]/95 via-[#052040]/80 to-[#020B18]/90" />
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#0077CC]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#00AAFF]/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
              <img
                src="https://i.postimg.cc/xjx4m8p5/Copia-de-logo-cor-original.png"
                alt="Doutor Digital"
                className="h-full w-full object-cover object-center"
              />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-white">
              Doutor Digital
            </span>
          </div>

          <div className="relative space-y-5">
            <h2 className="text-3xl font-bold leading-snug tracking-tight text-white">
              Performance real de cada lead,
              <br />
              <span className="text-[#4DB8FF]">da origem ao fechamento.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              Centralize webhooks do Kommo e da Meta, acompanhe a evolução por
              etapa e descubra quais campanhas realmente convertem.
            </p>
            <ul className="space-y-2.5">
              {[
                "Funil de conversão consolidado",
                "Métricas ao vivo dos atendentes",
                "Alertas de SLA em tempo real",
                "Relatórios PDF automatizados",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0077CC]/30 ring-1 ring-[#0077CC]/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4DB8FF]" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative text-xs text-slate-600">
            © {new Date().getFullYear()} Doutor Digital — Todos os direitos reservados
          </div>
        </div>

        {/* LADO DIREITO — Formulário */}
        <div className="relative flex items-center justify-center bg-[#020B18] p-6">
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0077CC]/8 blur-3xl" />

          <form onSubmit={onSubmit} className="relative w-full max-w-sm space-y-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Entrar</h1>
              <p className="mt-1 text-sm text-slate-500">
                Acesse o painel com suas credenciais.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  E-mail
                </label>
                <div className="mt-1.5">
                  <Input
                    type="email"
                    icon={<Mail className="h-4 w-4" />}
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Senha
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-[11px] font-medium text-[#4DB8FF] transition hover:text-[#7CC9FF]"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="mt-1.5">
                  <Input
                    type="password"
                    icon={<Lock className="h-4 w-4" />}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full justify-center bg-[#0077CC] font-semibold text-white shadow-[0_0_20px_rgba(0,119,204,0.35)] transition-all duration-200 hover:bg-[#0088EE]"
              loading={loading}
            >
              Entrar no painel
            </Button>

            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-600">
              <div className="h-px flex-1 bg-white/[0.06]" />
              ou
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>

            <div className="flex justify-center">
              <GoogleSignInButton onCredential={handleGoogleCredential} />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
