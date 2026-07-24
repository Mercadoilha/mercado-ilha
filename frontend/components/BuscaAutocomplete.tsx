"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { fold, foldWords, prefixFilter } from "../lib/searchNorm";
import { loadCategorySlugsWithSubs } from "../lib/catalogCache";

// Tres tipos de sugerencia, en este orden de prioridad:
//  - "term": la búsqueda particular (texto). Primera y más específica.
//            Ej.: "iph" → "iphone" → muestra solo iphones.
//            Al elegirla NO navega: completa la barra para que el usuario
//            pueda agregar más texto y recién ahí tocar Buscar.
//  - "nav" (categoría/subcategoría): relacionadas, navegan directo.
type Suggestion = {
  label: string;
  href: string;
  hint: string; // etiqueta a la derecha; "" = sin etiqueta (término particular)
  kind: "term" | "nav";
};

const cache = new Map<string, Suggestion[]>();

// Espejo del caché en sessionStorage (T5 del plan V2): las sugerencias repetidas
// son instantáneas también tras recargar la página o reabrir el PWA, no solo dentro
// de la misma carga. Mismo patrón que lib/catalogCache. El Map en memoria sigue
// siendo la fuente rápida; sessionStorage solo lo hidrata una vez y lo persiste.
const SS_KEY = "mi_busca_cache_v2"; // v2: cambiaron los destinos de las sugerencias
const SS_TTL = 10 * 60 * 1000; // 10 min
const SS_MAX = 50; // tope de queries persistidas (las más viejas se descartan)
let ssHydrated = false;

type StoredEntry = { data: Suggestion[]; ts: number };

function hydrateFromSS() {
  if (ssHydrated) return;
  ssHydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, StoredEntry>;
    const now = Date.now();
    for (const [k, e] of Object.entries(store)) {
      if (e && Array.isArray(e.data) && typeof e.ts === "number" && now - e.ts < SS_TTL) {
        cache.set(k, e.data);
      }
    }
  } catch {
    // storage corrupto / modo privado: ignorar, el Map en memoria sigue sirviendo.
  }
}

function persistToSS(key: string, data: Suggestion[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    const store: Record<string, StoredEntry> = raw ? JSON.parse(raw) : {};
    store[key] = { data, ts: Date.now() };
    const keys = Object.keys(store);
    if (keys.length > SS_MAX) {
      keys.sort((a, b) => store[a].ts - store[b].ts);
      for (const k of keys.slice(0, keys.length - SS_MAX)) delete store[k];
    }
    sessionStorage.setItem(SS_KEY, JSON.stringify(store));
  } catch {
    // storage lleno / modo privado: ignorar.
  }
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// En móvil el navegador dispara el `click` recién al LEVANTAR el dedo. Si para entonces la
// lista de sugerencias ya se cerró (o la pantalla ya cambió), ese click cae sobre lo que
// quedó debajo — el banner — y lo abre sin querer. Se descarta el primer click que llegue
// justo después de cerrar la lista. No afecta al click propio de la sugerencia: un listener
// agregado durante el despacho del evento no se ejecuta para ese mismo evento.
function swallowGhostClick() {
  if (typeof document === "undefined") return;
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    document.removeEventListener("click", stop, true);
  };
  document.addEventListener("click", stop, true);
  setTimeout(() => document.removeEventListener("click", stop, true), 400);
}

