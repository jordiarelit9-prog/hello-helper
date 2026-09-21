import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/panel" });
  },
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, err } = await supabase.auth.exchangeCodeForSession(
        window.location.href,
      );

      if (err || !data.session) {
        setError(
          "No se ha podido confirmar tu cuenta. Vuelve a intentarlo o entra con tu email y contraseña.",
        );
        return;
      }

      navigate({ to: "/panel", replace: true });
    })();
  }, [navigate]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="cj-card space-y-3 p-8">
          <h1 className="text-xl font-semibold">Algo no ha ido bien</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-center">
      <p className="text-sm text-muted-foreground">Confirmando tu cuenta…</p>
    </main>
  );
}
