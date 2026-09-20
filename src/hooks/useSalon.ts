import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_HOURS, DEFAULT_SERVICES, slugify } from "@/lib/celaje";

export type SalonRow = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  theme_color: string;
  logo_url: string | null;
  cover_url: string | null;
  services: unknown;
  working_hours: unknown;
  notify_email: boolean;
  monthly_report: boolean;
  plan_status: string;
  trial_ends_at: string;
  paid_until: string | null;
  suspended: boolean;
};

/**
 * Trae el negocio del usuario. Si acaba de confirmar su cuenta y todavía no
 * tiene página, la crea con lo que eligió al registrarse.
 */
async function loadSalon(): Promise<SalonRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const existing = await supabase
    .from("salons")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing.data) return existing.data as SalonRow;

  const meta = (user.user_metadata ?? {}) as { salon_name?: string; salon_slug?: string };
  const name = meta.salon_name?.trim() || "Mi peluquería";
  let slug = meta.salon_slug?.trim() || slugify(name) || `salon-${user.id.slice(0, 6)}`;

  const taken = await supabase.from("salons").select("slug").eq("slug", slug).maybeSingle();
  if (taken.data) slug = `${slug}-${user.id.slice(0, 4)}`;

  const created = await supabase
    .from("salons")
    .insert({
      owner_id: user.id,
      slug,
      name,
      services: DEFAULT_SERVICES,
      working_hours: DEFAULT_HOURS,
      phone: (user.user_metadata as { phone?: string })?.phone ?? "",
    })
    .select("*")
    .single();

  if (created.error) throw created.error;
  return created.data as SalonRow;
}

export function useSalon() {
  return useQuery({ queryKey: ["salon"], queryFn: loadSalon, staleTime: 30_000 });
}
