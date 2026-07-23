"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import ListingCard from "../../components/ListingCard";
import ListingsFeed from "../../components/ListingsFeed";
import BuscaAutocomplete from "../../components/BuscaAutocomplete";
import {
  getCategoriesSync,
  loadCategories,
  getSubcategoriesSync,
  loadSubcategories,
} from "../../lib/catalogCache";

const SLUG_ICON_FALLBACK: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

// T11: `initialDefault` es el listado default (created_at desc) renderizado en el
// servidor por app/listings/page.tsx (Server Component ISR). Se usa para pintar cards en
// el primer HTML sin esperar la hidratación.
export default function ListingsClient({ initialDefault }: { initialDefault: any[] }) {
  return (
    <Suspense fallback={<ListingsFallback initialDefault={initialDefault} />}>
      <ListingsContent initialDefault={initialDefault} />
    </Suspense>
  );
}

// Fallback del Suspense: replica el markup del primer render de la vista default
// (header + fila Ordenar/Filtrar + grid) para que el swap al hidratar sea invisible.
function ListingsFallback({ initialDefault }: { initialDefault: any[] }) {
  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Todos os anúncios</h1>
      </header>

      <div style={{ borderBottom: "1px solid var(--border)", background: "#fff", padding: "0.6rem 1rem", display: "flex", justifyContent: "flex-end", gap: 10, minHeight: 52 }}>
        <span style={fallbackPill}>Ordenar ▾</span>
        <span style={fallbackPill}>Filtrar ▾</span>
      </div>

      <div style={{ padding: "0.35rem 0 0.75rem" }}>
        <div className="listing-grid">
          {initialDefault.map((l) => (
            <ListingCard key={l.id} listing={l} sessionExists={false} isFavorite={false} busy={false} onToggleFavorite={async () => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ListingsContent({ initialDefault }: { initialDefault: any[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categorySlug = searchParams.get("category") ?? "";
  const searchQuery = searchParams.get("q") ?? "";
  const subcategoryId = searchParams.get("subcategory_id") ?? "";
  const isSearch = !!searchQuery && !categorySlug;

  const [categoryLabel, setCategoryLabel] = useState("");
  const [subcategoryLabel, setSubcategoryLabel] = useState("");

  // Etiqueta de categoría para el header y el badge (caché de sesión, sin RTT extra).
  useEffect(() => {
    if (!categorySlug) { setCategoryLabel(""); return; }
    const resolve = (cats: { slug: string; name: string; icon: string | null }[]) => {
      const cat = cats.find((c) => c.slug === categorySlug);
      setCategoryLabel(cat ? `${cat.icon || SLUG_ICON_FALLBACK[categorySlug] || "📌"} ${cat.name}` : "");
    };
    const sync = getCategoriesSync();
    if (sync) { resolve(sync); return; }
    let mounted = true;
    loadCategories().then((cats) => { if (mounted) resolve(cats); });
    return () => { mounted = false; };
  }, [categorySlug]);

  // Etiqueta de subcategoría para el badge.
  useEffect(() => {
    if (!subcategoryId) { setSubcategoryLabel(""); return; }
    const id = Number(subcategoryId);
    const sync = getSubcategoriesSync();
    if (sync) { setSubcategoryLabel(sync.find((s) => s.id === id)?.name ?? ""); return; }
    let mounted = true;
    loadSubcategories().then((subs) => { if (mounted) setSubcategoryLabel(subs.find((s) => s.id === id)?.name ?? ""); });
    return () => { mounted = false; };
  }, [subcategoryId]);

  const pageTitle = categorySlug ? categoryLabel || "Anúncios" : "Todos os anúncios";

  // Volver: normalmente la pantalla anterior. Excepción: se llegó desde una sugerencia de
  // subcategoría del buscador (from=busca), que salta el paso de la lista de subcategorías;
  // ahí volver muestra primero esa lista y recién el siguiente toque vuelve al inicio.
  // Se usa replace para no dejar los anuncios en el historial (si no, volver rebotaría).
  const goBack = () => {
    if (searchParams.get("from") === "busca" && categorySlug) {
      router.replace(`/category/${categorySlug}`);
    } else {
      router.back();
    }
  };

  return (
    <div className="page-body">
      {isSearch ? (
        // Reforma 9: resultados de búsqueda → flecha para volver + barra editable con el
        // término ya escrito. Buscar de nuevo reemplaza los resultados en esta pantalla.
        <header
          style={{
            background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
            padding: "0.875rem 1rem",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Voltar"
              style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
            >
              ←
            </button>
            <BuscaAutocomplete defaultValue={searchQuery} flush />
          </div>
        </header>
      ) : (
        // Volver = página anterior (ej. la lista de subcategorías), no siempre el inicio.
        // La categoría (y la subcategoría, separada por una barra) van en el propio banner.
        <header className="page-header">
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            style={{ background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 }}
          >
            ←
          </button>
          <h1 style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pageTitle}</span>
            {subcategoryId && subcategoryLabel && (
              <>
                <span aria-hidden="true" style={{ opacity: 0.5, fontWeight: 400, flexShrink: 0 }}>|</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{subcategoryLabel}</span>
              </>
            )}
          </h1>
        </header>
      )}

      <ListingsFeed
        initialData={initialDefault}
        defaultOrder="recent"
        namespace=""
        categorySlug={categorySlug}
        searchQuery={searchQuery}
        subcategoryId={subcategoryId}
      />
    </div>
  );
}

const fallbackPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.45rem 0.9rem",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "#fff",
  color: "#334155",
  fontWeight: 600,
  fontSize: "0.82rem",
};
