import { getSupabaseAdmin } from "../../lib/supabaseAdmin";
import InformacaoClient from "../../components/InformacaoClient";

// ISR: solo necesita el WhatsApp del admin (para "Fale conosco"). Los widgets de marés/
// barcos cargan client-side (useEffect) y no vuelven dinámica la ruta.
export const revalidate = 300;

export default async function InformacaoPage() {
  const admin = getSupabaseAdmin({ revalidate: 300 });
  const { data: settingsData } = await admin
    .from("admin_settings")
    .select("key,value")
    .eq("key", "admin_whatsapp");

  const rows: Record<string, any> = {};
  (settingsData ?? []).forEach((r: any) => { rows[r.key] = r.value; });
  const waRaw = rows["admin_whatsapp"]?.value
    ? String(rows["admin_whatsapp"].value).replace(/\D/g, "")
    : null;
  const adminWa = waRaw ? (waRaw.startsWith("55") ? waRaw : `55${waRaw}`) : "5575997075133";

  return <InformacaoClient adminWa={adminWa} />;
}
