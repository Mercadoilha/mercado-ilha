"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import ListingCard from "../../components/ListingCard";
import { useSession } from "../../contexts/SessionContext";
import { trackSearch } from "../../lib/tracking";
import {
  getListingsCache,
  setListingsCache,
  saveScroll,
  getScroll,
  saveFilterUi,
  getFilterUi,
  LISTINGS_SOFT_TTL,
  LISTINGS_HARD_TTL,
  type ListingsCacheEntry,
} from "../../lib/listingsCache";
import {
  getCategoriesSync,
  loadCategories,
  getLocalitiesSync,
  loadLocalities,
  getSubcategoriesSync,
  loadSubcategories,
} from "../../lib/catalogCache";
import {
  LISTINGS_SELECT,
  DEFAULT_LISTINGS_KEY,
  PAGE_SIZE,
  cursorFromLast,
  applyKeysetCursor,
} from "../../lib/listingsApi";
import { fold, foldWords, prefixFilter, MIN_WORD_DESC } from "../../lib/searchNorm";
import {
  getCachedFavorites,
  loadFavorites,
  addFavorite,
  removeFavorite,
  clearFavoritesCache,
} from "../../lib/favoritesCache";

const SORT_OPTIONS = [
  { key: "recent", label: "🕐 Recentes" },
  { key: "price_asc", label: "💲 Menor preço" },
  { key: "price_desc", label: "💰 Maior preço" },
] as const;

const CONDITION_OPTIONS = [
  { key: "", label: "Todos" },
  { key: "Novo", label: "✨ Novo" },
  { key: "Seminovo", label: "👍 Seminovo" },
  { key: "Usado", label: "♻️ Usado" },
] as const;

const SLUG_ICON_FALLBACK: Record<string, string> = {
  "produtos": "📦", "servicos-do-lar": "🏠", "construcao": "🔨",
  "beleza-e-bem-estar": "💅", "translados": "🚗", "envios": "📫",
  "gastronomia": "🍽️", "terrenos": "🌍", "casas": "🏡", "alugueis": "🔑",
};

// Orden "recentes": created_at desc, id desc como desempate (coincide con el keyset).
const byRecent = (a: any, b: any) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id;

// T6: ventana de "no vale la pena revalidar" alineada al revalidate=60 de
// app/listings/page.tsx — con menos de 60s de antigüedad, el propio ISR de la vista
// default garantiza que no hay nada más nuevo que traer. Se aplica también a vistas
// con filtros (categoría/zona/condición): un caché tan fresco no gana nada refetcheando.
const REVALIDATE_SKIP_MS = 60_000;

// T11: `initialDefault` es el listado default (60 anuncios activos, orden created_at
// desc) renderizado en el servidor por app/listings/page.tsx (Server Component ISR).
// Se usa para pintar cards en el primer HTML sin esperar la hidratación.
export default function ListingsClient({ initialDefault }: { initialDefault: any[] }) {
  return (
    <Suspense fallback={<ListingsFallback initialDefault={initialDefault} />}>
      <ListingsContent initialDefault={initialDefault} />
    </Suspense>
  );
}

