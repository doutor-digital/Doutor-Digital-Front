import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { AuthHeroSide } from "@/components/auth/AuthHeroSide";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const code = params.get("code") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const missingContext = !email || !code;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (missingContext) {
      toast.error("Sessão de recuperação inválida. Refaça o processo.");
      navigate("/forgot-password");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ email, code, newPassword });
      toast.success("Senha redefinida com sucesso. Faça login novamente.");
      navigate("/login");
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Não foi possível redefinir a senha.";
      toast.error(msg);
    } finally {
      setLoading(false);
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
              Nova senha
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Defina uma nova senha de pelo menos 8 caracteres para a conta{" "}
              <span className="text-slate-300 font-medium">{email || "—"}</span>.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Nova senha
            </label>
            <div className="mt-1.5">
              <Input
                type="password"
                icon={<Lock className="h-4 w-4" />}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              Confirmar senha
            </label>
            <div className="mt-1.5">
              <Input
                type="password"
                icon={<Lock className="h-4 w-4" />}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full justify-center bg-[#0077CC] hover:bg-[#0088EE] text-white font-semibold shadow-[0_0_20px_rgba(0,119,204,0.35)] transition-all duration-200"
            loading={loading}
            disabled={missingContext}
          >
            Redefinir senha
          </Button>

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
