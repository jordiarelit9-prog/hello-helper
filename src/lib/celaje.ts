export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: number | null;
};

export type Range = { from: string; to: string };
export type WorkingHours = Record<string, Range[]>;

export const DIAS = [
  { key: "lun", label: "Lunes", short: "L" },
  { key: "mar", label: "Martes", short: "M" },
  { key: "mie", label: "Miércoles", short: "X" },
  { key: "jue", label: "Jueves", short: "J" },
  { key: "vie", label: "Viernes", short: "V" },
  { key: "sab", label: "Sábado", short: "S" },
  { key: "dom", label: "Domingo", short: "D" },
] as const;

export const THEME_COLORS = [
  { id: "naranja", label: "Azul iOS", css: "linear-gradient(160deg,#64d2ff,#007aff)" },
  { id: "esmeralda", label: "Cian", css: "linear-gradient(160deg,#bfebff,#32ade6)" },
  { id: "azul", label: "Índigo", css: "linear-gradient(160deg,#a7a5ff,#5e5ce6)" },
  { id: "morado", label: "Morado", css: "linear-gradient(160deg,#cfa8f2,#7d3fb0)" },
  { id: "rosa", label: "Rosa", css: "linear-gradient(160deg,#f5a8c9,#c9457f)" },
  { id: "dorado", label: "Titanio", css: "linear-gradient(160deg,#d1d1d6,#636366)" },
] as const;

export const DEFAULT_SERVICES: Service[] = [
  { id: "s1", name: "Corte", durationMin: 30, price: 15 },
  { id: "s2", name: "Corte y barba", durationMin: 45, price: 22 },
];

export const DEFAULT_HOURS: WorkingHours = {
  lun: [{ from: "10:00", to: "14:00" }, { from: "16:00", to: "20:00" }],
  mar: [{ from: "10:00", to: "14:00" }, { from: "16:00", to: "20:00" }],
  mie: [{ from: "10:00", to: "14:00" }, { from: "16:00", to: "20:00" }],
  jue: [{ from: "10:00", to: "14:00" }, { from: "16:00", to: "20:00" }],
  vie: [{ from: "10:00", to: "14:00" }, { from: "16:00", to: "20:00" }],
  sab: [{ from: "10:00", to: "14:00" }],
  dom: [],
};

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function todayStr() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseISO(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function dayKey(date: string) {
  const idx = parseISO(date).getDay(); // 0 = domingo
  return DIAS[(idx + 6) % 7]!.key;
}

export function formatDateEs(date: string) {
  return parseISO(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateLongEs(date: string) {
  const text = parseISO(date).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatMonthYearEs(year: number, month: number) {
  const text = new Date(year, month, 1).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildMonthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function toMinutes(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export type Busy = { start_time: string; duration_min: number };

/** Huecos libres de un día, según el horario del negocio y las citas ya dadas. */
export function availableSlots(
  hours: WorkingHours,
  date: string,
  durationMin: number,
  busy: Busy[],
  step = 15,
) {
  const ranges = hours[dayKey(date)] ?? [];
  const taken = busy.map((b) => ({
    start: toMinutes(b.start_time),
    end: toMinutes(b.start_time) + (b.duration_min || 30),
  }));
  const isToday = date === todayStr();
  const nowMin = (() => {
    const parts = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
    return toMinutes(parts);
  })();

  const slots: string[] = [];
  for (const range of ranges) {
    const start = toMinutes(range.from);
    const end = toMinutes(range.to);
    for (let t = start; t + durationMin <= end; t += step) {
      if (isToday && t <= nowMin) continue;
      const overlaps = taken.some((b) => t < b.end && t + durationMin > b.start);
      if (!overlaps) slots.push(toTime(t));
    }
  }
  return slots;
}

export type SalonPlan = {
  plan_status: string;
  trial_ends_at: string;
  paid_until: string | null;
  suspended: boolean;
};

export type PlanNotice = {
  tone: "info" | "warning" | "danger";
  title: string;
  body: string;
  blocked: boolean;
};

export function planNotice(salon: SalonPlan): PlanNotice | null {
  if (salon.suspended) {
    return {
      tone: "danger",
      title: "Cuenta suspendida",
      body: "Puedes consultar tu agenda y tus datos, pero tu página no admite reservas hasta que se reactive la cuenta.",
      blocked: true,
    };
  }
  const rawEnd = salon.plan_status === "active" ? salon.paid_until : salon.trial_ends_at;
  const end = rawEnd ? new Date(rawEnd) : null;
  const days = end ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null;
  const endText = end
    ? end.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    : "";

  if (salon.plan_status === "trialing") {
    if (days !== null && days > 0) {
      return {
        tone: days <= 7 ? "warning" : "info",
        title: days === 1 ? "Te queda 1 día de prueba" : `Te quedan ${days} días de prueba`,
        body: `Tu prueba termina el ${endText}. No se renueva ni genera cobros por sí sola.`,
        blocked: false,
      };
    }
    return {
      tone: "danger",
      title: "Tu prueba ha terminado",
      body: "Puedes entrar y conservar tus datos, pero tu página ya no admite nuevas reservas. Activa un plan para reabrir la agenda.",
      blocked: true,
    };
  }
  if (salon.plan_status === "expired") {
    return {
      tone: "danger",
      title: "Tu plan ha vencido",
      body: "Tu página no acepta reservas nuevas. Activa un plan para reabrir la agenda.",
      blocked: true,
    };
  }
  if (salon.plan_status === "active" && days !== null && days <= 7) {
    return {
      tone: days > 0 ? "warning" : "danger",
      title: days > 0 ? `Tu periodo pagado vence en ${days} días` : "Tu periodo pagado ha vencido",
      body: "Revisa tu plan para que la agenda siga aceptando reservas.",
      blocked: days <= 0,
    };
  }
  return null;
}

export const money = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : `${Number(value).toFixed(2).replace(/\.00$/, "")} €`;
