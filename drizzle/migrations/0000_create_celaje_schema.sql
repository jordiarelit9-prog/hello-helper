-- SALONS ---------------------------------------------------------------
CREATE TABLE public.salons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  theme_color text NOT NULL DEFAULT 'naranja',
  logo_url text,
  cover_url text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_email boolean NOT NULL DEFAULT true,
  monthly_report boolean NOT NULL DEFAULT false,
  plan_status text NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '45 days'),
  paid_until timestamptz,
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT salons_owner_unique UNIQUE (owner_id),
  CONSTRAINT salons_plan_status_check CHECK (plan_status IN ('trialing','active','expired')),
  CONSTRAINT salons_slug_format CHECK (slug ~ '^[a-z0-9-]{3,40}$')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salons TO authenticated;
GRANT SELECT ON public.salons TO anon;
GRANT ALL ON public.salons TO service_role;

ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view salons"
  ON public.salons FOR SELECT USING (true);
CREATE POLICY "Owner can insert own salon"
  ON public.salons FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update own salon"
  ON public.salons FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can delete own salon"
  ON public.salons FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- APPOINTMENTS ---------------------------------------------------------
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  service_id text,
  service_name text NOT NULL,
  duration_min integer NOT NULL DEFAULT 30,
  price numeric(8,2),
  date date NOT NULL,
  start_time time NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text,
  client_note text DEFAULT '',
  owner_note text DEFAULT '',
  source text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_status_check CHECK (status IN ('pending','accepted','rejected','cancelled','done','noshow')),
  CONSTRAINT appointments_source_check CHECK (source IN ('web','manual'))
);

CREATE INDEX appointments_salon_date_idx ON public.appointments (salon_id, date);
CREATE INDEX appointments_salon_status_idx ON public.appointments (salon_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = appointments.salon_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owner can insert own appointments"
  ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = appointments.salon_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owner can update own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = appointments.salon_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = appointments.salon_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owner can delete own appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = appointments.salon_id AND s.owner_id = auth.uid()));

-- Public helpers --------------------------------------------------------
-- Horas ya ocupadas de un dia, sin exponer datos del cliente.
CREATE OR REPLACE FUNCTION public.busy_slots(_slug text, _date date)
RETURNS TABLE (start_time time, duration_min integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.start_time, a.duration_min
  FROM public.appointments a
  JOIN public.salons s ON s.id = a.salon_id
  WHERE s.slug = _slug
    AND a.date = _date
    AND a.status IN ('pending','accepted','done');
$$;

GRANT EXECUTE ON FUNCTION public.busy_slots(text, date) TO anon, authenticated, service_role;

-- Crear una solicitud desde la pagina publica (el cliente no esta logueado).
CREATE OR REPLACE FUNCTION public.request_appointment(
  _slug text, _service_id text, _date date, _start time,
  _client_name text, _client_phone text, _client_email text, _client_note text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.salons;
  svc jsonb;
  new_id uuid;
BEGIN
  SELECT * INTO s FROM public.salons WHERE slug = _slug;
  IF s.id IS NULL THEN RAISE EXCEPTION 'SALON_NOT_FOUND'; END IF;
  IF s.suspended THEN RAISE EXCEPTION 'SALON_CLOSED'; END IF;
  IF s.plan_status = 'expired'
     OR (s.plan_status = 'trialing' AND s.trial_ends_at < now())
     OR (s.plan_status = 'active' AND s.paid_until IS NOT NULL AND s.paid_until < now())
  THEN RAISE EXCEPTION 'SALON_CLOSED'; END IF;
  IF _date < (now() AT TIME ZONE 'Europe/Madrid')::date THEN RAISE EXCEPTION 'PAST_DATE'; END IF;
  IF length(coalesce(trim(_client_name), '')) < 2 THEN RAISE EXCEPTION 'BAD_NAME'; END IF;
  IF length(coalesce(trim(_client_phone), '')) < 6 THEN RAISE EXCEPTION 'BAD_PHONE'; END IF;

  SELECT elem INTO svc
  FROM jsonb_array_elements(s.services) elem
  WHERE elem->>'id' = _service_id;
  IF svc IS NULL THEN RAISE EXCEPTION 'BAD_SERVICE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.salon_id = s.id AND a.date = _date AND a.start_time = _start
      AND a.status IN ('pending','accepted','done')
  ) THEN RAISE EXCEPTION 'SLOT_TAKEN'; END IF;

  INSERT INTO public.appointments (
    salon_id, service_id, service_name, duration_min, price, date, start_time,
    client_name, client_phone, client_email, client_note, status, source
  ) VALUES (
    s.id, _service_id, svc->>'name', coalesce((svc->>'durationMin')::int, 30),
    nullif(svc->>'price','')::numeric, _date, _start,
    trim(_client_name), trim(_client_phone), nullif(trim(coalesce(_client_email,'')),''),
    left(coalesce(_client_note,''), 400), 'pending', 'web'
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_appointment(text, text, date, time, text, text, text, text) TO anon, authenticated, service_role;