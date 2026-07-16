"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ListingCard from "./ListingCard";
import { supabase } from "../lib/supabaseClient";
import { useSession } from "../contexts/SessionContext";
import { trackSearch } from "../lib/tracking";
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
} from "../lib/listingsCache";
import {
  getCategoriesSync,
  loadCategories,
  getLocalitiesSync,
  loadLocalities,
  getSubzonesSync,
  loadSubzones,
  type CatalogLocality,
  type CatalogSubzone,
} from "../lib/catalogCache";
import {
  LISTINGS_SELECT,
  LISTINGS_SELECT_BUMP,
  PAGE_SIZE,
  cursorFromLast,
  applyKeysetCursor,
  type OrderCol,
} from "../lib/listingsApi";
import { fold, foldWords, prefixFilter, MIN_WORD_DESC } from "../lib/searchNorm";
import { sortButtonLabel, countActiveFilters, type SortKey, type ZoneSelection } from "../lib/feedFilters";
import {
  getCachedFavorites,
  loadFavorites,
  addFavorite,
  removeFavorite,
  clearFavoritesCache,
  prefetchFavoritesList,
} from "../lib/favoritesCache";
import { getFeaturedIdsSync, loadFeaturedIds } from "../lib/featuredCache";

// Hojas Ordenar/Filtrar: se cargan solo al abrirlas (no pesan en la carga inicial).
const OrdenarSheet = dynamic(() => import("./OrdenarSheet"), { ssr: false });
const FiltrarSheet = dynamic(() => import("./FiltrarSheet"), { ssr: false });

type ListingsFeedProps = {
  // Primera página renderizada en el servidor (ISR) → cards en el primer HTML.
  initialData: any[];
  // "recent" ordena por created_at (/listings); "bump" por bumped_at (feed del inicio).
  defaultOrder: "recent" | "bump";
  // Prefijo de las claves de caché/scroll/filtros para que el inicio y /listings NO
  // colisionen ("" en /listings — preserva las claves existentes; "home:" en el inicio).
  namespace: string;
  // Identidad de la vista (en /listings viene de la URL; en el inicio queda vacía).
  categorySlug?: string;
  searchQuery?: string;
  subcategoryId?: string;
  // Reforma 4: ids con contorno dorado (destacados del inicio). El contorno acompaña
  // al anuncio aunque se reordene o filtre. En el inicio llega provisto por el servidor;
  // en /listings (categorías/busca) queda undefined y el feed lo carga del caché de sesión
  // (mismo conjunto que el inicio) para que el dorado también viaje acá.
  featuredIds?: Set<number>;
  // Solo el inicio: agrega a la izquierda de la fila los pills "Lojas" (→/lojas) y
  // "Favoritos" (→/favorites). Las demás vistas (/listings, categorías)
  // lo dejan en false → no aparecen ahí.
  homeExtras?: boolean;
};

// Comparador por la columna de orden (created_at o bumped_at) con id desc de desempate
// — coincide con el keyset del "Carregar mais".
const bySortCol = (col: OrderCol) => (a: any, b: any) =>
  a[col] < b[col] ? 1 : a[col] > b[col] ? -1 : b.id - a.id;

// T6: ventana de "no vale la pena revalidar" alineada al revalidate=60 de las páginas
// server (ISR). Con menos de 60s de antigüedad, el ISR ya garantiza que no hay nada más
// nuevo que traer.
const REVALIDATE_SKIP_MS = 60_000;

