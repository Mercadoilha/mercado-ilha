import { ImageResponse } from "next/og";
import { getStoreOg, OG_REVALIDATE } from "../../../lib/ogData";

// Imagen de vista previa (Open Graph) de la loja: collage con las fotos de los productos.
// Adaptable: 1 producto → 1 foto; 2 → dos; 3 → una grande + dos; 4+ → mosaico 2×2.
// Solo la genera el crawler al desplegar el link, y queda cacheada (revalidate) → no toca
// el render de la página para el usuario (pilar de velocidad).
export const revalidate = OG_REVALIDATE;
export const runtime = "nodejs";
export const alt = "Loja no Mercado Ilha";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const W = 1200;
const H = 630;
const GAP = 6;
const BG = "#185FA5";
const HALF_W = (W - GAP) / 2; // 597
const HALF_H = (H - GAP) / 2; // 312

// El rasterizador solo decodifica con seguridad JPEG/PNG. Traemos cada foto, verificamos su
// tipo y descartamos las que no sirven para que el collage nunca se rompa. Las válidas viajan
// como data URI con medidas EXPLÍCITAS (satori necesita width/height numéricos por imagen).
const SAFE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: OG_REVALIDATE } });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!SAFE_TYPES.has(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Ph({ src, w, h }: { src: string; w: number; h: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={w} height={h} style={{ width: w, height: h, objectFit: "cover" }} />;
}

export default async function Image({ params }: { params: { id: string } }) {
  const og = await getStoreOg(params.id);
  const imgs = ((await Promise.all((og?.photos ?? []).map(toDataUri))).filter(Boolean) as string[]).slice(0, 4);

  let content: React.ReactElement;

  if (imgs.length === 0) {
    content = <div style={{ display: "flex", width: W, height: H, background: "linear-gradient(135deg, #185FA5 0%, #123f66 100%)" }} />;
  } else if (imgs.length === 1) {
    content = (
      <div style={{ display: "flex", width: W, height: H }}>
        <Ph src={imgs[0]} w={W} h={H} />
      </div>
    );
  } else if (imgs.length === 2) {
    content = (
      <div style={{ display: "flex", width: W, height: H, gap: GAP, background: BG }}>
        <Ph src={imgs[0]} w={HALF_W} h={H} />
        <Ph src={imgs[1]} w={HALF_W} h={H} />
      </div>
    );
  } else if (imgs.length === 3) {
    content = (
      <div style={{ display: "flex", width: W, height: H, gap: GAP, background: BG }}>
        <Ph src={imgs[0]} w={HALF_W} h={H} />
        <div style={{ display: "flex", flexDirection: "column", width: HALF_W, height: H, gap: GAP }}>
          <Ph src={imgs[1]} w={HALF_W} h={HALF_H} />
          <Ph src={imgs[2]} w={HALF_W} h={HALF_H} />
        </div>
      </div>
    );
  } else {
    content = (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: H, gap: GAP, background: BG }}>
        <div style={{ display: "flex", width: W, height: HALF_H, gap: GAP }}>
          <Ph src={imgs[0]} w={HALF_W} h={HALF_H} />
          <Ph src={imgs[1]} w={HALF_W} h={HALF_H} />
        </div>
        <div style={{ display: "flex", width: W, height: HALF_H, gap: GAP }}>
          <Ph src={imgs[2]} w={HALF_W} h={HALF_H} />
          <Ph src={imgs[3]} w={HALF_W} h={HALF_H} />
        </div>
      </div>
    );
  }

  return new ImageResponse(content, { ...size });
}
