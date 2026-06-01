import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <img
        src="/error-404.png"
        alt="Erro 404 — página não encontrada"
        className="w-[min(340px,80%)] select-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
        draggable={false}
      />
      <h1 className="mt-8 text-2xl font-bold tracking-tight text-white">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm text-white/50">
        O recurso que você tentou acessar não existe ou foi movido.
      </p>
      <Link to="/" className="mt-6">
        <Button className="bg-emerald-500 font-bold text-[#04210f] hover:bg-emerald-400">
          Voltar ao dashboard
        </Button>
      </Link>
    </div>
  );
}
