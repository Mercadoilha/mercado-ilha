"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type ExtraCategoryEntry = { categoryId: string; subcategoryId: string; hasSubcats?: boolean };

type Cat = { id: number; name: string };
type Sub = { id: number; name: string };

type Props = {
  categories: Cat[];
  primaryCategoryId: string;
  entries: ExtraCategoryEntry[];
  onChange: (entries: ExtraCategoryEntry[]) => void;
  max?: number;
};

// Sección "Aparecer também em": categorías/subcategorías SECUNDARIAS del anuncio (solo
// para descubrimiento). Reutiliza las clases del formulario (form-group, form-select, card).
export default function ExtraCategoriesPicker({ categories, primaryCategoryId, entries, onChange, max = 4 }: Props) {
  const [subcatCache, setSubcatCache] = useState<Record<number, Sub[]>>({});

  // Cargar subcategorías de las categorías elegidas que aún no estén en cache.
  useEffect(() => {
    const need = Array.from(
      new Set(entries.map((e) => Number(e.categoryId)).filter((id) => id && !(id in subcatCache)))
    );
    if (need.length === 0) return;
    let active = true;
    Promise.all(
      need.map((id) =>
        supabase
          .from("subcategories")
          .select("id,name")
          .eq("category_id", id)
          .eq("is_active", true)
          .order("sort_order")
          .then(({ data }) => [id, (data ?? []) as Sub[]] as const)
      )
    ).then((pairs) => {
      if (!active) return;
      setSubcatCache((prev) => {
        const next = { ...prev };
        for (const [id, subs] of pairs) next[id] = subs;
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [entries, subcatCache]);

  // Reflejar en cada entrada si su categoría tiene subcategorías (para la validación del padre).
  useEffect(() => {
    let changed = false;
    const next = entries.map((e) => {
      const id = Number(e.categoryId);
      if (id && id in subcatCache) {
        const hs = subcatCache[id].length > 0;
        if (e.hasSubcats !== hs) {
          changed = true;
          return { ...e, hasSubcats: hs };
        }
      }
      return e;
    });
    if (changed) onChange(next);
  }, [subcatCache, entries, onChange]);

  const update = (i: number, patch: Partial<ExtraCategoryEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const addEntry = () => onChange([...entries, { categoryId: "", subcategoryId: "" }]);
  const removeEntry = (i: number) => onChange(entries.filter((_, idx) => idx !== i));

  return (
    <div className="card" style={{ padding: "0.875rem" }}>
      <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 4 }}>
        Aparecer também em <span className="text-muted" style={{ fontWeight: 500 }}>(opcional)</span>
      </p>
      <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: 10 }}>
        Mostre seu anúncio em outras categorias sem precisar publicar de novo.
      </p>

      {entries.map((entry, i) => {
        const chosen = new Set(
          entries.map((e, idx) => (idx !== i ? e.categoryId : "")).filter(Boolean)
        );
        const catOptions = categories.filter(
          (c) => String(c.id) !== primaryCategoryId && !chosen.has(String(c.id))
        );
        const subs = entry.categoryId ? subcatCache[Number(entry.categoryId)] : undefined;
        return (
          <div
            key={i}
            style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", marginBottom: 8 }}
          >
            <div className="form-group" style={{ marginBottom: subs && subs.length > 0 ? 8 : 0 }}>
              <label className="form-label">Categoria</label>
              <select
                className="form-select"
                value={entry.categoryId}
                onChange={(e) => update(i, { categoryId: e.target.value, subcategoryId: "", hasSubcats: undefined })}
              >
                <option value="">Selecione...</option>
                {catOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {subs && subs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Subcategoria *</label>
                <select
                  className="form-select"
                  value={entry.subcategoryId}
                  onChange={(e) => update(i, { subcategoryId: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {subs.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => removeEntry(i)}
              style={{ marginTop: 8, background: "none", border: "none", color: "#dc2626", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", padding: 0 }}
            >
              ✕ Remover
            </button>
          </div>
        );
      })}

      {entries.length < max && (
        <button
          type="button"
          onClick={addEntry}
          style={{ width: "100%", padding: "0.6rem", borderRadius: 8, border: "2px dashed var(--blue-light)", background: "var(--blue-xlight)", color: "var(--blue-main)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}
        >
          + Adicionar categoria <span style={{ fontWeight: 500 }}>(até {max})</span>
        </button>
      )}
    </div>
  );
}