// Fallback del Suspense. Como ListingsContent lee `searchParams` con useSearchParams,
// bajo Suspense en una ruta estática este fallback es lo que Next prerenderiza en el
// HTML → así las cards del listado default viajan en el primer HTML. Replica el markup
// del PRIMER render de ListingsContent en la vista default (header + fila de orden +
// grid), así el swap al hidratar es invisible y sin layout shift. Botones estáticos
// (spans) porque el subtree se reemplaza entero al montar ListingsContent.
function ListingsFallback({ initialDefault }: { initialDefault: any[] }) {
  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>
          ←
        </Link>
        <h1>Todos os anúncios</h1>
      </header>

      <div style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
        <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: "0.5rem 1rem 0", overflowX: "auto" }}>
          {SORT_OPTIONS.map((opt) => (
            <span
              key={opt.key}
              style={{
                flexShrink: 0,
                padding: "0.3rem 0.75rem",
                borderRadius: 999,
                border: opt.key === "recent" ? "none" : "1px solid var(--border)",
                background: opt.key === "recent" ? "var(--blue-main)" : "#fff",
                color: opt.key === "recent" ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "0.75rem 0" }}>
        <div className="listing-grid">
          {initialDefault.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              sessionExists={false}
              isFavorite={false}
              busy={false}
              onToggleFavorite={async () => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ListingsContent({ initialDefault }: { initialDefault: any[] }) {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category") ?? "";
  const searchQuery = searchParams.get("q") ?? "";
  const subcategoryIdParam = searchParams.get("subcategory_id") ?? "";

  const { session } = useSession();

  // Clave de "identidad" de la vista según la URL (categoría + búsqueda + subcategoría).
  const baseKey = `${categorySlug}|${searchQuery}|${subcategoryIdParam}`;
  // Estado de filtros restaurado al volver del detalle (la página remonta y pierde useState).
  const restoredUi = getFilterUi(baseKey);

  const [sortBy, setSortBy] = useState<string>(restoredUi?.sortBy ?? "recent");
  const [conditionFilter, setConditionFilter] = useState<string>(restoredUi?.conditionFilter ?? "");
  const [zoneFilter, setZoneFilter] = useState<number | null>(restoredUi?.zoneFilter ?? null);

  // Clave completa del caché de resultados (los que dependen de red). El orden es
  // client-side, así que NO forma parte de la clave.
  const cacheKey = `${baseKey}|${conditionFilter}|${zoneFilter ?? ""}`;

  // Snapshot inicial del caché (calculado una sola vez, en el primer render).
  const initRef = useRef<{ key: string; entry: ListingsCacheEntry | null } | null>(null);
  if (initRef.current === null) {
    const entry = getListingsCache(cacheKey);
    // Mostrable sin spinner hasta HARD_TTL (30 min): datos que aún valen y se
    // revalidan atrás. Vale también para restaurar el scroll al volver del detalle
    // con caché stale-mostrable.
    const showable = entry && Date.now() - entry.ts < LISTINGS_HARD_TTL ? entry : null;
    // T11: sin caché de sesión mostrable y en la vista default, sembrar con el listado
    // que vino renderizado del servidor (initialDefault) → cards al instante, coherente
    // con el fallback del Suspense (mismo initialDefault). Con filtros en la URL o con
    // caché de sesión más fresco, initialDefault se ignora. La revalidación del efecto de
    // carga poblará el caché de módulo con datos frescos enseguida.
    const seeded =
      showable ??
      (cacheKey === DEFAULT_LISTINGS_KEY && initialDefault.length > 0
        ? { data: initialDefault, ts: Date.now(), hasMore: initialDefault.length >= PAGE_SIZE }
        : null);
    initRef.current = { key: cacheKey, entry: seeded };
  }

  const [listings, setListings] = useState<any[]>(initRef.current.entry?.data ?? []);
  // true cuando ningún anuncio tiene TODAS las palabras y se muestran parecidos.
  const [relaxedSearch, setRelaxedSearch] = useState(!!initRef.current.entry?.relaxed);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!initRef.current.entry);
  const [refreshing, setRefreshing] = useState(false);
  // T4: paginación "Carregar mais". hasMore = quedan páginas; loadingMore = trayendo.
  const [hasMore, setHasMore] = useState<boolean>(!!initRef.current.entry?.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [subcategoryLabel, setSubcategoryLabel] = useState("");
  const [localities, setLocalities] = useState<{ id: number; name: string }[]>([]);
  // Evita registrar la misma búsqueda dos veces (al cambiar orden/zona).
  const loggedTermRef = useRef<string>("");

  // Refs auxiliares: leer valores actuales dentro de efectos sin re-suscribir.
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;
  // T8: refs de favoriteIds/session para que toggleFavorite tenga deps estables
  // ([]) y no se recree (ni re-renderice las ~60 ListingCard) en cada toggle.
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastScrollRef = useRef(0);
  // T4: primera corrida del efecto de carga (para no colapsar el acumulado al volver
  // del detalle) y contexto de la query actual para reusar en "Carregar mais".
  const firstRunRef = useRef(true);
  const catIdRef = useRef<number | null>(null);
  const zoneOrRef = useRef<string | null>(null);

  // Persistir el estado de filtros por baseKey para restaurarlo al volver del detalle.
  useEffect(() => {
    saveFilterUi(baseKey, { sortBy, conditionFilter, zoneFilter });
  }, [baseKey, sortBy, conditionFilter, zoneFilter]);

  // Reset de zona cuando cambia la categoría/búsqueda EN VIVO (no en el primer mount,
  // así se preserva la selección restaurada al volver del detalle).
  const prevBaseRef = useRef<{ cat: string; q: string } | undefined>(undefined);
  useEffect(() => {
    const prev = prevBaseRef.current;
    prevBaseRef.current = { cat: categorySlug, q: searchQuery };
    if (prev === undefined) return; // primer mount
    if (prev.cat !== categorySlug || prev.q !== searchQuery) setZoneFilter(null);
  }, [categorySlug, searchQuery]);

  // Reset de condición según la categoría (misma salvedad del primer mount).
  const prevCatRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevCatRef.current;
    prevCatRef.current = categorySlug;
    if (prev === undefined) return; // primer mount
    if (!categorySlug) { setCategoryLabel(""); setConditionFilter(""); return; }
    if (categorySlug !== "produtos") setConditionFilter("");
  }, [categorySlug]);

  // Resolve subcategory id → label (T6: caché de sesión en vez de 1 query por visita).
  useEffect(() => {
    if (!subcategoryIdParam) { setSubcategoryLabel(""); return; }
    const id = Number(subcategoryIdParam);
    const sync = getSubcategoriesSync();
    if (sync) { setSubcategoryLabel(sync.find((s) => s.id === id)?.name ?? ""); return; }
    let mounted = true;
    loadSubcategories().then((subs) => {
      if (mounted) setSubcategoryLabel(subs.find((s) => s.id === id)?.name ?? "");
    });
    return () => { mounted = false; };
  }, [subcategoryIdParam]);

  // Localidades para el filtro de zona: caché de sesión, carga única, no bloquea la lista.
  useEffect(() => {
    const sync = getLocalitiesSync();
    if (sync) { setLocalities(sync); return; }
    let mounted = true;
    loadLocalities().then((locs) => { if (mounted) setLocalities(locs); });
    return () => { mounted = false; };
  }, []);

  // Carga principal de anuncios. Depende solo de cacheKey (categoría/q/subcat/condición/zona).
  useEffect(() => {
    let mounted = true;

    // Render inmediato desde caché (stale-while-revalidate) o mantener lo anterior visible.
    const entry = getListingsCache(cacheKey);
    const age = entry ? Date.now() - entry.ts : Infinity;
    // Mostrable sin spinner hasta HARD_TTL. Siempre revalidamos atrás; el indicador
    // "Atualizando…" solo se muestra si el caché ya está stale (edad ≥ SOFT_TTL):
    // datos frescos se revalidan en silencio (comportamiento previo).
    const showable = entry && age < LISTINGS_HARD_TTL ? entry : null;
    if (showable) {
      setListings(showable.data);
      setRelaxedSearch(!!showable.relaxed);
      setHasMore(!!showable.hasMore);
      setLoading(false);
      setRefreshing(age >= LISTINGS_SOFT_TTL);
    } else if (listingsRef.current.length > 0) {
      setRefreshing(true);
      setLoading(false);
    } else {
      setLoading(true);
      setRefreshing(false);
    }
    setError(null);

    // T4: al volver del detalle con un acumulado de varias páginas, NO re-consultar
    // en el primer mount: re-fetchar la página 1 colapsaría el acumulado a 60. Solo
    // aplica al primer run con caché acumulado mostrable; los cambios de
    // filtro/categoría siguen re-consultando.
    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;
    const skipAccumulatedCollapse = isFirstRun && !!showable && showable.data.length > PAGE_SIZE;
    // T6: caché con menos de REVALIDATE_SKIP_MS no gana nada revalidando ahora
    // (ver comentario de la constante). Entre eso y SOFT_TTL se revalida en
    // silencio como antes (el estado `refreshing` ya lo maneja arriba).
    const skipFresh = !!showable && age < REVALIDATE_SKIP_MS;
    const skipLoad = skipAccumulatedCollapse || skipFresh;

    async function load() {
      // 1 foto por anúncio (a primeira por sort_order); subzones não é usado pelo card.
      // Select importado de lib/listingsApi (fuente única compartida con el prewarm del home).
      const selectBase = LISTINGS_SELECT;
      const extraSelect = selectBase + ", listing_extra_categories!inner(category_id)";

      // Lookups independientes en paralelo: catálogo de categorías (sync si está
      // cacheado) + ids de anuncios que atienden la zona filtrada.
      const catsPromise = categorySlug
        ? (getCategoriesSync() ? Promise.resolve(getCategoriesSync()!) : loadCategories())
        : Promise.resolve(null);
      const zonePromise = zoneFilter
        ? supabase.from("listing_service_zones").select("listing_id, subzones!inner(locality_id)").eq("subzones.locality_id", zoneFilter)
        : Promise.resolve({ data: [] as any[] });

      const [catsData, zoneRes] = await Promise.all([catsPromise, zonePromise] as const);

      let catId: number | null = null;
      if (categorySlug) {
        const cat = (catsData ?? []).find((c) => c.slug === categorySlug);
        // Slug inválido: sin categoría → no mostrar nada.
        if (!cat) {
          if (mounted) { setListings([]); setRelaxedSearch(false); setHasMore(false); setListingsCache(cacheKey, []); setLoading(false); setRefreshing(false); }
          return;
        }
        catId = cat.id;
        if (mounted) {
          const icon = cat.icon || SLUG_ICON_FALLBACK[categorySlug] || "📌";
          setCategoryLabel(`${icon} ${cat.name}`);
        }
      }

      // Filtro de zona (OR sobre columnas del anuncio): base en la localidad,
      // "toda a ilha", o que atienda alguna sub-zona de la localidad.
      const zoneOr = zoneFilter
        ? (() => {
            const ids = Array.from(new Set(((zoneRes as any).data ?? []).map((r: any) => r.listing_id)));
            const ors = [`locality_id.eq.${zoneFilter}`, "covers_all_island.eq.true"];
            if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
            return ors.join(",");
          })()
        : null;

      // T4: contexto de la query actual para reusar en "Carregar mais" (misma
      // categoría/condición/zona; el cursor lo agrega loadMore).
      catIdRef.current = catId;
      zoneOrRef.current = zoneOr;

      // Aplica los filtros comunes (status, búsqueda, condición, zona, orden, límite,
      // y 1 foto por anuncio) a cualquier query base de listings.
      // Búsqueda sin acentos, por INICIO de palabra: primero exige que TODAS
      // coincidan (AND); relaxWords pide CUALQUIERA (OR) — el fallback estilo
      // Mercado Livre de abajo. Las palabras cortas se buscan solo en el título.
      const words = searchQuery ? foldWords(searchQuery) : [];
      const wordFilter = (w: string) =>
        w.length >= MIN_WORD_DESC
          ? `${prefixFilter("title_norm", w)},${prefixFilter("description_norm", w)}`
          : prefixFilter("title_norm", w);
      const decorate = (q: any, relaxWords: boolean) => {
        q = q
          .order("sort_order", { referencedTable: "listing_photos" })
          .limit(1, { referencedTable: "listing_photos" })
          .eq("status", "active");
        if (words.length) {
          if (relaxWords) {
            q = q.or(words.map(wordFilter).join(","));
          } else {
            for (const w of words) {
              q = q.or(wordFilter(w));
            }
          }
        }
        if (conditionFilter) q = q.eq("condition", conditionFilter);
        if (zoneOr) q = q.or(zoneOr);
        return q
          .order("created_at", { ascending: false })
          .order("id", { ascending: false }) // desempate estable para el keyset (T4)
          .limit(PAGE_SIZE);
      };

      // rawCount = filas crudas traídas (antes de fusionar/deduplicar): sirve para
      // saber si quedan más páginas (rawCount >= PAGE_SIZE ⇒ probablemente hay más).
      async function fetchPage(relaxWords: boolean): Promise<{ data: any[]; error: any; rawCount: number }> {
        if (catId) {
          // Concurrente: anuncios con esta categoría como PRINCIPAL ‖ como SECUNDARIA
          // (antes: extras y luego principal, encadenados). Se fusiona en el cliente.
          let primary = decorate(supabase.from("listings").select(selectBase), relaxWords).eq("category_id", catId);
          let extras = decorate(supabase.from("listings").select(extraSelect), relaxWords).eq("listing_extra_categories.category_id", catId);
          if (subcategoryIdParam) {
            primary = primary.eq("subcategory_id", Number(subcategoryIdParam));
            extras = extras.eq("listing_extra_categories.subcategory_id", Number(subcategoryIdParam));
          }
          const [primRes, extraRes] = await Promise.all([primary, extras]);
          const map = new Map<number, any>();
          for (const r of (primRes.data ?? [])) map.set(r.id, r);
          for (const r of (extraRes.data ?? [])) if (!map.has(r.id)) map.set(r.id, r);
          const merged = Array.from(map.values()).sort(byRecent).slice(0, PAGE_SIZE);
          return {
            data: merged,
            error: primRes.error || extraRes.error,
            rawCount: (primRes.data?.length ?? 0) + (extraRes.data?.length ?? 0),
          };
        }
        const res = await decorate(supabase.from("listings").select(selectBase), relaxWords);
        const data = (res.data as any[]) ?? [];
        return { data, error: res.error, rawCount: data.length };
      }

      let { data, error: fetchErr, rawCount } = await fetchPage(false);
      let relaxed = false;

      // Fallback estilo Mercado Livre: si ninguna publicación tiene TODAS las
      // palabras ("pao gt"), mostrar las que tengan ALGUNA, mejores primero.
      if (!fetchErr && data.length === 0 && words.length > 1) {
        const retry = await fetchPage(true);
        if (!retry.error && retry.data.length > 0) {
          const hits = (title: string) => {
            const t = fold(title ?? "");
            return words.reduce((n, w) => n + (t.startsWith(w) || t.includes(` ${w}`) ? 1 : 0), 0);
          };
          data = [...retry.data].sort((a, b) => hits(b.title) - hits(a.title));
          relaxed = true;
        }
      }

      if (!mounted) return;

      if (fetchErr) {
        setError(fetchErr.message);
        // Mantener lo anterior visible en vez de vaciar la pantalla.
      } else {
        // La búsqueda con texto NO pagina (el fallback relajado re-rankea client-side
        // y no tiene cursor natural): hasMore solo aplica sin ?q=.
        const newHasMore = !searchQuery && rawCount >= PAGE_SIZE;
        setListings(data);
        setRelaxedSearch(relaxed);
        setHasMore(newHasMore);
        setListingsCache(cacheKey, data, relaxed, newHasMore);
      }

      // Registrar la búsqueda de texto (una vez por término) con su cantidad de
      // resultados. Alimenta la detección de búsquedas sin resultados.
      if (searchQuery && loggedTermRef.current !== searchQuery) {
        loggedTermRef.current = searchQuery;
        trackSearch(searchQuery, fetchErr ? 0 : data.length);
      }

      setLoading(false);
      setRefreshing(false);
    }

    if (!skipLoad) load();
    else { setLoading(false); setRefreshing(false); }

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // Restaurar posición de scroll al montar con contenido cacheado (volver del detalle).
  // El App Router hace scroll-to-top tras el remount (con timing variable), así que
  // reafirmamos la posición cada frame durante una ventana corta, pero paramos apenas
  // el usuario interactúa (scroll/tap/tecla) para no pisar su intención.
  useEffect(() => {
    if (!initRef.current?.entry) return;
    const y = getScroll(initRef.current.key);
    if (y <= 0) return;

    let done = false;
    let rafId = 0;
    const start = performance.now();
    const cancel = () => { done = true; };
    const tick = () => {
      if (done) return;
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
      if (performance.now() - start < 500) rafId = requestAnimationFrame(tick);
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    tick();
    return () => {
      done = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar la posición de scroll. El scroll solo actualiza un ref; se persiste en la
  // fase de captura del click (antes de que el App Router haga scroll-to-top al navegar),
  // de modo que el reset de la navegación no pise la posición real.
  useEffect(() => {
    const onScroll = () => { lastScrollRef.current = window.scrollY; };
    const onClickCapture = () => { saveScroll(keyRef.current, lastScrollRef.current); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  // Favoritos: efecto propio dependiente solo de la sesión (no recarga la lista).
  // Caché de sesión: se lee del caché si existe, se carga una vez y se limpia al salir.
  useEffect(() => {
    if (!session) { setFavoriteIds(new Set()); clearFavoritesCache(); return; }
    const uid = session.user.id;
    const cached = getCachedFavorites(uid);
    if (cached) { setFavoriteIds(new Set(cached)); return; }
    let mounted = true;
    loadFavorites(uid).then((ids) => { if (mounted) setFavoriteIds(new Set(ids)); });
    return () => { mounted = false; };
  }, [session]);

  // Orden aplicado client-side sobre los resultados ya cargados: instantáneo,
  // sin red. Precio con nulls siempre al final (mismo criterio que antes en SQL).
  const sortedListings = useMemo(() => {
    if (sortBy === "recent") return listings;
    const copy = [...listings];
    copy.sort((a: any, b: any) => {
      const pa = a.price, pb = b.price;
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sortBy === "price_asc" ? pa - pb : pb - pa;
    });
    return copy;
  }, [listings, sortBy]);

  const toggleFavorite = useCallback(async (listingId: number) => {
    const session = sessionRef.current;
    if (!session) { setError("Entre para guardar favoritos."); return; }
    const uid = session.user.id;
    const isFav = favoriteIdsRef.current.has(listingId);
    setBusyIds((c) => [...c, listingId]);
    setError(null);
    if (isFav) {
      const { error: e } = await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("profile_id", uid);
      if (e) setError(e.message);
      else {
        removeFavorite(uid, listingId);
        setFavoriteIds((c) => { const next = new Set(c); next.delete(listingId); return next; });
      }
    } else {
      const { error: e } = await supabase
        .from("favorites")
        .insert({ listing_id: listingId, profile_id: uid });
      if (e) setError(e.message);
      else {
        addFavorite(uid, listingId);
        setFavoriteIds((c) => new Set([...c, listingId]));
      }
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // T4: "Carregar mais anúncios" (keyset por created_at, id). Solo sin ?q=. NO muestra
  // spinner de página: agrega al final y deja el estado de carga en el propio botón.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || searchQuery) return;
    const current = listingsRef.current;
    const cursor = cursorFromLast(current);
    if (!cursor) return;

    setLoadingMore(true);
    setError(null);
    const catId = catIdRef.current;
    const zoneOr = zoneOrRef.current;
    const selectBase = LISTINGS_SELECT;
    const extraSelect = selectBase + ", listing_extra_categories!inner(category_id)";

    // Mismo decorate que la página 1 pero sin palabras (la búsqueda no pagina) y con
    // el cursor keyset agregado. El orden (created_at desc, id desc) debe coincidir.
    const decorate = (q: any) => {
      q = q
        .order("sort_order", { referencedTable: "listing_photos" })
        .limit(1, { referencedTable: "listing_photos" })
        .eq("status", "active");
      if (conditionFilter) q = q.eq("condition", conditionFilter);
      if (zoneOr) q = q.or(zoneOr);
      q = applyKeysetCursor(q, cursor);
      return q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
    };

    const existing = new Set(current.map((r) => r.id));
    let newItems: any[] = [];
    let rawCount = 0;
    let err: any = null;

    if (catId) {
      let primary = decorate(supabase.from("listings").select(selectBase)).eq("category_id", catId);
      let extras = decorate(supabase.from("listings").select(extraSelect)).eq("listing_extra_categories.category_id", catId);
      if (subcategoryIdParam) {
        primary = primary.eq("subcategory_id", Number(subcategoryIdParam));
        extras = extras.eq("listing_extra_categories.subcategory_id", Number(subcategoryIdParam));
      }
      const [primRes, extraRes] = await Promise.all([primary, extras]);
      err = primRes.error || extraRes.error;
      rawCount = (primRes.data?.length ?? 0) + (extraRes.data?.length ?? 0);
      const map = new Map<number, any>();
      for (const r of (primRes.data ?? [])) if (!existing.has(r.id)) map.set(r.id, r);
      for (const r of (extraRes.data ?? [])) if (!existing.has(r.id) && !map.has(r.id)) map.set(r.id, r);
      newItems = Array.from(map.values()).sort(byRecent).slice(0, PAGE_SIZE);
    } else {
      const res = await decorate(supabase.from("listings").select(selectBase));
      err = res.error;
      rawCount = res.data?.length ?? 0;
      newItems = ((res.data as any[]) ?? []).filter((r) => !existing.has(r.id));
    }

    if (err) { setError(err.message); setLoadingMore(false); return; }

    const accumulated = [...current, ...newItems];
    const newHasMore = rawCount >= PAGE_SIZE;
    setListings(accumulated);
    setHasMore(newHasMore);
    setListingsCache(keyRef.current, accumulated, false, newHasMore);
    setLoadingMore(false);
  }, [loadingMore, hasMore, searchQuery, conditionFilter, subcategoryIdParam]);

  const pageTitle = categorySlug
    ? categoryLabel || "Anúncios"
    : searchQuery
    ? `"${searchQuery}"`
    : "Todos os anúncios";

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>
          ←
        </Link>
        <h1>{pageTitle}</h1>
      </header>

      {/* Filtros activos */}
      {(categorySlug || searchQuery) && (
        <div style={{ padding: "0.75rem 1rem 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categorySlug && (
            <Link
              href="/listings"
              className="badge badge-blue"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              {categoryLabel || categorySlug} ✕
            </Link>
          )}
          {subcategoryIdParam && subcategoryLabel && (
            <Link
              href={`/listings?category=${categorySlug}`}
              className="badge badge-blue"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              {subcategoryLabel} ✕
            </Link>
          )}
          {searchQuery && (
            <Link
              href="/listings"
              className="badge badge-sand"
              style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
            >
              🔍 {searchQuery} ✕
            </Link>
          )}
        </div>
      )}

      {/* Sort & Filtros */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "#fff" }}>
        {/* Ordenar */}
        <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: "0.5rem 1rem 0", overflowX: "auto" }}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortBy(opt.key)}
              style={{
                flexShrink: 0,
                padding: "0.3rem 0.75rem",
                borderRadius: 999,
                border: sortBy === opt.key ? "none" : "1px solid var(--border)",
                background: sortBy === opt.key ? "var(--blue-main)" : "#fff",
                color: sortBy === opt.key ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Condição — solo para Produtos */}
        {categorySlug === "produtos" && (
          <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: "0.4rem 1rem 0", overflowX: "auto" }}>
            {CONDITION_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setConditionFilter(opt.key)}
                style={{
                  flexShrink: 0,
                  padding: "0.28rem 0.7rem",
                  borderRadius: 999,
                  border: conditionFilter === opt.key ? "none" : "1px solid var(--border)",
                  background: conditionFilter === opt.key ? "var(--sand)" : "#fff",
                  color: conditionFilter === opt.key ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {/* Zona */}
        {localities.length > 0 && (
          <div className="no-scrollbar" style={{ display: "flex", gap: 6, padding: "0.4rem 1rem 0.5rem", overflowX: "auto" }}>
            <button
              type="button"
              onClick={() => setZoneFilter(null)}
              style={{
                flexShrink: 0,
                padding: "0.28rem 0.7rem",
                borderRadius: 999,
                border: zoneFilter === null ? "none" : "1px solid var(--border)",
                background: zoneFilter === null ? "var(--blue-main)" : "#fff",
                color: zoneFilter === null ? "#fff" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              📍 Todas as zonas
            </button>
            {localities.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setZoneFilter(loc.id)}
                style={{
                  flexShrink: 0,
                  padding: "0.28rem 0.7rem",
                  borderRadius: 999,
                  border: zoneFilter === loc.id ? "none" : "1px solid var(--border)",
                  background: zoneFilter === loc.id ? "var(--blue-main)" : "#fff",
                  color: zoneFilter === loc.id ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.72rem",
                  cursor: "pointer",
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ padding: "0.75rem 0" }}>
        {error && <p className="text-error" style={{ margin: "0 1rem 8px" }}>{error}</p>}

        {/* Spinner de página inteira: só na primeira carga, sem dados ainda */}
        {loading && listings.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div className="spinner" />
          </div>
        )}

        {/* Indicador sutil: filtro/busca mudou, mantém a lista anterior visível */}
        {refreshing && listings.length > 0 && (
          <div style={{ textAlign: "center", padding: "0.4rem 0", fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Atualizando…
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem 1rem",
              margin: "0 1rem",
              background: "#fff",
              borderRadius: 12,
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔦</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>
              Nenhum anúncio encontrado
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              {searchQuery ? "Tente buscar por outro termo." : "Seja o primeiro a publicar nessa categoria!"}
            </p>
            <Link
              href="/publish"
              className="btn btn-primary"
              style={{ marginTop: 16, display: "inline-flex" }}
            >
              + Publicar anúncio
            </Link>
          </div>
        )}

        {/* Aviso del fallback: se muestran coincidencias parciales de la búsqueda */}
        {!loading && relaxedSearch && searchQuery && listings.length > 0 && (
          <div style={{ padding: "0.6rem 1rem 0", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
            Nenhum anúncio tem todas as palavras — mostrando resultados parecidos.
          </div>
        )}

        <div className="listing-grid">
          {sortedListings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              sessionExists={!!session}
              isFavorite={favoriteIds.has(l.id)}
              busy={busyIds.includes(l.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

        {/* T4: Carregar mais (só sem busca; a busca não pagina). */}
        {!loading && !searchQuery && hasMore && listings.length > 0 && (
          <div style={{ textAlign: "center", padding: "1.25rem 1rem 0.5rem" }}>
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                width: "100%",
                maxWidth: 320,
                padding: "0.7rem 1rem",
                borderRadius: 10,
                border: "1px solid var(--blue-main)",
                background: "#fff",
                color: "var(--blue-main)",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: loadingMore ? "default" : "pointer",
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? "Carregando…" : "Carregar mais anúncios"}
            </button>
          </div>
        )}

        {/* Busca com muitos resultados: em vez de paginar, sugerir refinar. */}
        {!loading && searchQuery && listings.length >= PAGE_SIZE && (
          <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Muitos resultados — refine sua busca para encontrar mais rápido.
          </div>
        )}
      </div>
    </div>
  );
}
