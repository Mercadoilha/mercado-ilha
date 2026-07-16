"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomSheet from "../../components/BottomSheet";
import { fold } from "../../lib/searchNorm";
import { getLocalitiesSync, loadLocalities, type CatalogLocality } from "../../lib/catalogCache";
import { fetchStores, LOJAS_PAGE_SIZE, type Store, type StoreSort } from "../../lib/lojasApi";

const SORT_OPTIONS: { key: StoreSort; label: string }[] = [
  { key: "count", label: "Mais anúncios" },
  { key: "popular", label: "Mais procuradas" },
  { key: "name", label: "Nome (A–Z)" },
];

// Caché en memoria de sugerencias por nombre ya buscado (instantáneas al repetir).
const suggCache = new Map<string, Store[]>();

export default function LojasClient() {
  const router = useRouter();

  // Buscador + sugerencias.
  const [query, setQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [suggLoading, setSuggLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Store[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Orden / filtro.
  const [sort, setSort] = useState<StoreSort>("count");
  const [localityId, setLocalityId] = useState<number | null>(null);
  const [ordenarOpen, setOrdenarOpen] = useState(false);
  const [filtrarOpen, setFiltrarOpen] = useState(false);
  const [localities, setLocalities] = useState<CatalogLocality[]>([]);

  // Listado.
  const [stores, setStores] = useState<Store[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0); // "Tentar novamente" → repite la carga

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggAbortRef = useRef<AbortController | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);

  const localityName = useMemo(() => {
    const m = new Map<number, string>();
    localities.forEach((l) => m.set(l.id, l.name));
    return m;
  }, [localities]);

  // Localidades: caché de sesión, carga única (chips de las cards + filtro por lugar).
  useEffect(() => {
    const sync = getLocalitiesSync();
    if (sync) { setLocalities(sync); return; }
    let mounted = true;
    loadLocalities().then((locs) => { if (mounted) setLocalities(locs); });
    return () => { mounted = false; };
  }, []);

  // Sugerencias de nombres mientras se escribe (mismo patrón que el buscador de
  // productos): debounce 300ms, caché, cancelación de consultas viejas.
  const runSuggest = useCallback((q: string) => {
    const key = fold(q.trim());
    if (suggCache.has(key)) {
      setSuggestions(suggCache.get(key)!);
      setActiveIdx(-1);
      setOpen(true);
      return;
    }
    if (suggAbortRef.current) suggAbortRef.current.abort();
    const ctrl = new AbortController();
    suggAbortRef.current = ctrl;
    setSuggLoading(true);
    fetchStores({ search: q, sort: "count", limit: 6, signal: ctrl.signal })
      .then((rows) => {
        if (rows.length > 0) suggCache.set(key, rows);
        setSuggestions(rows);
        setActiveIdx(-1);
        setOpen(true);
      })
      .catch(() => {/* aborted — ignore */})
      .finally(() => setSuggLoading(false));
  }, []);

  useEffect(() => {
    if (suggTimerRef.current) clearTimeout(suggTimerRef.current);
    if (query.trim().length < 2) {
      setOpen(false);
      setSuggestions([]);
      setSuggLoading(false);
      if (suggAbortRef.current) suggAbortRef.current.abort();
      return;
    }
    suggTimerRef.current = setTimeout(() => runSuggest(query), 300);
    return () => { if (suggTimerRef.current) clearTimeout(suggTimerRef.current); };
  }, [query, runSuggest]);

  // Cerrar el dropdown al tocar afuera.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Listado: se recarga desde cero cuando cambian búsqueda aplicada / orden / filtro.
  useEffect(() => {
    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;
    setListLoading(true);
    setListError(null);
    fetchStores({ search: appliedSearch, localityId, sort, limit: LOJAS_PAGE_SIZE, offset: 0, signal: ctrl.signal })
      .then((rows) => {
        setStores(rows);
        setHasMore(rows.length >= LOJAS_PAGE_SIZE);
        setListLoading(false);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setListError("Não foi possível carregar as lojas.");
        setListLoading(false);
      });
    return () => ctrl.abort();
  }, [appliedSearch, localityId, sort, reloadKey]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await fetchStores({
        search: appliedSearch,
        localityId,
        sort,
        limit: LOJAS_PAGE_SIZE,
        offset: stores.length,
      });
      setStores((prev) => [...prev, ...rows]);
      setHasMore(rows.length >= LOJAS_PAGE_SIZE);
    } catch {
      setListError("Não foi possível carregar mais lojas.");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, appliedSearch, localityId, sort, stores.length]);

  // Enter / botão buscar (sem escolher sugestão): filtra a lista com o texto escrito.
  function submitSearch(term: string) {
    setOpen(false);
    setAppliedSearch(term.trim());
    inputRef.current?.blur();
  }

  function goStore(id: string) {
    setOpen(false);
    router.push(`/store/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIdx >= 0 && suggestions[activeIdx]) { goStore(suggestions[activeIdx].id); return; }
    submitSearch(query);
  }

  const activeSortLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "";

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <button
          type="button"
          onClick={() => router.back()}
          style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
        >←</button>
        <h1>Lojas da ilha</h1>
      </header>

      {/* Busca + sugestões */}
      <div style={{ background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)", padding: "1rem" }}>
        <div ref={containerRef} style={{ position: "relative" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span aria-hidden="true" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", fontSize: "1rem", pointerEvents: "none" }}>🔍</span>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                placeholder="Buscar loja pelo nome…"
                value={query}
                autoComplete="off"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
                style={{ width: "100%", padding: "0.7rem 0.875rem 0.7rem 2.5rem", borderRadius: 12, border: "none", fontSize: "0.95rem", background: "rgba(255,255,255,0.95)", color: "#0f172a", outline: "none" }}
              />
            </div>
            <button type="submit" style={{ padding: "0 1rem", borderRadius: 12, border: "none", background: "rgba(255,255,255,0.25)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
              Buscar
            </button>
          </form>

          {open && (query.trim().length >= 2) && (
            <div role="listbox" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: "#fff", borderRadius: 14, boxShadow: "0 10px 28px rgba(0,0,0,0.18)", zIndex: 100, overflow: "hidden", maxHeight: "60vh", overflowY: "auto" }}>
              {suggLoading && suggestions.length === 0 && (
                <div style={{ padding: "0.85rem 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>Buscando…</div>
              )}
              {!suggLoading && suggestions.length === 0 && (
                <div
                  role="option"
                  aria-selected={false}
                  onPointerDown={(e) => { e.preventDefault(); submitSearch(query); }}
                  style={{ padding: "0.75rem 1rem", fontSize: "0.9rem", color: "#475569", cursor: "pointer" }}
                >
                  Nenhuma loja com esse nome — toque para buscar mesmo assim
                </div>
              )}
              {suggestions.map((s, i) => (
                <div
                  key={s.id}
                  role="option"
                  aria-selected={activeIdx === i}
                  onPointerDown={(e) => { e.preventDefault(); goStore(s.id); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 1rem", cursor: "pointer", background: activeIdx === i ? "var(--blue-xlight)" : "transparent" }}
                >
                  <span aria-hidden="true" style={{ fontSize: "0.9rem", opacity: 0.5, flexShrink: 0 }}>🏪</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "0.9rem", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {highlight(s.full_name, query)}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {s.active_count} {s.active_count === 1 ? "anúncio" : "anúncios"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ordenar / Filtrar */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "#fff", padding: "0.6rem 1rem", display: "flex", justifyContent: "flex-end", gap: 10, minHeight: 52 }}>
        <button type="button" onClick={() => setOrdenarOpen(true)} style={pillBtn(sort !== "count")}>
          {sort === "count" ? "Ordenar" : `Ordenar: ${activeSortLabel}`} <span aria-hidden="true" style={{ fontSize: "0.7rem" }}>▾</span>
        </button>
        <button type="button" onClick={() => setFiltrarOpen(true)} style={pillBtn(localityId != null)}>
          {localityId != null ? (localityName.get(localityId) ?? "Filtrar") : "Filtrar"} <span aria-hidden="true" style={{ fontSize: "0.7rem" }}>▾</span>
        </button>
      </div>

      {/* Lista de lojas */}
      <div style={{ padding: "0.6rem 1rem 1rem" }}>
        {/* Si ya hay lojas en pantalla el error viene de "Ver mais lojas": ese mismo
            botón sigue abajo para reintentar, no hace falta otro. */}
        {listError && stores.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", background: "#fff", borderRadius: 12 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📡</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{listError}</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Verifique sua conexão e tente de novo.
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{ padding: "0.7rem 1.5rem", borderRadius: 10, border: "none", background: "var(--blue-main)", color: "#fff", fontWeight: 700, fontSize: "0.9rem", fontFamily: "inherit", cursor: "pointer" }}
            >
              Tentar novamente
            </button>
          </div>
        ) : listError ? (
          <p className="text-error" style={{ margin: "0 0 8px" }}>{listError}</p>
        ) : null}

        {listLoading && stores.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>
        )}

        {!listLoading && stores.length === 0 && !listError && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", background: "#fff", borderRadius: 12, color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔦</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Nenhuma loja encontrada</p>
            <p style={{ fontSize: "0.875rem" }}>Tente outro nome ou lugar.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {stores.map((s) => (
            <StoreRow key={s.id} store={s} localityName={localityName} onOpen={() => router.push(`/store/${s.id}`)} />
          ))}
        </div>

        {hasMore && stores.length > 0 && (
          <div style={{ textAlign: "center", padding: "1.25rem 0 0.5rem" }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              style={{ width: "100%", maxWidth: 320, padding: "0.7rem 1rem", borderRadius: 10, border: "1px solid var(--blue-main)", background: "#fff", color: "var(--blue-main)", fontWeight: 700, fontSize: "0.9rem", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1 }}
            >
              {loadingMore ? "Carregando…" : "Ver mais lojas"}
            </button>
          </div>
        )}
      </div>

      {/* Hoja Ordenar */}
      {ordenarOpen && (
        <BottomSheet title="Ordenar" onClose={() => setOrdenarOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { setSort(opt.key); setOrdenarOpen(false); }}
                  style={sheetRow(active)}
                >
                  <span>{opt.label}</span>
                  <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: active ? "6px solid var(--blue-main)" : "2px solid var(--border)", background: "#fff" }} />
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* Hoja Filtrar (por lugar) */}
      {filtrarOpen && (
        <BottomSheet title="Filtrar por lugar" onClose={() => setFiltrarOpen(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "55vh", overflowY: "auto" }}>
            <button type="button" onClick={() => { setLocalityId(null); setFiltrarOpen(false); }} style={sheetRow(localityId == null)}>
              <span>Todos os lugares</span>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: localityId == null ? "6px solid var(--blue-main)" : "2px solid var(--border)", background: "#fff" }} />
            </button>
            {localities.map((l) => {
              const active = localityId === l.id;
              return (
                <button key={l.id} type="button" onClick={() => { setLocalityId(l.id); setFiltrarOpen(false); }} style={sheetRow(active)}>
                  <span>{l.name}</span>
                  <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, border: active ? "6px solid var(--blue-main)" : "2px solid var(--border)", background: "#fff" }} />
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// Card de tienda: ancho completo, toda la card navega a /store/[id].
function StoreRow({ store, localityName, onOpen }: { store: Store; localityName: Map<number, string>; onOpen: () => void }) {
  const names = store.locality_ids.map((id) => localityName.get(id)).filter(Boolean) as string[];
  const shown = names.slice(0, 3);
  const extra = names.length - shown.length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ display: "flex", gap: "0.75rem", background: "#fff", borderRadius: 12, border: "1px solid var(--border)", padding: "0.75rem", alignItems: "center", cursor: "pointer" }}
    >
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: store.avatar_url ? "#fff" : "var(--blue-xlight)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", overflow: "hidden", flexShrink: 0, position: "relative" }}>
        {store.avatar_url ? (
          <Image src={store.avatar_url} alt={store.full_name} fill sizes="56px" style={{ objectFit: "cover" }} />
        ) : "🏪"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {store.full_name}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--blue-main)", fontWeight: 600, marginTop: 2 }}>
          {store.active_count} {store.active_count === 1 ? "anúncio" : "anúncios"}
        </div>
        {shown.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {shown.map((n) => (
              <span key={n} style={{ fontSize: "0.68rem", color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "1px 8px" }}>{n}</span>
            ))}
            {extra > 0 && (
              <span style={{ fontSize: "0.68rem", color: "#64748b", background: "#f1f5f9", borderRadius: 999, padding: "1px 8px" }}>+{extra}</span>
            )}
          </div>
        )}
      </div>

      <span aria-hidden="true" style={{ color: "#cbd5e1", fontSize: "1.2rem", flexShrink: 0 }}>›</span>
    </div>
  );
}

// Resalta la parte del nombre que coincide con lo escrito, ignorando acentos.
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

function pillBtn(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "0.45rem 0.9rem",
    borderRadius: 999,
    border: active ? "1px solid var(--blue-main)" : "1px solid var(--border)",
    background: active ? "var(--blue-xlight)" : "#fff",
    color: active ? "var(--blue-main)" : "#334155",
    fontWeight: 600,
    fontSize: "0.82rem",
    cursor: "pointer",
    fontFamily: "inherit",
    maxWidth: "60%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function sheetRow(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    border: "none",
    background: active ? "var(--blue-xlight)" : "transparent",
    borderRadius: 12,
    padding: "0.85rem 0.9rem",
    fontSize: "0.95rem",
    fontWeight: active ? 700 : 500,
    color: active ? "var(--blue-main)" : "#334155",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  };
}