export default function ListingsFeed({
  initialData,
  defaultOrder,
  namespace,
  categorySlug = "",
  searchQuery = "",
  subcategoryId = "",
  featuredIds,
  homeExtras = false,
}: ListingsFeedProps) {
  const { session } = useSession();

  const orderCol: OrderCol = defaultOrder === "bump" ? "bumped_at" : "created_at";
  const selectBase = defaultOrder === "bump" ? LISTINGS_SELECT_BUMP : LISTINGS_SELECT;
  const bySort = useMemo(() => bySortCol(orderCol), [orderCol]);

  // Clave "de identidad" de la vista (namespace + categoría + búsqueda + subcategoría).
  const baseKey = `${namespace}${categorySlug}|${searchQuery}|${subcategoryId}`;
  const defaultKey = `${namespace}||||`;
  // Estado de filtros restaurado al volver del detalle (la página remonta).
  const restoredUi = getFilterUi(baseKey);

  const [sortBy, setSortBy] = useState<string>(restoredUi?.sortBy ?? "recent");
  const [conditionFilter, setConditionFilter] = useState<string>(restoredUi?.conditionFilter ?? "");
  const [localityIds, setLocalityIds] = useState<number[]>(restoredUi?.localityIds ?? []);
  const [subzoneIds, setSubzoneIds] = useState<number[]>(restoredUi?.subzoneIds ?? []);

  // Clave del caché de resultados: incorpora condición + selección de zonas. El orden es
  // client-side → NO forma parte de la clave.
  const zoneKey =
    localityIds.length || subzoneIds.length
      ? `l${[...localityIds].sort((a, b) => a - b).join(".")}s${[...subzoneIds].sort((a, b) => a - b).join(".")}`
      : "";
  const cacheKey = `${baseKey}|${conditionFilter}|${zoneKey}`;

  // Snapshot inicial del caché (una sola vez, primer render).
  const initRef = useRef<{ key: string; entry: ListingsCacheEntry | null } | null>(null);
  if (initRef.current === null) {
    const entry = getListingsCache(cacheKey);
    const showable = entry && Date.now() - entry.ts < LISTINGS_HARD_TTL ? entry : null;
    // Sin caché de sesión mostrable y en la vista default: sembrar con la primera página
    // que vino del servidor (initialData) → cards al instante. Con filtros o caché más
    // fresco se ignora.
    const seeded =
      showable ??
      (cacheKey === defaultKey && initialData.length > 0
        ? { data: initialData, ts: Date.now(), hasMore: initialData.length >= PAGE_SIZE }
        : null);
    initRef.current = { key: cacheKey, entry: seeded };
  }

  const [listings, setListings] = useState<any[]>(initRef.current.entry?.data ?? []);
  const [relaxedSearch, setRelaxedSearch] = useState(!!initRef.current.entry?.relaxed);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!initRef.current.entry);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(!!initRef.current.entry?.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [localities, setLocalities] = useState<CatalogLocality[]>([]);
  const [subzones, setSubzones] = useState<CatalogSubzone[]>([]);
  // Destacados: si el servidor no los pasó (inicio), los cargamos del caché de sesión.
  // Arranca con lo que ya haya en caché para pintar el dorado en el primer render.
  const [loadedFeatured, setLoadedFeatured] = useState<Set<number> | null>(
    () => (featuredIds ? null : getFeaturedIdsSync())
  );
  const effectiveFeatured = featuredIds ?? loadedFeatured ?? undefined;

  // Estado de las hojas (Ordenar / Filtrar).
  const [ordenarOpen, setOrdenarOpen] = useState(false);
  const [filtrarOpen, setFiltrarOpen] = useState(false);

  const loggedTermRef = useRef<string>("");

  // Refs auxiliares (leer valores actuales dentro de efectos sin re-suscribir).
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastScrollRef = useRef(0);
  const firstRunRef = useRef(true);
  const catIdRef = useRef<number | null>(null);
  const zoneOrRef = useRef<string | null>(null);

  // Persistir el estado de filtros por baseKey para restaurarlo al volver del detalle.
  useEffect(() => {
    saveFilterUi(baseKey, { sortBy, conditionFilter, localityIds, subzoneIds });
  }, [baseKey, sortBy, conditionFilter, localityIds, subzoneIds]);

  // Reset de zona cuando cambia la categoría/búsqueda EN VIVO (no en el primer mount,
  // para preservar la selección restaurada al volver del detalle).
  const prevBaseRef = useRef<{ cat: string; q: string } | undefined>(undefined);
  useEffect(() => {
    const prev = prevBaseRef.current;
    prevBaseRef.current = { cat: categorySlug, q: searchQuery };
    if (prev === undefined) return;
    if (prev.cat !== categorySlug || prev.q !== searchQuery) {
      setLocalityIds([]);
      setSubzoneIds([]);
    }
  }, [categorySlug, searchQuery]);

  // Reset de condición según la categoría (misma salvedad del primer mount).
  const prevCatRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevCatRef.current;
    prevCatRef.current = categorySlug;
    if (prev === undefined) return;
    if (categorySlug !== "produtos") setConditionFilter("");
  }, [categorySlug]);

  // Destacados (contorno dorado): solo cuando el servidor no los pasó (inicio). Caché de
  // sesión, no bloquea el render — el dorado aparece cuando resuelve (igual que favoritos).
  useEffect(() => {
    if (featuredIds || getFeaturedIdsSync()) return;
    let mounted = true;
    loadFeaturedIds().then((s) => { if (mounted) setLoadedFeatured(s); });
    return () => { mounted = false; };
  }, [featuredIds]);

  // Localidades para el filtro de zona: caché de sesión, carga única, no bloquea la lista.
  useEffect(() => {
    const sync = getLocalitiesSync();
    if (sync) { setLocalities(sync); return; }
    let mounted = true;
    loadLocalities().then((locs) => { if (mounted) setLocalities(locs); });
    return () => { mounted = false; };
  }, []);

  // Sub-zonas: se cargan recién al abrir la hoja Filtrar por primera vez (nunca en el
  // camino crítico de la página).
  useEffect(() => {
    if (!filtrarOpen || subzones.length > 0) return;
    const sync = getSubzonesSync();
    if (sync) { setSubzones(sync); return; }
    let mounted = true;
    loadSubzones().then((sz) => { if (mounted) setSubzones(sz); });
    return () => { mounted = false; };
  }, [filtrarOpen, subzones.length]);

  // Carga principal de anuncios. Depende solo de cacheKey.
  useEffect(() => {
    let mounted = true;

    const entry = getListingsCache(cacheKey);
    const age = entry ? Date.now() - entry.ts : Infinity;
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

    const isFirstRun = firstRunRef.current;
    firstRunRef.current = false;
    const skipAccumulatedCollapse = isFirstRun && !!showable && showable.data.length > PAGE_SIZE;
    const skipFresh = !!showable && age < REVALIDATE_SKIP_MS;
    const skipLoad = skipAccumulatedCollapse || skipFresh;

    async function load() {
      const extraSelect = selectBase + ", listing_extra_categories!inner(category_id)";

      // Lookups independientes en paralelo: catálogo de categorías + ids de anuncios que
      // atienden las zonas filtradas (service zones que matcheen sub-zonas sueltas o
      // localidades enteras).
      const catsPromise = categorySlug
        ? (getCategoriesSync() ? Promise.resolve(getCategoriesSync()!) : loadCategories())
        : Promise.resolve(null);
      const svcSubPromise = subzoneIds.length
        ? supabase.from("listing_service_zones").select("listing_id").in("subzone_id", subzoneIds)
        : Promise.resolve({ data: [] as any[] });
      const svcLocPromise = localityIds.length
        ? supabase
            .from("listing_service_zones")
            .select("listing_id, subzones!inner(locality_id)")
            .in("subzones.locality_id", localityIds)
        : Promise.resolve({ data: [] as any[] });

      const [catsData, svcSubRes, svcLocRes] = await Promise.all([catsPromise, svcSubPromise, svcLocPromise] as const);

      let catId: number | null = null;
      if (categorySlug) {
        const cat = (catsData ?? []).find((c) => c.slug === categorySlug);
        if (!cat) {
          if (mounted) { setListings([]); setRelaxedSearch(false); setHasMore(false); setListingsCache(cacheKey, []); setLoading(false); setRefreshing(false); }
          return;
        }
        catId = cat.id;
      }

      // Filtro de zona (OR sobre columnas del anuncio): localidad entera, sub-zona suelta,
      // "toda a ilha" (siempre entra), o que atienda alguna zona marcada (service zones).
      const hasZone = localityIds.length > 0 || subzoneIds.length > 0;
      const zoneOr = hasZone
        ? (() => {
            const ids = new Set<number>();
            ((svcSubRes as any).data ?? []).forEach((r: any) => ids.add(r.listing_id));
            ((svcLocRes as any).data ?? []).forEach((r: any) => ids.add(r.listing_id));
            const ors = ["covers_all_island.eq.true"];
            if (localityIds.length) ors.push(`locality_id.in.(${localityIds.join(",")})`);
            if (subzoneIds.length) ors.push(`subzone_id.in.(${subzoneIds.join(",")})`);
            if (ids.size) ors.push(`id.in.(${[...ids].join(",")})`);
            return ors.join(",");
          })()
        : null;

      catIdRef.current = catId;
      zoneOrRef.current = zoneOr;

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
            for (const w of words) q = q.or(wordFilter(w));
          }
        }
        if (conditionFilter) q = q.eq("condition", conditionFilter);
        if (zoneOr) q = q.or(zoneOr);
        return q
          .order(orderCol, { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE);
      };

      async function fetchPage(relaxWords: boolean): Promise<{ data: any[]; error: any; rawCount: number }> {
        if (catId) {
          let primary = decorate(supabase.from("listings").select(selectBase), relaxWords).eq("category_id", catId);
          let extras = decorate(supabase.from("listings").select(extraSelect), relaxWords).eq("listing_extra_categories.category_id", catId);
          if (subcategoryId) {
            primary = primary.eq("subcategory_id", Number(subcategoryId));
            extras = extras.eq("listing_extra_categories.subcategory_id", Number(subcategoryId));
          }
          const [primRes, extraRes] = await Promise.all([primary, extras]);
          const map = new Map<number, any>();
          for (const r of (primRes.data ?? [])) map.set(r.id, r);
          for (const r of (extraRes.data ?? [])) if (!map.has(r.id)) map.set(r.id, r);
          const merged = Array.from(map.values()).sort(bySort).slice(0, PAGE_SIZE);
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
      } else {
        const newHasMore = !searchQuery && rawCount >= PAGE_SIZE;
        setListings(data);
        setRelaxedSearch(relaxed);
        setHasMore(newHasMore);
        setListingsCache(cacheKey, data, relaxed, newHasMore);
      }

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

  // Guardar la posición de scroll (en la fase de captura del click, antes de navegar).
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

  // Favoritos: efecto propio dependiente solo de la sesión.
  useEffect(() => {
    if (!session) { setFavoriteIds(new Set()); clearFavoritesCache(); return; }
    const uid = session.user.id;
    const cached = getCachedFavorites(uid);
    if (cached) { setFavoriteIds(new Set(cached)); return; }
    let mounted = true;
    loadFavorites(uid).then((ids) => { if (mounted) setFavoriteIds(new Set(ids)); });
    return () => { mounted = false; };
  }, [session]);

  // Orden client-side: instantáneo, sin red. Regla del dueño: en los órdenes por precio,
  // los anuncios SIN precio van PRIMEROS.
  const sortedListings = useMemo(() => {
    if (sortBy === "recent") return listings;
    const copy = [...listings];
    copy.sort((a: any, b: any) => {
      const pa = a.price, pb = b.price;
      if (pa == null && pb == null) return 0;
      if (pa == null) return -1; // sin precio primero
      if (pb == null) return 1;
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
      const { error: e } = await supabase.from("favorites").delete().eq("listing_id", listingId).eq("profile_id", uid);
      if (e) setError(e.message);
      else {
        removeFavorite(uid, listingId);
        setFavoriteIds((c) => { const next = new Set(c); next.delete(listingId); return next; });
      }
    } else {
      const { error: e } = await supabase.from("favorites").insert({ listing_id: listingId, profile_id: uid });
      if (e) setError(e.message);
      else {
        addFavorite(uid, listingId);
        setFavoriteIds((c) => new Set([...c, listingId]));
      }
    }
    setBusyIds((c) => c.filter((id) => id !== listingId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Carregar mais" (keyset por orderCol, id). Solo sin ?q=.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || searchQuery) return;
    const current = listingsRef.current;
    const cursor = cursorFromLast(current, orderCol);
    if (!cursor) return;

    setLoadingMore(true);
    setError(null);
    const catId = catIdRef.current;
    const zoneOr = zoneOrRef.current;
    const extraSelect = selectBase + ", listing_extra_categories!inner(category_id)";

    const decorate = (q: any) => {
      q = q
        .order("sort_order", { referencedTable: "listing_photos" })
        .limit(1, { referencedTable: "listing_photos" })
        .eq("status", "active");
      if (conditionFilter) q = q.eq("condition", conditionFilter);
      if (zoneOr) q = q.or(zoneOr);
      q = applyKeysetCursor(q, cursor);
      return q
        .order(orderCol, { ascending: false })
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
      if (subcategoryId) {
        primary = primary.eq("subcategory_id", Number(subcategoryId));
        extras = extras.eq("listing_extra_categories.subcategory_id", Number(subcategoryId));
      }
      const [primRes, extraRes] = await Promise.all([primary, extras]);
      err = primRes.error || extraRes.error;
      rawCount = (primRes.data?.length ?? 0) + (extraRes.data?.length ?? 0);
      const map = new Map<number, any>();
      for (const r of (primRes.data ?? [])) if (!existing.has(r.id)) map.set(r.id, r);
      for (const r of (extraRes.data ?? [])) if (!existing.has(r.id) && !map.has(r.id)) map.set(r.id, r);
      newItems = Array.from(map.values()).sort(bySort).slice(0, PAGE_SIZE);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, searchQuery, conditionFilter, subcategoryId, orderCol, selectBase, bySort]);

  const zoneSelection: ZoneSelection = { localityIds, subzoneIds, condition: conditionFilter };
  const activeFilterCount = countActiveFilters(zoneSelection, subzones);
  const showCondition = categorySlug === "produtos";
  const filterActive = activeFilterCount > 0 || (showCondition && !!conditionFilter);

  return (
    <>
      {/* Fila Ordenar / Filtrar. En el inicio (homeExtras) suma "Lojas" y "Favoritos" a la
          izquierda y reparte con space-between; en las demás vistas queda a la derecha.
          Reserva su altura (minHeight) → sin salto de layout. */}
      <div style={{ position: "relative", borderBottom: "1px solid var(--border)", background: "#fff", padding: "0.6rem 1rem", display: "flex", justifyContent: homeExtras ? "space-between" : "flex-end", alignItems: "center", gap: 8, minHeight: 52 }}>
        {/* "Atualizando…" vive en el centro libre de esta fila (posición absoluta) → aparece
            y desaparece SIN mover un pixel del grid. La fila ya reserva su altura (minHeight),
            así que no hay salto de layout. pointer-events:none → nunca bloquea los botones. */}
        {refreshing && listings.length > 0 && (
          <span aria-hidden style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: "0.72rem", color: "var(--text-muted)", pointerEvents: "none" }}>
            Atualizando…
          </span>
        )}
        {homeExtras && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link href="/lojas" prefetch style={storePillLink}>Lojas</Link>
            {/* pointerdown (no click): la query de favoritos sale con el dedo todavía
                apoyado y viaja en paralelo con la navegación, en vez de arrancar recién
                cuando monta la pantalla. prefetch trae además el chunk de la ruta. */}
            <Link
              href="/favorites"
              prefetch
              style={pillLink}
              onPointerDown={() => { if (session) prefetchFavoritesList(session.user.id); }}
            >
              ❤️ Favoritos
            </Link>
          </div>
        )}
        <div style={{ display: "flex", gap: homeExtras ? 8 : 10, flexShrink: 0 }}>
          <button type="button" onClick={() => setOrdenarOpen(true)} style={pillBtn(sortBy !== "recent", homeExtras)}>
            {sortButtonLabel(sortBy)} <span aria-hidden="true" style={{ fontSize: "0.7rem" }}>▾</span>
          </button>
          <button type="button" onClick={() => setFiltrarOpen(true)} style={pillBtn(filterActive, homeExtras)}>
            {activeFilterCount > 0 ? `Filtrar (${activeFilterCount})` : "Filtrar"}{" "}
            <span aria-hidden="true" style={{ fontSize: "0.7rem" }}>▾</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "0.35rem 0 0.75rem" }}>
        {error && <p className="text-error" style={{ margin: "0 1rem 8px" }}>{error}</p>}

        {loading && listings.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <div className="spinner" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", margin: "0 1rem", background: "#fff", borderRadius: 12, color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔦</div>
            <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Nenhum anúncio encontrado</p>
            <p style={{ fontSize: "0.875rem" }}>
              {searchQuery ? "Tente buscar por outro termo." : "Seja o primeiro a publicar nessa categoria!"}
            </p>
          </div>
        )}

        {!loading && relaxedSearch && searchQuery && listings.length > 0 && (
          <div style={{ padding: "0.6rem 1rem 0", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
            Nenhum anúncio tem todas as palavras — mostrando resultados parecidos.
          </div>
        )}

        <div className="listing-grid">
          {sortedListings.map((l, i) => (
            <ListingCard
              key={l.id}
              listing={l}
              sessionExists={!!session}
              isFavorite={favoriteIds.has(l.id)}
              busy={busyIds.includes(l.id)}
              onToggleFavorite={toggleFavorite}
              featured={effectiveFeatured?.has(l.id)}
              priority={i < 4}
            />
          ))}
        </div>

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
              {loadingMore ? "Carregando…" : "Ver mais anúncios"}
            </button>
          </div>
        )}

        {!loading && searchQuery && listings.length >= PAGE_SIZE && (
          <div style={{ textAlign: "center", padding: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Muitos resultados — refine sua busca para encontrar mais rápido.
          </div>
        )}
      </div>

      {ordenarOpen && (
        <OrdenarSheet
          current={sortBy}
          onSelect={(key: SortKey) => setSortBy(key)}
          onClose={() => setOrdenarOpen(false)}
        />
      )}
      {filtrarOpen && (
        <FiltrarSheet
          localities={localities}
          subzones={subzones}
          initial={zoneSelection}
          showCondition={showCondition}
          onApply={(sel) => {
            setLocalityIds(sel.localityIds);
            setSubzoneIds(sel.subzoneIds);
            setConditionFilter(sel.condition);
          }}
          onClose={() => setFiltrarOpen(false)}
        />
      )}
    </>
  );
}

function pillBtn(active: boolean, compact = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: compact ? "0.42rem 0.7rem" : "0.45rem 0.9rem",
    borderRadius: 999,
    border: active ? "1px solid var(--blue-main)" : "1px solid var(--border)",
    background: active ? "var(--blue-xlight)" : "#fff",
    color: active ? "var(--blue-main)" : "#334155",
    fontWeight: 600,
    fontSize: compact ? "0.8rem" : "0.82rem",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}

// Pills de navegación del inicio ("Lojas" / "Favoritos"): mismo look que pillBtn
// inactivo compacto, pero como <Link> (prefetch de la ruta, sin decoración).
const pillLink: React.CSSProperties = {
  ...pillBtn(false, true),
  textDecoration: "none",
};

// "Lojas": mismo estilo (relleno azul, texto branco) do botão "Ver loja →" no anúncio.
const storePillLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0.42rem 0.8rem",
  borderRadius: 999,
  border: "none",
  background: "var(--blue-main)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "0.8rem",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
