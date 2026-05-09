import { useParams } from "react-router-dom";
import { AcceptInviteView } from "@/components/cadastro/invite/accept-invite-view";

export default function AceitarConvitePage() {
  const { token } = useParams<{ token: string }>();
  if (!token) return <div className="p-6 text-slate-300">Token de convite ausente.</div>;
  return <AcceptInviteView token={token} />;
}
