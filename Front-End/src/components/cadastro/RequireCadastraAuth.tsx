import { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/cadastra/auth-context";

export function RequireCadastraAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0d] text-slate-300">
        <span className="text-sm tracking-widest uppercase">Carregando…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/cadastro/login" state={{ from: location }} replace />;
  }

  return children;
}
