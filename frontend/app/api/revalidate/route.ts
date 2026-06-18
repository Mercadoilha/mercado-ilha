import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/**
 * Revalida la home (ISR) bajo demanda. Lo llama el cliente tras publicar un
 * anúncio para que aparezca al instante en "/" sin esperar la ventana de 60s.
 * Requiere una sesión válida de Supabase (solo usuarios logueados publican) →
 * evita que alguien anónimo fuerce regeneraciones.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  revalidatePath("/");
  return NextResponse.json({ revalidated: true });
}
