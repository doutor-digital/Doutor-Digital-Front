import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/cadastra/auth-context";

/**
 * Layout para rotas públicas /cadastro/login, /cadastro/signup, /cadastro/aceitar-convite/:token.
 * Mesmo sendo públicas, usam o AuthProvider para que login/registro consigam
 * gravar token e usuário no contexto antes de redirecionar.
 */
export default function CadastroPublicLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
