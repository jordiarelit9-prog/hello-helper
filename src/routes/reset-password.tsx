import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Cambiar contraseña · Celaje" },
      { name: "description", content: "Elige una contraseña nueva para tu panel de Celaje." },
      { property: "og:title", content: "Cambiar contraseña · Celaje" },
      { property: "og:description", content: "Elige una contraseña nueva para tu panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña necesita al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("No hemos podido cambiarla. Pide un enlace nuevo.");
      return;
    }
    toast.success("Contraseña actualizada.");
    navigate({ to: "/panel" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <form onSubmit={handleSubmit} className="cj-card space-y-5 p-8">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Nueva contraseña</h1>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={loading}>
          {loading ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </main>
  );
}
