import { useEffect, useRef } from "react";

// `window.google` já é declarado em `@/hooks/cadastra/use-google-auth.ts`
// (mesmo objeto do Google Identity Services). Não redeclaramos aqui.

interface Props {
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  width?: number;
}

export function GoogleSignInButton({
  onCredential,
  text = "signin_with",
  theme = "outline",
  size = "large",
  width = 320,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (initRef.current) return;
    if (!clientId) return;
    if (!containerRef.current) return;

    let cancelled = false;
    let retries = 0;

    function tryInit() {
      if (cancelled) return;
      const g = window.google?.accounts?.id;
      if (!g) {
        if (retries++ < 50) setTimeout(tryInit, 100);
        return;
      }

      g.initialize({
        client_id: clientId!,
        callback: (response: { credential: string }) => {
          const cred = response?.credential;
          if (cred) onCredential(cred);
        },
        ux_mode: "popup",
      });

      g.renderButton(containerRef.current!, {
        theme,
        size,
        text,
        width,
        shape: "pill",
        logo_alignment: "left",
      } as any);

      initRef.current = true;
    }

    tryInit();

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential, text, theme, size, width]);

  if (!clientId) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-200">
        Configure <code>VITE_GOOGLE_CLIENT_ID</code> no <code>.env</code> para
        habilitar o login com Google.
      </div>
    );
  }

  return <div ref={containerRef} style={{ minHeight: 40 }} />;
}
