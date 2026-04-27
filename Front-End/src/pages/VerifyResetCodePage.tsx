import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { AuthHeroSide } from "@/components/auth/AuthHeroSide";

export default function VerifyResetCodePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || code.length !== 6) return;

    setLoading(true);
    try {
      await authService.verifyResetCode({ email, code });
      toast.success("Código válido. Defina sua nova senha.");
      navigate(
        `/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`
      );
    } catch {
      toast.error("Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error("Informe o email primeiro.");
      return;
    }
    setResending(true);
    try {
      await authService.forgotPassword({ email });
      toast.success("Novo código enviado, se o email estiver cadastrado.");
    } catch {
      toast.error("Não foi possível reenviar o código.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <AuthHeroSide />

      <div className="relative flex items-center justify-center p-6 bg-[#020B18]">
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0077CC]/8 blur-3xl" />

        <form onSubmit={onSubmit} className="relative w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Verificar código
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Digite o código de 6 dígitos enviado para o seu email.
            </p>
          </div>

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
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Código
            </label>
            <div className="mt-1.5">
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                icon={<KeyRound className="h-4 w-4" />}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="tracking-[0.5em] text-center font-semibold"
                autoFocus
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full justify-center bg-[#0077CC] hover:bg-[#0088EE] text-white font-semibold shadow-[0_0_20px_rgba(0,119,204,0.35)] transition-all duration-200"
            loading={loading}
            disabled={code.length !== 6}
          >
            Verificar código
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50 transition"
          >
            {resending ? "Reenviando..." : "Não recebeu? Reenviar código"}
          </button>

          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para o login
          </Link>
        </form>
      </div>
    </div>
  );
}