// Ordena las palabras de los títulos que EMPIEZAN por `word` (ya normalizada
// con fold), mejores primero: coincidencia exacta > más frecuente > más corta.
// Devuelve la grafía real más frecuente (con acentos): "pa" → "pão".
function rankCompletions(titles: string[], word: string): string[] {
  const stats = new Map<string, { total: number; variants: Map<string, number> }>();
  for (const title of titles) {
    for (const raw of title.split(/[\s,.;:/()\-–—|@#!?"']+/)) {
      const display = raw.toLowerCase();
      const w = fold(display);
      if (w.length < 2 || w.length > 24) continue;
      if (/^\d+$/.test(w)) continue; // ignorar números sueltos
      if (!w.startsWith(word)) continue;
      const e = stats.get(w) ?? { total: 0, variants: new Map<string, number>() };
      e.total += 1;
      e.variants.set(display, (e.variants.get(display) ?? 0) + 1);
      stats.set(w, e);
    }
  }
  return [...stats.entries()]
    .sort((a, b) => {
      const ea = a[0] === word ? 1 : 0;
      const eb = b[0] === word ? 1 : 0;
      if (ea !== eb) return eb - ea; // el término exacto primero
      if (b[1].total !== a[1].total) return b[1].total - a[1].total; // luego el más frecuente
      return a[0].length - b[0].length; // luego el más corto
    })
    .map(([, e]) => [...e.variants.entries()].sort((x, y) => y[1] - x[1])[0][0]);
}

async function fetchSuggestions(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const key = fold(norm(q));
  hydrateFromSS(); // primer miss: cargar lo persistido de sesiones/cargas previas
  if (cache.has(key)) return cache.get(key)!;

  const ql = norm(q);
  // Cada palabra se filtra por separado (AND) sobre las columnas *_norm
  // (fase-19): sin acentos, por inicio de palabra, sin depender del orden.
  const words = foldWords(q);

  let listQ = supabase
    .from("listings")
    .select("title, categories:category_id(name, slug), subcategories:subcategory_id(id, name, categories(name, slug))")
    .eq("status", "active");
  let catQ = supabase
    .from("categories")
    .select("name, slug")
    .eq("is_active", true);
  let subQ = supabase
    .from("subcategories")
    .select("id, name, categories(name, slug)");
  for (const w of words) {
    listQ = listQ.or(prefixFilter("title_norm", w));
    catQ = catQ.or(prefixFilter("name_norm", w));
    subQ = subQ.or(prefixFilter("name_norm", w));
  }

  const [listRes, catRes, subRes, slugsWithSubs] = await Promise.all([
    // Anuncios que coinciden por título: de aquí salen los términos
    // particulares y las categorías/subcategorías relacionadas.
    listQ.limit(20).abortSignal(signal),
    // Coincidencia directa por nombre de categoría (ej. escribir "celul").
    catQ.limit(5).abortSignal(signal),
    // Coincidencia directa por nombre de subcategoría.
    subQ.limit(5).abortSignal(signal),
    // Catálogos ya cacheados en la sesión: dicen qué categorías tienen subcategorías.
    // En paralelo con las de arriba → no agrega espera.
    loadCategorySlugsWithSubs().catch(() => new Set<string>()),
  ]);

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  let listRows = (listRes.data ?? []) as any[];
  // Ninguna publicación tiene TODAS las palabras → relajar a CUALQUIERA
  // (estilo Mercado Livre), para seguir sugiriendo lo relacionado.
  if (listRows.length === 0 && words.length > 1) {
    const relaxed = await supabase
      .from("listings")
      .select("title, categories:category_id(name, slug), subcategories:subcategory_id(id, name, categories(name, slug))")
      .eq("status", "active")
      .or(words.map((w) => prefixFilter("title_norm", w)).join(","))
      .limit(20)
      .abortSignal(signal);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    listRows = (relaxed.data ?? []) as any[];
  }

  // Títulos que coinciden → de aquí sale la búsqueda particular.
  const titles: string[] = [];
  // Categorías relacionadas (por los anuncios que coinciden + match directo).
  const catMap = new Map<string, { label: string; slug: string; count: number }>();
  // Subcategorías relacionadas.
  const subMap = new Map<string, { label: string; href: string; hint: string; count: number }>();

  for (const row of listRows) {
    const r = row as any;
    titles.push((r.title as string) ?? "");
    const cat = r.categories;
    if (cat?.slug) {
      const e = catMap.get(cat.slug) ?? { label: cat.name, slug: cat.slug, count: 0 };
      e.count += 1;
      catMap.set(cat.slug, e);
    }
    const sub = r.subcategories;
    const subParentSlug = sub?.categories?.slug;
    if (sub?.id && subParentSlug) {
      const k = `${subParentSlug}:${sub.id}`;
      const e = subMap.get(k) ?? {
        label: sub.name,
        href: `/listings?category=${subParentSlug}&subcategory_id=${sub.id}&from=busca`,
        hint: sub.categories?.name ?? "Categoria",
        count: 0,
      };
      e.count += 1;
      subMap.set(k, e);
    }
  }

  // Coincidencias directas (peso base para que aparezcan aunque no haya
  // anuncios con ese texto en el título).
  for (const c of catRes.data ?? []) {
    const cc = c as any;
    if (!cc.slug) continue;
    const e = catMap.get(cc.slug) ?? { label: cc.name, slug: cc.slug, count: 0 };
    e.count += 0.5;
    catMap.set(cc.slug, e);
  }
  for (const s of subRes.data ?? []) {
    const ss = s as any;
    const parentSlug = ss.categories?.slug;
    if (!ss.id || !parentSlug) continue;
    const k = `${parentSlug}:${ss.id}`;
    const e = subMap.get(k) ?? {
      label: ss.name,
      // from=busca: al volver desde los anuncios se pasa antes por la lista de
      // subcategorías de esa categoría, en vez de saltar de una a la pantalla anterior.
      href: `/listings?category=${parentSlug}&subcategory_id=${ss.id}&from=busca`,
      hint: ss.categories?.name ?? "Categoria",
      count: 0,
    };
    e.count += 0.5;
    subMap.set(k, e);
  }

  const seen = new Set<string>();
  const result: Suggestion[] = [];
  const add = (s: Suggestion) => {
    const k = fold(norm(s.label));
    if (!k || seen.has(k)) return;
    seen.add(k);
    result.push(s);
  };
  const addTerm = (label: string) =>
    add({ label, href: `/listings?q=${encodeURIComponent(label)}`, hint: "", kind: "term" });

  // 1) Búsqueda particular (primera y más específica). Se completa la ÚLTIMA
  // palabra escrita con la grafía real de los títulos: "pão fr" → "pão francês".
  const typedWords = ql.split(" ").filter(Boolean);
  const lastWord = fold(typedWords[typedWords.length - 1] ?? "");
  const comps = lastWord.length >= 2 ? rankCompletions(titles, lastWord) : [];
  const prefix = typedWords.slice(0, -1).join(" ");
  const withPrefix = (w: string) => (prefix ? `${prefix} ${w}` : w);
  if (typedWords.length > 1) {
    const completed = comps[0] ? withPrefix(comps[0]) : null;
    if (completed && fold(completed) === fold(ql)) {
      // Misma frase pero con los acentos reales ("pao frances" → "pao francês").
      addTerm(completed);
    } else {
      // Frase completa tal cual se escribió → resultados EXACTOS.
      addTerm(ql);
      if (completed) addTerm(completed);
    }
  } else {
    // Fragmento ("iph") → completar al término real ("iphone") + una alternativa.
    addTerm(comps[0] ?? ql);
    if (comps[1]) addTerm(comps[1]);
  }

  // 2) Categorías relacionadas (máx 3).
  const cats = [...catMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  for (const c of cats) {
    // Si la categoría tiene subcategorías, primero se muestran ellas (ahí arriba está
    // "Todas as publicações" para quien quiera ver todo). Si no tiene, va directo a los
    // anuncios. Mismo criterio que los botones de categoría del home.
    const href = slugsWithSubs.has(c.slug) ? `/category/${c.slug}` : `/listings?category=${c.slug}`;
    add({ label: c.label, href, hint: "Categoria", kind: "nav" });
  }

  // 3) Subcategorías relacionadas (máx 3).
  const subs = [...subMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  for (const s of subs) {
    add({ label: s.label, href: s.href, hint: s.hint, kind: "nav" });
  }

  const final = result.slice(0, 8);
  if (final.length > 0) {
    cache.set(key, final);
    persistToSS(key, final);
  }
  return final;
}

// Resalta en negrita la parte del término que coincide con lo escrito,
// ignorando acentos ("pao" resalta "pão"). fold() preserva el largo, así que
// los índices sobre el texto normalizado valen para el original.
function highlight(term: string, q: string) {
  const nq = fold(q.trim());
  const idx = nq ? fold(term).indexOf(nq) : -1;
  if (idx < 0) return <>{term}</>;
  const end = idx + nq.length;
  return (
    <>
      {term.slice(0, idx)}
      <strong style={{ fontWeight: 700, color: "#1e293b" }}>{term.slice(idx, end)}</strong>
      {term.slice(end)}
    </>
  );
}

export default function BuscaAutocomplete({ defaultValue = "", flush = false }: { defaultValue?: string; flush?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Marca que el próximo render viene de elegir una sugerencia: hay que dejar el
  // cursor al final (después del espacio) para poder seguir escribiendo.
  const caretToEndRef = useRef(false);
  // Al llegar a la pantalla de resultados la barra trae el término ya escrito, pero NO debe
  // desplegar sugerencias sola: recién se abre cuando el usuario vuelve a tocarla o escribir.
  const interactedRef = useRef(false);
  // Espejo de `open` accesible dentro del listener de outside-click (que se registra una
  // sola vez al montar, así que no puede leer el estado directamente sin quedar desactualizado).
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

  const runSearch = useCallback((q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetchSuggestions(q, ctrl.signal)
      .then((t) => {
        setItems(t);
        setActiveIdx(-1);
        setOpen(true);
      })
      .catch(() => {/* aborted — ignore */})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) {
      setOpen(false);
      setItems([]);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }
    // Sin interacción previa (recién llegado con el término ya escrito): no abrir solo.
    if (!interactedRef.current) return;
    timerRef.current = setTimeout(() => runSearch(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, runSearch]);

  // Cursor al final de la barra tras completarla con una sugerencia. El input nunca
  // pierde el foco (los ítems cancelan el pointerdown), así que en móvil el teclado
  // sigue abierto y se puede escribir la palabra siguiente sin volver a tocar.
  useEffect(() => {
    if (!caretToEndRef.current) return;
    caretToEndRef.current = false;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    try { el.setSelectionRange(end, end); } catch { /* selección no soportada */ }
  }, [query]);

  // Cerrar tocando afuera. Si la lista estaba abierta, ese mismo toque también cae sobre lo
  // que haya debajo (un banner, una tarjeta) — se descarta ese click con la misma técnica que
  // evita que las sugerencias abran el banner de atrás: el toque de afuera solo cierra, no
  // activa nada; hay que tocar una segunda vez para eso.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (openRef.current) swallowGhostClick();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function goHref(href: string) {
    swallowGhostClick();
    setOpen(false);
    router.push(href);
  }

  // Enter sin sugerencia elegida → búsqueda de texto amplia (título + descripción).
  function goFreeText(term: string) {
    const q = term.trim();
    if (!q) return;
    swallowGhostClick();
    setOpen(false);
    router.push(`/listings?q=${encodeURIComponent(q)}`);
  }

  // Término ya elegido: la barra quedó completada con él y con el espacio final,
  // así que en la lista se ve entero en negrita. Volver a tocarlo busca.
  const isChosenTerm = useCallback(
    (item: Suggestion) =>
      item.kind === "term" && query.endsWith(" ") && fold(norm(query)) === fold(norm(item.label)),
    [query],
  );

  // Tocar una sugerencia: categoría/subcategoría navega directo; un término
  // completa la barra y deja el cursor después de un espacio, para poder seguir
  // escribiendo la palabra siguiente. El espacio no entra en la búsqueda
  // (goFreeText recorta). Tocar de nuevo el término ya elegido → buscar.
  function selectSuggestion(item: Suggestion) {
    if (item.kind === "nav") {
      goHref(item.href);
      return;
    }
    if (isChosenTerm(item)) {
      goFreeText(item.label);
      return;
    }
    setQuery(item.label + " ");
    setActiveIdx(-1);
    caretToEndRef.current = true;
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const active = activeIdx >= 0 ? items[activeIdx] : null;
    if (active) {
      // Enter con sugerencia resaltada (teclado): buscar/navegar directo.
      if (active.kind === "nav") goHref(active.href);
      else goFreeText(active.label);
      return;
    }
    goFreeText(query);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const hasResults = items.length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative", marginTop: flush ? 0 : "0.875rem", flex: 1 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "0.875rem",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "1rem",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="busca-listbox"
            aria-activedescendant={activeIdx >= 0 ? `busca-item-${activeIdx}` : undefined}
            placeholder="Buscar no Mercado Ilha"
            value={query}
            autoComplete="off"
            onChange={(e) => { interactedRef.current = true; setQuery(e.target.value); }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              interactedRef.current = true;
              if (query.length >= 2) { if (hasResults) setOpen(true); else runSearch(query); }
            }}
            style={{
              width: "100%",
              padding: "0.7rem 0.875rem 0.7rem 2.5rem",
              borderRadius: 12,
              border: "none",
              fontSize: "0.95rem",
              background: "rgba(255,255,255,0.95)",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "0 1rem",
            borderRadius: 12,
            border: "none",
            background: "rgba(255,255,255,0.25)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Buscar
        </button>
      </form>

      {open && (
        <div
          id="busca-listbox"
          role="listbox"
          // Al salir el mouse de la lista ninguna sugerencia queda resaltada: tocar
          // "Buscar" busca lo escrito en la barra, no la última que se pasó por encima.
          onMouseLeave={() => setActiveIdx(-1)}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {loading && (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ padding: "0.7rem 1rem", display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={skeletonStyle(16, 16, "50%")} />
                  <div style={skeletonStyle(12, `${55 + i * 15}%`)} />
                </div>
              ))}
            </>
          )}

          {!loading && !hasResults && (
            <div
              role="option"
              aria-selected={false}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => goFreeText(query)}
              style={{ padding: "0.75rem 1rem", display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}
            >
              <span aria-hidden="true" style={{ fontSize: "0.9rem", opacity: 0.5 }}>🔍</span>
              <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                Buscar &ldquo;<strong style={{ color: "#1e293b" }}>{query}</strong>&rdquo; em todos os anúncios
              </span>
            </div>
          )}

          {!loading && items.map((item, i) => (
            <SuggestionItem
              key={item.href}
              id={`busca-item-${i}`}
              active={activeIdx === i}
              onSelect={() => selectSuggestion(item)}
              onHover={() => setActiveIdx(i)}
            >
              <span aria-hidden="true" style={{ fontSize: "0.9rem", opacity: 0.5, flexShrink: 0 }}>🔍</span>
              <span style={{
                flex: 1,
                minWidth: 0,
                fontSize: "0.9rem",
                color: "#475569",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {highlight(item.label, query)}
              </span>
              {item.hint ? (
                <span style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}>
                  em {item.hint}
                </span>
              ) : isChosenTerm(item) ? null : (
                // Señal de que el término completa la barra (estilo Mercado Livre).
                // El término ya elegido no la lleva: tocarlo busca, no completa.
                <span aria-hidden="true" style={{ fontSize: "0.85rem", color: "#94a3b8", flexShrink: 0 }}>
                  ↖
                </span>
              )}
            </SuggestionItem>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionItem({
  id, active, onSelect, onHover, children,
}: {
  id: string;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      // pointerdown solo evita que el input pierda el foco (en móvil el teclado sigue
      // abierto). La elección va en el click: así el toque se consume acá y no cae en el
      // banner de abajo, y arrastrar el dedo para deslizar la lista ya no navega.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.6rem 1rem",
        cursor: "pointer",
        background: active ? "var(--blue-xlight)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {children}
    </div>
  );
}

function skeletonStyle(height: number, width: number | string, borderRadius: number | string = 6): React.CSSProperties {
  return {
    height,
    width,
    borderRadius,
    background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
    backgroundSize: "200% 100%",
    animation: "skeleton-shimmer 1.2s infinite linear",
  };
}
