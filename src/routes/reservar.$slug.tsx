import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getPublicSalon } from "@/lib/salon.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DIAS,
  availableSlots,
  buildMonthMatrix,
  formatDateLongEs,
  formatMonthYearEs,
  money,
  planNotice,
  todayStr,
  type Busy,
  type Service,
  type WorkingHours,
} from "@/lib/celaje";

export const Route = createFileRoute("/reservar/$slug")({
  loader: ({ params }) => getPublicSalon({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const salon = loaderData?.salon;
    const title = salon ? `Pide cita en ${salon.name} · Celaje` : "Página no disponible · Celaje";
    const description = salon
      ? salon.description?.trim() ||
        `Reserva tu cita en ${salon.name} en menos de un minuto: elige servicio, día y hora.`
      : "Esta página de reservas no existe o ya no está disponible.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(salon ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: () => (
    <Aviso titulo="No hemos podido cargar la página" texto="Vuelve a intentarlo en un momento." />
  ),
  notFoundComponent: () => (
    <Aviso titulo="Esta página no existe" texto="Comprueba el enlace con tu peluquería." />
  ),
  component: Reservar,
});

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div className="cj-card max-w-sm space-y-2 p-8">
        <h1 className="text-lg font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}

function Reservar() {
  const { salon } = Route.useLoaderData();
  const hoy = todayStr();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = hoy.split("-").map(Number);
    return { year: y!, month: (m ?? 1) - 1 };
  });
  const [date, setDate] = useState(hoy);
  const [serviceId, setServiceId] = useState<string>("");
  const [time, setTime] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ time: string; date: string } | null>(null);

  if (!salon) {
    return <Aviso titulo="Esta página no existe" texto="Comprueba el enlace con tu peluquería." />;
  }

  const services = ((salon.services as Service[]) ?? []).filter((s) => s?.name);
  const service = services.find((s) => s.id === serviceId) ?? services[0];
  const notice = planNotice(salon);
  const cerrado = notice?.blocked ?? false;

  const busyQuery = useQuery({
    queryKey: ["busy", salon.slug, date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("busy_slots", { _slug: salon.slug, _date: date });
      if (error) throw error;
      return (data ?? []) as Busy[];
    },
  });

  const slots = useMemo(
    () =>
      availableSlots(
        (salon.working_hours as WorkingHours) ?? {},
        date,
        service?.durationMin ?? 30,
        busyQuery.data ?? [],
      ),
    [salon.working_hours, date, service?.durationMin, busyQuery.data],
  );

  const cells = useMemo(() => buildMonthMatrix(cursor.year, cursor.month), [cursor]);

  function move(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  async function reservar() {
    if (!service) return;
    if (!time) return toast.error("Elige una hora.");
    if (form.name.trim().length < 2) return toast.error("Escribe tu nombre.");
    if (form.phone.trim().length < 6) return toast.error("Escribe un teléfono de contacto.");
    setSending(true);
    const { error } = await supabase.rpc("request_appointment", {
      _slug: salon.slug,
      _service_id: service.id,
      _date: date,
      _start: time,
      _client_name: form.name,
      _client_phone: form.phone,
      _client_email: form.email,
      _client_note: form.note,
    });
    setSending(false);
    if (error) {
      const map: Record<string, string> = {
        SLOT_TAKEN: "Justo han cogido esa hora. Elige otra, por favor.",
        SALON_CLOSED: "Esta página no acepta reservas ahora mismo.",
        PAST_DATE: "Esa fecha ya ha pasado.",
        BAD_NAME: "Escribe tu nombre.",
        BAD_PHONE: "Escribe un teléfono válido.",
        BAD_SERVICE: "Ese servicio ya no está disponible.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      toast.error(key ? map[key]! : "No hemos podido enviar tu solicitud.");
      busyQuery.refetch();
      return;
    }
    setDone({ time, date });
    setTime("");
    setForm({ name: "", phone: "", email: "", note: "" });
    busyQuery.refetch();
  }

  return (
    <div className={`theme-${salon.theme_color} min-h-screen px-4 pb-16 pt-8`}>
      <div className="mx-auto max-w-lg space-y-5">
        <header className="cj-card space-y-2 p-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{salon.name}</h1>
          {salon.description ? (
            <p className="text-sm text-muted-foreground">{salon.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {[salon.address, salon.phone].filter(Boolean).join(" · ")}
          </p>
        </header>

        {cerrado && (
          <div className="rounded-3xl border border-destructive/40 bg-destructive/15 px-5 py-4 text-sm">
            Ahora mismo esta peluquería no acepta reservas online. Llámales si necesitas cita.
          </div>
        )}

        {done && (
          <div className="rounded-3xl border border-[var(--ok)]/40 bg-[var(--ok-soft)] px-5 py-4">
            <p className="text-sm font-semibold">Solicitud enviada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Has pedido el {formatDateLongEs(done.date).toLowerCase()} a las {done.time}. La
              peluquería te confirmará la cita en breve.
            </p>
          </div>
        )}

        <section className="cj-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">1. Elige servicio</h2>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay servicios publicados.</p>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setTime("");
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    s.id === service?.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-[var(--surface-row)]"
                  }`}
                >
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs opacity-80">
                    {s.durationMin} min {s.price ? `· ${money(s.price)}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="cj-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">2. Elige día</h2>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => move(-1)}>
              ‹
            </Button>
            <p className="text-sm">{formatMonthYearEs(cursor.year, cursor.month)}</p>
            <Button variant="ghost" size="sm" onClick={() => move(1)}>
              ›
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {DIAS.map((d) => (
              <span key={d.key}>{d.short}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <span key={`e-${i}`} />;
              const past = day < hoy;
              return (
                <button
                  key={day}
                  disabled={past}
                  onClick={() => {
                    setDate(day);
                    setTime("");
                  }}
                  className={`aspect-square rounded-2xl text-sm transition ${
                    day === date
                      ? "bg-primary font-semibold text-primary-foreground"
                      : past
                        ? "text-muted-foreground/40"
                        : "hover:bg-[var(--surface-row)]"
                  }`}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>
        </section>

        <section className="cj-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">3. Elige hora</h2>
          <p className="text-xs text-muted-foreground">{formatDateLongEs(date)}</p>
          {busyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Buscando huecos…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ese día no quedan huecos. Prueba con otro día.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setTime(s)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    s === time ? "bg-primary text-primary-foreground" : "bg-[var(--surface-row)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="cj-card space-y-3 p-5">
          <h2 className="text-sm font-semibold">4. Tus datos</h2>
          <div className="space-y-2">
            <Label htmlFor="r-nombre">Nombre</Label>
            <Input
              id="r-nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-tel">Teléfono</Label>
            <Input
              id="r-tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-email">Email (opcional)</Label>
            <Input
              id="r-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-nota">¿Algo que debamos saber? (opcional)</Label>
            <Textarea
              id="r-nota"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <Button
            className="w-full"
            disabled={cerrado || sending || !service || !time}
            onClick={reservar}
          >
            {sending ? "Enviando…" : "Pedir cita"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            La cita queda pendiente hasta que la peluquería la confirme.
          </p>
        </section>
      </div>
    </div>
  );
}
