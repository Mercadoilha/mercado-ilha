"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const SLUG_ICON: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

type ListingSuggestion = {
  kind: "listing";
  id: string;
  title: string;
  price: number | null;
  price_text: string | null;
  categoryName: string;
};

type CategorySuggestion = {
  kind: "category";
  name: string;
  slug: string;
  icon: string | null;
};

type Suggestion = ListingSuggestion | CategorySuggestion;

const cache = new Map<string, { listings: ListingSuggestion[]; categories: CategorySuggestion[] }>();

async function fetchSuggestions(
  q: string,
  signal: AbortSignal
): Promise<{ listings: ListingSuggestion[]; categories: CategorySuggestion[] }> {
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const like = `%${q}%`;

  const [listRes, catRes, subRes] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, price, price_text, categories(name, slug)")
      .eq("status", "active")
      .ilike("title", like)
      .limit(5)
      .abortSignal(signal),
    supabase
      .from("categories")
      .select("name, slug, icon")
      .ilike("name", like)
      .eq("is_active", true)
      .limit(3)
      .abortSignal(signal),
    supabase
      .from("subcategories")
      .select("name, slug, categories(slug, icon)")
      .ilike("name", like)
      .limit(3)
      .abortSignal(signal),
  ]);

  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const listings: ListingSuggestion[] = (listRes.data ?? []).map((r: any) => ({
    kind: "listing",
    id: r.id,
    title: r.title,
    price: r.price ?? null,
    price_text: r.price_text ?? null,
    categoryName: r.categories?.name ?? "",
  }));

  const catSlugs = new Set<string>();
  const categories: CategorySuggestion[] = [];

  for (const c of catRes.data ?? []) {
    if (!catSlugs.has(c.slug)) {
      catSlugs.add(c.slug);
      categories.push({ kind: "category", name: c.name, slug: c.slug, icon: c.icon });
    }
  }
  for (const s of subRes.data ?? []) {
    const parentSlug = (s as any).categories?.slug;
    const icon = (s as any).categories?.icon ?? null;
    if (parentSlug && !catSlugs.has(s.slug)) {
      catSlugs.add(s.slug);
      categories.push({ kind: "category", name: s.name, slug: parentSlug, icon });
    }
    if (categories.length >= 3) break;
  }

  const result = { listings, categories: categories.slice(0, 3) };
  if (result.listings.length > 0 || result.categories.length > 0) {
    cache.set(key, result);
  }
  return result;
}

function priceLabel(l: ListingSuggestion) {
  if (l.price != null)
    return `R$ ${Number(l.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return l.price_text ?? "";
}

export default function BuscaAutocomplete({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listings, setListings] = useState<ListingSuggestion[]>([]);
  const [cats, setCats] = useState<CategorySuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const allItems: Suggestion[] = [...listings, ...cats];

  const runSearch = useCallback((q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetchSuggestions(q, ctrl.signal)
      .then(({ listings: l, categories: c }) => {
        setListings(l);
        setCats(c);
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
      setListings([]);
      setCats([]);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && allItems[activeIdx]) {
      selectItem(allItems[activeIdx]);
      return;
    }
    const q = query.trim();
    if (q) {
      setOpen(false);
      router.push(`/listings?q=${encodeURIComponent(q)}`);
    }
  }

  function selectItem(item: Suggestion) {
    setOpen(false);
    if (item.kind === "listing") {
      router.push(`/listings/${item.id}`);
    } else {
      router.push(`/listings?category=${item.slug}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const hasResults = listings.length > 0 || cats.length > 0;

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
                <div key={i} style={{ padding: "0.75rem 1rem", display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={skeletonStyle(20, 20, "50%")} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={skeletonStyle(12, `${60 + i * 15}%`)} />
                    <div style={skeletonStyle(10, "40%")} />
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && !hasResults && (
            <div style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)", textAlign: "center" }}>
              Nenhum resultado para &ldquo;<strong>{query}</strong>&rdquo;
            </div>
          )}

          {!loading && listings.length > 0 && (
            <>
              <GroupLabel label="Anúncios" />
              {listings.map((item, i) => (
                <SuggestionItem
                  key={item.id}
                  id={`busca-item-${i}`}
                  active={activeIdx === i}
                  onSelect={() => selectItem(item)}
                  onHover={() => setActiveIdx(i)}
                >
                  <span style={{ fontSize: "1rem" }}>🏷️</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 1 }}>
                      {priceLabel(item) && (
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--blue-main)" }}>
                          {priceLabel(item)}
                        </span>
                      )}
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.categoryName}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#cbd5e1", flexShrink: 0 }}>›</span>
                </SuggestionItem>
              ))}
            </>
          )}

          {!loading && cats.length > 0 && (
            <>
              {listings.length > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 1rem" }} />}
              <GroupLabel label="Categorias" />
              {cats.map((item, i) => {
                const idx = listings.length + i;
                const icon = item.icon ?? SLUG_ICON[item.slug] ?? "📌";
                return (
                  <SuggestionItem
                    key={item.slug + item.name}
                    id={`busca-item-${idx}`}
                    active={activeIdx === idx}
                    onSelect={() => selectItem(item)}
                    onHover={() => setActiveIdx(idx)}
                  >
                    <span style={{ fontSize: "1rem" }}>{icon}</span>
                    <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>
                      {item.name}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
                      Ver todos →
                    </span>
                  </SuggestionItem>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: "0.4rem 1rem 0.2rem", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
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
