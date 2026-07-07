import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";
import EditListingForm from "./EditListingForm";

// Los datos estáticos del formulario (categorías, localidades, sub-zonas) se
// traen en el servidor con ISR, igual que en /publish: los desplegables ya
// están listos cuando el formulario aparece. La carga del anúncio a editar y
// el guard de dueño siguen client-side dentro de EditListingForm.
export const revalidate = 300;

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const admin = getSupabaseAdmin({ revalidate: 300 });

  const [catRes, locRes, subRes] = await Promise.all([
    admin
      .from("categories")
      .select("id,name,slug,location_type,contact_button_text,whatsapp_message,expires_in_days")
      .eq("is_active", true)
      .order("sort_order"),
    admin.from("localities").select("id,name").eq("is_active", true).order("sort_order"),
    admin.from("subzones").select("id,name,locality_id").eq("is_active", true).order("sort_order"),
  ]);

  return (
    <EditListingForm
      listingId={params.id}
      categories={catRes.data ?? []}
      localities={locRes.data ?? []}
      allSubzones={subRes.data ?? []}
    />
  );
}
