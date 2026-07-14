import Link from "next/link";

// Los dos bloques de categorías del home histórico, ahora en /categorias (Reforma 5).
// Bloque 1 (Categorias Destacadas, botones rectangulares) + Bloque 2 (secciones
// temáticas, grid). Se conservan LONG_NAME_SLUGS, categoryHref() y los estilos originales.

// Nomes com palavra única muito longa que não cabe em 3 colunas no tamanho padrão.
const LONG_NAME_SLUGS = new Set(["bioconstrucao", "electrodomesticos"]);

const SLUG_ICON: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
  "babas": "🧸",
};

function categoryHref(cat: any) {
  const hasSubs = (cat.subcategories ?? []).some((s: any) => s.is_active);
  return hasSubs ? `/category/${cat.slug}` : `/listings?category=${cat.slug}`;
}

export default function CategoriesBlocks({ categories }: { categories: any[] }) {
  return (
    <section style={{ padding: "0.75rem 1rem 0" }}>
      {/* Bloque 1: Categorias Destacadas */}
      {(() => {
        const featured = categories.filter((c: any) => c.home_sections?.is_featured_block);
        if (featured.length === 0) return null;
        return (
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.625rem", color: "#1e293b" }}>
              Categorias Destacadas
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {featured.map((cat: any) => (
                <Link
                  key={cat.slug}
                  href={categoryHref(cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1rem",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "#1e293b",
                  }}
                >
                  <span style={{ fontSize: "1.5rem", lineHeight: 1, flexShrink: 0 }}>
                    {cat.icon || SLUG_ICON[cat.slug] || "📌"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{cat.name}</div>
                    {cat.description && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cat.description}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "1rem", color: "#cbd5e1" }}>›</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Bloque 2: Secciones temáticas */}
      {(() => {
        const withSection = categories.filter((c: any) => c.home_sections && !c.home_sections.is_featured_block);
        const sectionsMap = new Map<number, { section: any; cats: any[] }>();
        withSection.forEach((cat: any) => {
          const s = cat.home_sections;
          if (!sectionsMap.has(s.id)) sectionsMap.set(s.id, { section: s, cats: [] });
          sectionsMap.get(s.id)!.cats.push(cat);
        });
        const sortedSections = [...sectionsMap.values()].sort((a, b) => a.section.sort_order - b.section.sort_order);
        return sortedSections.map(({ section, cats }) => (
          <div key={section.id} style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {section.title}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {cats.map((cat: any) => (
                <Link
                  key={cat.slug}
                  href={categoryHref(cat)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "0.75rem 0.25rem",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    color: "#1e293b",
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{cat.icon || SLUG_ICON[cat.slug] || "📌"}</span>
                  <span
                    style={
                      LONG_NAME_SLUGS.has(cat.slug)
                        ? { fontSize: "0.72rem", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }
                        : { fontSize: "0.75rem", fontWeight: 600, textAlign: "center", lineHeight: 1.2, overflowWrap: "break-word", maxWidth: "100%" }
                    }
                  >
                    {cat.name}
                  </span>
                  {cat.description && (
                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.2, marginTop: -2, overflowWrap: "break-word", wordBreak: "break-word", maxWidth: "100%" }}>
                      {cat.description}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ));
      })()}
    </section>
  );
}
