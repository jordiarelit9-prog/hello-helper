import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/celaje";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Crea tu página de citas · Celaje" },
      {
        name: "description",
        content:
          "Crea en un minuto la página de reservas de tu peluquería: servicios, horario y un enlace para compartir. 45 días de prueba.",
      },
      { property: "og:title", content: "Crea tu página de citas · Celaje" },
      {
        property: "og:description",
        content:
          "Servicios, horario y un enlace para compartir. 45 días de prueba, sin cobro automático.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Registro,
});

function Registro() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const finalSlug = slugEdited ? slugify(slug) : slugify(name);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (finalSlug.length < 3) {
      toast.error("El enlace necesita al menos 3 letras.");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña necesita al menos 6 caracteres.");
      return;
    }
    setLoading(true);

    const taken = await supabase.from("salons").select("slug").eq("slug", finalSlug).maybeSingle();
    if (taken.data) {
      setLoading(false);
      toast.error("Ese enlace ya está en uso. Prueba otro.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { salon_name: name.trim(), salon_slug: finalSlug, phone: phone.trim() },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "Ya existe una cuenta con ese email."
          : "No hemos podido crear la cuenta.",
      );
      return;
    }
    if (data.session) {
      navigate({ to: "/panel" });
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <div className="cj-card p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">Confirma tu email</h1>
          <p className="mt-3 text-muted-foreground">
            Te hemos enviado un correo a <strong>{email}</strong>. Pulsa el enlace y tu página
            quedará lista con 45 días de prueba.
          </p>
          <Link to="/" className="mt-6 inline-block text-primary hover:underline">
            Volver a entrar
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-14">
      <span className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">
        CREA TU PÁGINA
      </span>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em]">
        Tu peluquería, con <em className="font-semibold not-italic text-primary">su sitio.</em>
      </h1>
      <p className="mt-3 text-muted-foreground">
        45 días de prueba. Sin cobro automático y sin tarjeta.
      </p>

      <form onSubmit={handleSubmit} className="cj-card mt-8 space-y-5 p-7">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del negocio</Label>
          <Input
            id="name"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Estudio Olivo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Tu enlace</Label>
          <Input
            id="slug"
            value={slugEdited ? slug : finalSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
            placeholder="estudio-olivo"
          />
          <p className="text-xs text-muted-foreground">
            Tus clientes entrarán en /reservar/{finalSlug || "tu-enlace"}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={loading}>
          {loading ? "Creando…" : "Crear mi página"}
        </Button>
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
