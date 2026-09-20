import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers });
      },
    },
  });
}

/** Datos públicos de la página de reservas de un negocio. */
export const getPublicSalon = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data.slug ?? "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: salon, error } = await supabase
      .from("salons")
      .select(
        "id, slug, name, description, address, phone, theme_color, logo_url, cover_url, services, working_hours, plan_status, trial_ends_at, paid_until, suspended",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (error) return { salon: null, error: "No se pudo cargar la página." };
    return { salon, error: null };
  });
