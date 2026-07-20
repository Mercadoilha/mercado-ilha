// Formato limitado y SEGURO para la descripción de anuncios: negrita, cursiva,
// subrayado y listas con viñetas. Nada más.
//
// Estrategia de seguridad (defensa en profundidad):
//  1) Al escribir (editor): serializamos el conteneditable con un walk de whitelist
//     que ESCAPA todo el texto y solo emite <strong>/<em>/<u>/<ul>/<li>/<br>.
//  2) Al renderizar: volvemos a sanear con un filtro isomórfico (sirve en server y
//     cliente) que descarta cualquier etiqueta fuera de la whitelist y borra TODOS
//     los atributos de las permitidas. Así, aunque un valor fuera manipulado por
//     fuera de la app (RLS permite que el dueño escriba), nunca ejecuta nada.
// Guardamos la descripción como texto plano en `description` (búsqueda + preview del
// feed intactos) y el formato en `description_rich`.

const ALLOWED = new Set(["strong", "em", "u", "ul", "li", "br"]);
// Etiquetas equivalentes que algunos navegadores generan → forma canónica.
const TAG_MAP: Record<string, string> = { b: "strong", i: "em", strike: "em" };

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Sanea un string HTML para renderizar: solo etiquetas simples de la whitelist, sin
// atributos. Isomórfico (regex puro, no depende del DOM). Cualquier etiqueta no
// permitida se elimina; los atributos de las permitidas se descartan.
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  let out = html.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)[^>]*?>/g, (_m, slash: string, rawTag: string) => {
    let tag = rawTag.toLowerCase();
    if (TAG_MAP[tag]) tag = TAG_MAP[tag];
    if (!ALLOWED.has(tag)) return "";
    if (tag === "br") return "<br>";
    return slash ? `</${tag}>` : `<${tag}>`;
  });
  return out;
}

// ¿El HTML formateado tiene texto visible? (para decidir si guardamos rich o null).
export function richHasContent(html: string | null | undefined): boolean {
  if (!html) return false;
  const text = sanitizeRichHtml(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
  return text.length > 0;
}

// Deriva el texto plano (con saltos de línea reales) a partir del HTML formateado.
// Lo usamos para guardar `description`: así la búsqueda, la vista previa del feed y el
// primer pintado del detalle conservan la estructura (líneas y listas) en vez de
// aplastar todo en un solo bloque. `textContent` no sirve porque descarta los saltos.
export function richToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  let s = sanitizeRichHtml(html);
  s = s
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<ul>/gi, "")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, ""); // resto de etiquetas inline (strong/em/u)
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const INLINE_MAP: Record<string, string> = { STRONG: "strong", B: "strong", EM: "em", I: "em", U: "u" };

// Serializa el DOM de un contenteditable a HTML limpio de la whitelist (solo en el
// navegador). Escapa todo el texto y normaliza <b>/<i>, spans con estilo y bloques.
export function serializeEditorHtml(root: HTMLElement): string {
  const out: string[] = [];
  walk(root, out);
  let html = out.join("");
  // No dejar <br> colgando al final ni rachas largas.
  html = html.replace(/(?:<br>\s*){3,}/g, "<br><br>").replace(/(?:<br>\s*)+$/g, "").trim();
  return html;
}

function walk(node: Node, out: string[]): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(escapeText(child.textContent || ""));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName;

    if (tag === "BR") { out.push("<br>"); return; }

    if (tag === "UL" || tag === "OL") {
      out.push("<ul>");
      el.childNodes.forEach((li) => {
        if (li.nodeType === Node.ELEMENT_NODE && (li as HTMLElement).tagName === "LI") {
          out.push("<li>");
          walk(li, out);
          out.push("</li>");
        }
      });
      out.push("</ul>");
      return;
    }
    if (tag === "LI") { out.push("<li>"); walk(el, out); out.push("</li>"); return; }

    const mapped = INLINE_MAP[tag];
    if (mapped) { out.push(`<${mapped}>`); walk(el, out); out.push(`</${mapped}>`); return; }

    if (tag === "DIV" || tag === "P") {
      const last = out[out.length - 1];
      if (out.length && last !== "<br>") out.push("<br>");
      walk(el, out);
      return;
    }

    if (tag === "SPAN" || tag === "FONT") {
      const style = el.getAttribute("style") || "";
      let open = "";
      let close = "";
      if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) { open += "<strong>"; close = "</strong>" + close; }
      if (/font-style\s*:\s*italic/i.test(style)) { open += "<em>"; close = "</em>" + close; }
      if (/text-decoration[^;]*underline/i.test(style)) { open += "<u>"; close = "</u>" + close; }
      out.push(open); walk(el, out); out.push(close);
      return;
    }

    // Cualquier otro elemento: ignoramos la etiqueta y seguimos con su contenido.
    walk(el, out);
  });
}

// HTML inicial para el editor a partir de un valor guardado. Si hay rich, se usa
// (saneado). Si no, se arma desde el texto plano preservando saltos de línea.
export function initialEditorHtml(rich: string | null | undefined, plain: string | null | undefined): string {
  if (richHasContent(rich)) return sanitizeRichHtml(rich);
  if (plain && plain.trim()) {
    return escapeText(plain).replace(/\r\n|\r|\n/g, "<br>");
  }
  return "";
}
