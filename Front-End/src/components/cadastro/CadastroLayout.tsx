import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/contexts/cadastra/auth-context";
import { EmpresaProvider } from "@/contexts/cadastra/empresa-context";

/**
 * Layout pai de todas as rotas /cadastro/* que requerem auth do cadastra.ai.
 * Os providers ficam aqui (em vez de dentro de cada page como no Next.js)
 * para que o estado de auth/empresa persista entre navegações dentro do
 * subdomínio /cadastro/*.
 */
export default function CadastroLayout() {
  return (
    <AuthProvider>
      <EmpresaProvider>
        <Outlet />
      </EmpresaProvider>
    </AuthProvider>
  );
}
