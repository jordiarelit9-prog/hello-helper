import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSalon, type SalonRow } from "@/hooks/useSalon";
import { PlanBanner } from "@/components/celaje/PlanBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DIAS,
  THEME_COLORS,
  availableSlots,
  buildMonthMatrix,
  formatDateLongEs,
  formatMonthYearEs,
  money,
  planNotice,
  slugify,
  todayStr,
  type Service,
  type WorkingHours,
} from "@/lib/celaje";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Tu panel · Celaje" },
      {
        name: "description",
        content:
          "Gestiona las solicitudes de cita, tu calendario, tus servicios y tu página pública desde el panel de Celaje.",
      },
      { property: "og:title", content: "Tu panel · Celaje" },
      {
        property: "og:description",
        content: "Solicitudes, calendario y ajustes de tu peluquería en un solo sitio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Panel,
});

type Appointment = {
  id: string;
  salon_id: string;
  service_name: string;
  duration_min: number;
  price: number | null;
  date: string;
  start_time: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  client_note: string | null;
  owner_note: string | null;
  source: string;
  status: string;
  created_at: string;
};

const TABS = [
  { id: "solicitudes", label: "Solicitudes" },
  { id: "calendario", label: "Calendario" },
  { id: "negocio", label: "Negocio" },
  { id: "ajustes", label: "Configuración" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Confirmada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
  done: "Atendida",
  noshow: "No vino",
};

function Panel() {
  const navigate = useNavigate();
  const { data: salon, isLoading, error } = useSalon();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("solicitudes");

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando tu panel…</div>;
  }
  if (error || !salon) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        No hemos podido cargar tu negocio. Recarga la página.
      </div>
    );
  }

  const notice = planNotice(salon);

  return (
    <div className={`theme-${salon.theme_color} min-h-screen pb-16`}>
      <header className="cj-glass sticky top-0 z-20 border-b px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{salon.name}</p>
            <p className="truncate text-xs text-muted-foreground">celaje.app/reservar/{salon.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/reservar/$slug" params={{ slug: salon.slug }}>
                Ver mi página
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 pt-5">
        <PlanBanner notice={notice} />

        <nav className="cj-card flex gap-1 overflow-x-auto p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "solicitudes" && <Solicitudes salon={salon} />}
        {tab === "calendario" && <Calendario salon={salon} />}
        {tab === "negocio" && <Negocio salon={salon} />}
        {tab === "ajustes" && <Ajustes salon={salon} />}
      </main>
    </div>
  );
}

function useAppointments(salonId: string) {
  return useQuery({
    queryKey: ["appointments", salonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("salon_id", salonId)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });
}

function useStatusChange(salonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments", salonId] }),
    onError: () => toast.error("No se ha podido actualizar la cita."),
  });
}

