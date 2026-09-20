import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Celaje · Entra a tu panel de citas" },
      {
        name: "description",
        content:
          "Entra a tu agenda de Celaje: gestiona solicitudes de cita, tu calendario y la página pública de tu peluquería.",
      },
      { property: "og:title", content: "Celaje · Entra a tu panel de citas" },
      {
        property: "og:description",
        content:
          "Tu página con tu marca y las citas en su sitio. Entra a tu panel de Celaje.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Entrada,
});

function Entrada() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/panel", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "Email o contraseña incorrectos."
          : error.message.includes("confirm")
            ? "Confirma tu cuenta desde el email que te enviamos."
            : "No hemos podido entrar. Inténtalo otra vez.",
      );
      return;
    }
    navigate({ to: "/panel" });
  }

  async function handleForgot() {
    if (!email) {
      toast.error("Escribe tu email y vuelve a pulsar.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error("No hemos podido enviar el email.");
    else toast.success("Te hemos enviado un email para cambiar la contraseña.");
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-2 lg:py-20">
      <section>
        <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
          TU ESPACIO · CELAJE
        </span>
        <h1 className="mt-4 text-5xl font-bold tracking-[-0.045em] sm:text-6xl">
          Tu día, con{" "}
          <em className="font-semibold not-italic text-primary">otra tranquilidad.</em>
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">
          Una página con tu marca. Las citas, en su sitio. Y tú, a lo que mejor haces.
        </p>

        <div className="cj-card mt-10 max-w-sm p-6">
          <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">
            UN EJEMPLO DE TU AGENDA
          </span>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-surface-row px-4 py-3">
              <span className="font-medium">10:00 · Corte</span>
              <span className="rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok">
                Confirmada ✓
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface-row px-4 py-3">
              <span className="font-medium">11:00 · Corte y barba</span>
              <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">
                Pendiente
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="cj-card p-7 sm:p-9">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Entrar a tu panel</h2>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm"
                aria-label="Ver contraseña"
              >
                👁️
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleForgot}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ¿Has olvidado tu contraseña?
          </button>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          ¿No tienes página todavía?{" "}
          <Link to="/registro" className="text-primary underline-offset-4 hover:underline">
            Créala aquí
          </Link>
        </p>
      </section>
    </main>
  );
}
