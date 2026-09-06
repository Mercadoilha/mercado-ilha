import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/**
 * Revalida (ISR) bajo demanda el inicio "/" y "/categorias". Lo llama el cliente tras
 * publicar un anúncio (para que aparezca al instante en el feed del inicio) y desde el
 * admin al editar categorías / destaques (para refrescar el inicio y la pantalla de
 * categorías). Requiere una sesión válida de Supabase → evita que un anónimo fuerce
 * regeneraciones.
 *
 * Con { path: "/mercado" } en el cuerpo revalida SOLO esa ruta: lo usa el panel de la
 * feira al guardar (precio, WhatsApp de destino, datos). Sin eso, un cambio tardaba
 * hasta un minuto en verse — y el WhatsApp viejo seguía saliendo en el botón de envío.
 * Solo se aceptan rutas de una lista fija: nadie puede pedir la regeneración de
 * cualquier página.
 */
const ALLOWED_PATHS = new Set(["/", "/categorias", "/mercado"]);

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

  const body = (await req.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : null;

  if (path) {
    if (!ALLOWED_PATHS.has(path)) {
      return NextResponse.json({ error: "Rota inválida" }, { status: 400 });
    }
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  revalidatePath("/");
  revalidatePath("/categorias");
  return NextResponse.json({ revalidated: true });
}