function CitaCard({
  cita,
  onStatus,
}: {
  cita: Appointment;
  onStatus: (status: string) => void;
}) {
  return (
    <div className="cj-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{cita.client_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateLongEs(cita.date)} · {cita.start_time.slice(0, 5)}
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-row)] px-3 py-1 text-xs text-muted-foreground">
          {STATUS_LABEL[cita.status] ?? cita.status}
        </span>
      </div>
      <p className="text-sm">
        {cita.service_name} · {cita.duration_min} min {cita.price ? `· ${money(cita.price)}` : ""}
      </p>
      <p className="text-sm text-muted-foreground">
        <a className="underline" href={`tel:${cita.client_phone}`}>
          {cita.client_phone}
        </a>
        {cita.client_email ? ` · ${cita.client_email}` : ""}
      </p>
      {cita.client_note ? (
        <p className="rounded-2xl bg-[var(--surface-row)] px-3 py-2 text-sm">{cita.client_note}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {cita.status === "pending" && (
          <>
            <Button size="sm" onClick={() => onStatus("accepted")}>
              Confirmar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onStatus("rejected")}>
              Rechazar
            </Button>
          </>
        )}
        {cita.status === "accepted" && (
          <>
            <Button size="sm" onClick={() => onStatus("done")}>
              Atendida
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onStatus("noshow")}>
              No vino
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onStatus("cancelled")}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Solicitudes({ salon }: { salon: SalonRow }) {
  const { data: citas = [], isLoading } = useAppointments(salon.id);
  const change = useStatusChange(salon.id);
  const hoy = todayStr();

  const pendientes = citas.filter((c) => c.status === "pending" && c.date >= hoy);
  const proximas = citas.filter((c) => c.status === "accepted" && c.date >= hoy);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando citas…</p>;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Pendientes de responder ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <p className="cj-card p-5 text-sm text-muted-foreground">
            No tienes solicitudes nuevas. Cuando alguien reserve desde tu página, aparecerá aquí.
          </p>
        ) : (
          pendientes.map((c) => (
            <CitaCard
              key={c.id}
              cita={c}
              onStatus={(status) => change.mutate({ id: c.id, status })}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Próximas confirmadas ({proximas.length})
        </h2>
        {proximas.length === 0 ? (
          <p className="cj-card p-5 text-sm text-muted-foreground">Todavía no hay citas confirmadas.</p>
        ) : (
          proximas.map((c) => (
            <CitaCard
              key={c.id}
              cita={c}
              onStatus={(status) => change.mutate({ id: c.id, status })}
            />
          ))
        )}
      </section>
    </div>
  );
}

function Calendario({ salon }: { salon: SalonRow }) {
  const { data: citas = [] } = useAppointments(salon.id);
  const change = useStatusChange(salon.id);
  const hoy = todayStr();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = hoy.split("-").map(Number);
    return { year: y!, month: (m ?? 1) - 1 };
  });
  const [selected, setSelected] = useState(hoy);
  const [nuevo, setNuevo] = useState(false);

  const cells = useMemo(() => buildMonthMatrix(cursor.year, cursor.month), [cursor]);
  const activas = citas.filter((c) => ["pending", "accepted", "done"].includes(c.status));
  const delDia = activas.filter((c) => c.date === selected);

  function move(delta: number) {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: date.getFullYear(), month: date.getMonth() });
  }

  return (
    <div className="space-y-5">
      <div className="cj-card p-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => move(-1)}>
            ‹
          </Button>
          <p className="text-sm font-semibold">{formatMonthYearEs(cursor.year, cursor.month)}</p>
          <Button variant="ghost" size="sm" onClick={() => move(1)}>
            ›
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {DIAS.map((d) => (
            <span key={d.key}>{d.short}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={`empty-${i}`} />;
            const count = activas.filter((c) => c.date === day).length;
            const isSel = day === selected;
            return (
              <button
                key={day}
                onClick={() => setSelected(day)}
                className={`relative aspect-square rounded-2xl text-sm transition ${
                  isSel
                    ? "bg-primary font-semibold text-primary-foreground"
                    : day === hoy
                      ? "bg-[var(--surface-row)] font-semibold"
                      : "hover:bg-[var(--surface-row)]"
                }`}
              >
                {Number(day.slice(-2))}
                {count > 0 && (
                  <span
                    className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                      isSel ? "bg-primary-foreground" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{formatDateLongEs(selected)}</h2>
        <Button size="sm" variant="secondary" onClick={() => setNuevo((v) => !v)}>
          {nuevo ? "Cerrar" : "Añadir cita"}
        </Button>
      </div>

      {nuevo && (
        <NuevaCita salon={salon} date={selected} busy={delDia} onDone={() => setNuevo(false)} />
      )}

      {delDia.length === 0 ? (
        <p className="cj-card p-5 text-sm text-muted-foreground">Ese día no tienes citas.</p>
      ) : (
        <div className="space-y-3">
          {delDia.map((c) => (
            <CitaCard
              key={c.id}
              cita={c}
              onStatus={(status) => change.mutate({ id: c.id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NuevaCita({
  salon,
  date,
  busy,
  onDone,
}: {
  salon: SalonRow;
  date: string;
  busy: Appointment[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const services = (salon.services as Service[]) ?? [];
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const service = services.find((s) => s.id === serviceId) ?? services[0];

  const slots = useMemo(
    () =>
      availableSlots(
        (salon.working_hours as WorkingHours) ?? {},
        date,
        service?.durationMin ?? 30,
        busy.map((b) => ({ start_time: b.start_time, duration_min: b.duration_min })),
      ),
    [salon.working_hours, date, service?.durationMin, busy],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!service) throw new Error("Añade un servicio primero.");
      if (!time) throw new Error("Elige una hora.");
      if (name.trim().length < 2) throw new Error("Escribe el nombre del cliente.");
      const { error } = await supabase.from("appointments").insert({
        salon_id: salon.id,
        service_id: service.id,
        service_name: service.name,
        duration_min: service.durationMin,
        price: service.price,
        date,
        start_time: time,
        client_name: name.trim(),
        client_phone: phone.trim() || "—",
        status: "accepted",
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", salon.id] });
      toast.success("Cita añadida.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "No se ha podido crear la cita."),
  });

  return (
    <div className="cj-card space-y-4 p-4">
      <div className="space-y-2">
        <Label>Servicio</Label>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setTime("");
              }}
              className={`rounded-full px-3 py-1.5 text-sm ${
                s.id === serviceId
                  ? "bg-primary text-primary-foreground"
                  : "bg-[var(--surface-row)] text-muted-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Hora</Label>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quedan huecos libres ese día.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setTime(s)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  s === time
                    ? "bg-primary text-primary-foreground"
                    : "bg-[var(--surface-row)] text-muted-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nc-nombre">Nombre</Label>
          <Input id="nc-nombre" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nc-tel">Teléfono</Label>
          <Input id="nc-tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <Button onClick={() => create.mutate()} disabled={create.isPending}>
        Guardar cita
      </Button>
    </div>
  );
}

function Negocio({ salon }: { salon: SalonRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: salon.name,
    slug: salon.slug,
    description: salon.description ?? "",
    address: salon.address ?? "",
    phone: salon.phone ?? "",
    theme_color: salon.theme_color,
  });
  const [services, setServices] = useState<Service[]>((salon.services as Service[]) ?? []);
  const [hours, setHours] = useState<WorkingHours>((salon.working_hours as WorkingHours) ?? {});

  const save = useMutation({
    mutationFn: async () => {
      const slug = slugify(form.slug);
      if (slug.length < 3) throw new Error("El enlace necesita al menos 3 letras.");
      if (form.name.trim().length < 2) throw new Error("Escribe el nombre de tu negocio.");
      const { error } = await supabase
        .from("salons")
        .update({
          name: form.name.trim(),
          slug,
          description: form.description,
          address: form.address,
          phone: form.phone,
          theme_color: form.theme_color,
          services,
          working_hours: hours,
        })
        .eq("id", salon.id);
      if (error) {
        throw new Error(
          error.code === "23505" ? "Ese enlace ya lo usa otro negocio." : "No se han podido guardar los cambios.",
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salon"] });
      toast.success("Cambios guardados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setRange(day: string, index: number, key: "from" | "to", value: string) {
    setHours((prev) => {
      const list = [...(prev[day] ?? [])];
      list[index] = { ...list[index]!, [key]: value };
      return { ...prev, [day]: list };
    });
  }

  return (
    <div className="space-y-5">
      <section className="cj-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Datos de tu página</h2>
        <div className="space-y-2">
          <Label htmlFor="n-name">Nombre</Label>
          <Input
            id="n-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="n-slug">Enlace de tu página</Label>
          <Input
            id="n-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">celaje.app/reservar/{slugify(form.slug)}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="n-desc">Descripción</Label>
          <Textarea
            id="n-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="n-dir">Dirección</Label>
            <Input
              id="n-dir"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="n-tel">Teléfono</Label>
            <Input
              id="n-tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Color de tu marca</Label>
          <div className="flex flex-wrap gap-3">
            {THEME_COLORS.map((c) => (
              <button
                key={c.id}
                aria-label={c.label}
                onClick={() => setForm({ ...form, theme_color: c.id })}
                style={{ background: c.css }}
                className={`h-10 w-10 rounded-full transition ${
                  form.theme_color === c.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="cj-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Servicios</h2>
        {services.map((s, i) => (
          <div key={s.id} className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_auto]">
            <Input
              value={s.name}
              placeholder="Nombre"
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...s, name: e.target.value };
                setServices(next);
              }}
            />
            <Input
              type="number"
              value={s.durationMin}
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...s, durationMin: Number(e.target.value) || 30 };
                setServices(next);
              }}
            />
            <Input
              type="number"
              value={s.price ?? ""}
              placeholder="€"
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...s, price: e.target.value === "" ? null : Number(e.target.value) };
                setServices(next);
              }}
            />
            <Button
              variant="ghost"
              onClick={() => setServices(services.filter((x) => x.id !== s.id))}
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setServices([
              ...services,
              { id: `s${Date.now()}`, name: "Nuevo servicio", durationMin: 30, price: null },
            ])
          }
        >
          Añadir servicio
        </Button>
        <p className="text-xs text-muted-foreground">Nombre · minutos · precio.</p>
      </section>

      <section className="cj-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Horario</h2>
        {DIAS.map((d) => {
          const list = hours[d.key] ?? [];
          return (
            <div key={d.key} className="space-y-2 border-b border-border pb-3 last:border-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{d.label}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setHours({ ...hours, [d.key]: [...list, { from: "10:00", to: "14:00" }] })
                    }
                  >
                    + tramo
                  </Button>
                  {list.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setHours({ ...hours, [d.key]: [] })}>
                      Cerrado
                    </Button>
                  )}
                </div>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-muted-foreground">Cerrado</p>
              ) : (
                list.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={r.from}
                      onChange={(e) => setRange(d.key, i, "from", e.target.value)}
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={r.to}
                      onChange={(e) => setRange(d.key, i, "to", e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setHours({ ...hours, [d.key]: list.filter((_, idx) => idx !== i) })
                      }
                    >
                      ✕
                    </Button>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </section>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
        {save.isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}

function Ajustes({ salon }: { salon: SalonRow }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  const toggle = useMutation({
    mutationFn: async (patch: { notify_email?: boolean; monthly_report?: boolean }) => {
      const { error } = await supabase.from("salons").update(patch).eq("id", salon.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salon"] }),
    onError: () => toast.error("No se ha podido guardar el aviso."),
  });

  const notice = planNotice(salon);
  const link = typeof window !== "undefined" ? `${window.location.origin}/reservar/${salon.slug}` : "";

  return (
    <div className="space-y-5">
      <section className="cj-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Avisos</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Avisarme por email de cada solicitud</p>
            <p className="text-xs text-muted-foreground">Para no perder ninguna cita nueva.</p>
          </div>
          <Switch
            checked={salon.notify_email}
            onCheckedChange={(v) => toggle.mutate({ notify_email: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">Resumen mensual</p>
            <p className="text-xs text-muted-foreground">Un email con las citas del mes.</p>
          </div>
          <Switch
            checked={salon.monthly_report}
            onCheckedChange={(v) => toggle.mutate({ monthly_report: v })}
          />
        </div>
      </section>

      <section className="cj-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Tu plan</h2>
        <p className="text-sm text-muted-foreground">
          {salon.plan_status === "trialing"
            ? `Estás en el periodo de prueba, hasta el ${new Date(salon.trial_ends_at).toLocaleDateString("es-ES")}.`
            : salon.plan_status === "active"
              ? `Plan activo${salon.paid_until ? ` hasta el ${new Date(salon.paid_until).toLocaleDateString("es-ES")}` : ""}.`
              : "Tu plan ha vencido. Tus datos se conservan, pero tu página no acepta reservas."}
        </p>
        {notice ? <PlanBanner notice={notice} /> : null}
      </section>

      <section className="cj-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Comparte tu página</h2>
        <div className="flex gap-2">
          <Input readOnly value={link} />
          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              toast.success("Enlace copiado.");
            }}
          >
            Copiar
          </Button>
        </div>
      </section>

      <section className="cj-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Cambiar contraseña</h2>
        <Input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={async () => {
            if (password.length < 6) {
              toast.error("Usa al menos 6 caracteres.");
              return;
            }
            const { error } = await supabase.auth.updateUser({ password });
            if (error) toast.error("No se ha podido cambiar la contraseña.");
            else {
              toast.success("Contraseña actualizada.");
              setPassword("");
            }
          }}
        >
          Guardar contraseña
        </Button>
      </section>

      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          navigate({ to: "/", replace: true });
        }}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
