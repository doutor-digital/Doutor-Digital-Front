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
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 text-white"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a3565 0%, #0a1a36 45%, #050d22 100%)",
        fontFamily: "'PT Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Padrão pontilhado sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      {/* Brilhos da marca */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="mb-7 flex justify-center">
          <img
            src="/logo-dd.png"
            alt="Doutor Digital Dash"
            className="w-[240px] max-w-[72%] select-none drop-shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
            draggable={false}
          />
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl sm:p-8">
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
  );
}
