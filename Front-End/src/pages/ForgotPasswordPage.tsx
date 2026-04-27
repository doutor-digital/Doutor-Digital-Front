import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { authService } from "@/services/auth";
import { toast } from "sonner";
import { AuthHeroSide } from "@/components/auth/AuthHeroSide";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      toast.success("Se houver uma conta com este email, um código foi enviado.");
      navigate(`/verify-code?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error("Não foi possível solicitar a recuperação. Tente novamente.");
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
              Recuperar senha
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Informe o email da sua conta. Enviaremos um código de 6 dígitos para você redefinir a senha.
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
                autoFocus
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full justify-center bg-[#0077CC] hover:bg-[#0088EE] text-white font-semibold shadow-[0_0_20px_rgba(0,119,204,0.35)] transition-all duration-200"
            loading={loading}
          >
            Enviar código
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
