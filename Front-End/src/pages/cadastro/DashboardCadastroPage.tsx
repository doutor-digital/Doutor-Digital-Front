import { Suspense } from "react";
import { DashboardContent } from "@/components/cadastro/dashboard/dashboard-content";

export default function DashboardCadastroPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
