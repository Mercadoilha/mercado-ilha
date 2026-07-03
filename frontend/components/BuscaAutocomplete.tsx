"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

// Tres tipos de sugerencia, en este orden de prioridad:
//  - "term": la búsqueda particular (texto). Primera y más específica.
//            Ej.: "iph" → "iphone" → muestra solo iphones.
//  - "category" / "subcategory": relacionadas, para llevar a más anuncios
//            (estimular el scroll). Se deducen de los anuncios que coinciden.
type Suggestion = {
  label: string;
  href: string;
  hint: string; // etiqueta a la derecha; "" = sin etiqueta (término particular)
};

const cache = new Map<string, Suggestion[]>();

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Ordena las palabras de los títulos que contienen `word`, mejores primero:
// coincidencia exacta > más frecuente > más corta.
// Ej.: títulos con "iPhone 13", "iPhone Pro" + word="iph" → ["iphone", ...].
function rankCompletions(titles: string[], word: string): string[] {
  const count = new Map<string, number>();
  for (const title of titles) {
    for (const raw of title.split(/[\s,.;:/()\-–—|@#!?"']+/)) {
      const w = raw.toLowerCase();
      if (w.length < 2 || w.length > 24) continue;
      if (/^\d+$/.test(w)) continue; // ignorar números sueltos
      if (!w.includes(word)) continue;
      count.set(w, (count.get(w) ?? 0) + 1);
    }
  }
  return [...count.entries()]
    .sort((a, b) => {
      const ea = a[0] === word ? 1 : 0;
      const eb = b[0] === word ? 1 : 0;
      if (ea !== eb) return eb - ea; // el término exacto primero
      if (b[1] !== a[1]) return b[1] - a[1]; // luego el más frecuente
      return a[0].length - b[0].length; // luego el más corto
    })
    .map((e) => e[0]);
}

async function fetchSuggestions(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const key = norm(q);
  if (cache.has(key)) return cache.get(key)!;

  const ql = key;
  const like = `%${q}%`;

  const [listRes, catRes, subRes] = await Promise.all([
    // Anuncios que coinciden por título: de aquí salen los términos
    // particulares y las categorías/subcategorías relacionadas.
    supabase
      .from("listings")
      .select("title, categories:category_id(name, slug), subcategories:subcategory_id(id, name, categories(name, slug))")
      .eq("status", "active")
      .ilike("title", like)
      .limit(20)
      .abortSignal(signal),
    // Coincidencia directa por nombre de categoría (ej. escribir "celul").
    supabase
      .from("categories")
      .select("name, slug")
      .ilike("name", like)
      .eq("is_active", true)
      .limit(5)
      .abortSignal(signal),
    // Coincidencia directa por nombre de subcategoría.
    supabase
      .from("subcategories")
      .select("id, name, categories(name, slug)")
      .ilike("name", like)
      .limit(5)
      .abortSignal(signal),
  ]);

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  // Títulos que coinciden → de aquí sale la búsqueda particular.
  const titles: string[] = [];
  // Categorías relacionadas (por los anuncios que coinciden + match directo).
  const catMap = new Map<string, { label: string; slug: string; count: number }>();
  // Subcategorías relacionadas.
  const subMap = new Map<string, { label: string; href: string; hint: string; count: number }>();

  for (const row of listRes.data ?? []) {
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
        href: `/listings?category=${subParentSlug}&subcategory_id=${sub.id}`,
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
      href: `/listings?category=${parentSlug}&subcategory_id=${ss.id}`,
      hint: ss.categories?.name ?? "Categoria",
      count: 0,
    };
    e.count += 0.5;
    subMap.set(k, e);
  }

  const seen = new Set<string>();
  const result: Suggestion[] = [];
  const add = (s: Suggestion) => {
    const k = norm(s.label);
    if (!k || seen.has(k)) return;
    seen.add(k);
    result.push(s);
  };

  // 1) Búsqueda particular (primera y más específica).
  const words = ql.split(/\s+/).filter((w) => w.length >= 2);
  const firstWord = words[0] ?? ql;
  const comps = rankCompletions(titles, firstWord);
  if (words.length > 1) {
    // Frase completa ("iphone 13") → resultados EXACTOS de lo escrito.
    add({ label: ql, href: `/listings?q=${encodeURIComponent(q.trim())}`, hint: "" });
    // Y la versión amplia ("iphone") para explorar más anuncios.
    if (comps[0]) add({ label: comps[0], href: `/listings?q=${encodeURIComponent(comps[0])}`, hint: "" });
  } else {
    // Fragmento ("iph") → completar al término real ("iphone").
    const term = comps[0] ?? ql;
    add({ label: term, href: `/listings?q=${encodeURIComponent(term)}`, hint: "" });
  }

  // 2) Categorías relacionadas (máx 3).
  const cats = [...catMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  for (const c of cats) {
    add({ label: c.label, href: `/listings?category=${c.slug}`, hint: "Categoria" });
  }

  // 3) Subcategorías relacionadas (máx 3).
  const subs = [...subMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  for (const s of subs) {
    add({ label: s.label, href: s.href, hint: s.hint });
  }

  const final = result.slice(0, 8);
  if (final.length > 0) cache.set(key, final);
  return final;
}

// Resalta en negrita la parte del término que coincide con lo escrito.
function highlight(term: string, q: string) {
  const idx = term.toLowerCase().indexOf(q.trim().toLowerCase());
  if (idx < 0 || !q.trim()) return <>{term}</>;
  const end = idx + q.trim().length;
  return (
    <>
      {term.slice(0, idx)}
      <strong style={{ fontWeight: 700, color: "#1e293b" }}>{term.slice(idx, end)}</strong>
      {term.slice(end)}
    </>
  );
}

export default function BuscaAutocomplete({ defaultValue = "" }: { defaultValue?: string }) {
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
    timerRef.current = setTimeout(() => runSearch(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, runSearch]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function goHref(href: string) {
    setOpen(false);
    router.push(href);
  }

  // Enter sin sugerencia elegida → búsqueda de texto amplia (título + descripción).
  function goFreeText(term: string) {
    const q = term.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/listings?q=${encodeURIComponent(q)}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && items[activeIdx]) {
      goHref(items[activeIdx].href);
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
    <div ref={containerRef} style={{ position: "relative", marginTop: "0.875rem" }}>
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
            placeholder="O que você procura?"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (query.length >= 2 && hasResults) setOpen(true); }}
            style={{
              width: "100%",
              padding: "0.7rem 0.875rem 0.7rem 2.5rem",
              borderRadius: open ? "12px 12px 0 0" : 12,
              border: "none",
              fontSize: "0.95rem",
              background: "rgba(255,255,255,0.95)",
              color: "#0f172a",
              outline: "none",
              transition: "border-radius 0.1s",
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
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: "0 0 14px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
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
              onPointerDown={(e) => { e.preventDefault(); goFreeText(query); }}
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
              onSelect={() => goHref(item.href)}
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
              {item.hint && (
                <span style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}>
                  em {item.hint}
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
      onPointerDown={(e) => { e.preventDefault(); onSelect(); }}
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
