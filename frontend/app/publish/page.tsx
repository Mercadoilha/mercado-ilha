import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import PublishForm from "./PublishForm";

// Los datos estáticos del formulario (categorías, localidades, sub-zonas, ilha)
// se traen en el servidor con ISR: los desplegables ya están listos cuando el
// formulario aparece, sin round-trips desde el navegador ni spinner de carga.
// La verificación de sesión sigue siendo client-side dentro de PublishForm.
export const revalidate = 300;

export default async function PublishPage() {
  const admin = getSupabaseAdmin({ revalidate: 300 });

  const [catRes, islandRes, locRes, subRes] = await Promise.all([
    admin
      .from("categories")
      .select("id,name,slug,location_type,contact_button_text,whatsapp_message,expires_in_days")
      .eq("is_active", true)
      .order("sort_order"),
    admin.from("islands").select("id").eq("slug", "tinhare").single(),
    admin.from("localities").select("id,name").eq("is_active", true).order("sort_order"),
    admin.from("subzones").select("id,name,locality_id").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <PublishForm
      categories={catRes.data ?? []}
      islandId={islandRes.data?.id ?? null}
      localities={locRes.data ?? []}
      allSubzones={subRes.data ?? []}
    />
  );
}
