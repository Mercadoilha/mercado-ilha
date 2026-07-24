"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../../../lib/supabaseClient";
import { buildWaUrl } from "../../../lib/whatsappUrl";
import { trackListingView, trackWhatsappClick } from "../../../lib/tracking";
import { compartilhar } from "../../../lib/share";
import { useSession } from "../../../contexts/SessionContext";
import ShareIcon from "../../../components/ShareIcon";
import { getListingPreview } from "../../../lib/listingPreview";
import RichText from "../../../components/RichText";
import { takeListingDetailPrefetch } from "../../../lib/listingDetailPrefetch";
import { LISTING_DETAIL_SELECT } from "../../../lib/listingsApi";
import { getCachedFavorites, loadFavorites, addFavorite, removeFavorite } from "../../../lib/favoritesCache";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { session } = useSession();
  const listingId = Number(params?.id);

  // Render optimista (T9): datos mínimos que la card ya tenía, para pintar título,
  // precio y primera foto al instante mientras llega la query completa.
  const preview = getListingPreview(listingId);
  const [listing, setListing] = useState<any>(
    preview
      ? { id: preview.id, title: preview.title, price: preview.price, price_text: preview.price_text, condition: preview.condition, description: preview.description }
      : null
  );
  const [photos, setPhotos] = useState<any[]>(
    preview?.firstPhoto ? [{ id: -1, photo_url: preview.firstPhoto, sort_order: 0 }] : []
  );
  const [seller, setSeller] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [category, setCategory] = useState<any>(null);
  const [subcategory, setSubcategory] = useState<any>(null);
  const [locality, setLocality] = useState<any>(preview?.localityName ? { name: preview.localityName } : null);
  const [subzone, setSubzone] = useState<any>(null);
  const [serviceZones, setServiceZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStart = useRef<{ dist: number; panX: number; panY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [phoneLoaded, setPhoneLoaded] = useState(false);
  const viewTracked = useRef<number | null>(null);
  const didInitRef = useRef(false);

  // Chegou aqui direto de uma publicação bem-sucedida (PublishForm faz
  // router.replace(`/listings/${id}?from=publish`), sem deixar o formulário no histórico).
  // Não usamos useSearchParams (obrigaria envolver a rota em Suspense e tiraria o shell da
  // geração estática) — lemos a URL 1x no mount e guardamos num state; a seta de voltar usa
  // esse flag para ir à home em vez de back() (não haveria detalhe anterior nesse caso).
  const [fromPublish] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "publish"
  );

  // Anúncio aberto direto por um link compartilhado (sem histórico prévio na aba): a seta
  // de voltar leva à loja do vendedor; de lá, voltar leva ao início. É o circuito esperado
  // quando alguém abre um anúncio que recebeu. Se veio navegando dentro do app
  // (history.length > 1), voltar segue sendo o back normal (preserva filtros/scroll).
  const [isDeepLink] = useState(
    () => typeof window !== "undefined" && window.history.length <= 1
  );

  const handleBack = () => {
    if (fromPublish) { router.replace("/"); return; }
    if (isDeepLink) {
      // replace (não push) para que o próximo "voltar" na loja vá ao início.
      if (listing?.user_id) router.replace(`/store/${listing.user_id}`);
      else router.replace("/");
      return;
    }
    router.back();
  };

  // Limpa o "?from=publish" da barra de endereço (não polui um link compartilhado a partir
  // daqui) sem empilhar uma entrada nova no histórico — replace troca só a entrada atual.
  useEffect(() => {
    if (fromPublish) router.replace(window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listingId || Number.isNaN(listingId)) {
      setError("Anúncio não encontrado.");
      setLoading(false);
      return;
    }

    let mounted = true;

    // Al cambiar de anuncio sin desmontar (raro): re-sembrar el estado optimista
    // desde el preview del nuevo id (los initializers de useState solo corren al montar).
    if (didInitRef.current) {
      const p = getListingPreview(listingId);
      setListing(p ? { id: p.id, title: p.title, price: p.price, price_text: p.price_text, condition: p.condition, description: p.description } : null);
      setPhotos(p?.firstPhoto ? [{ id: -1, photo_url: p.firstPhoto, sort_order: 0 }] : []);
      setLocality(p?.localityName ? { name: p.localityName } : null);
      setSeller(null); setAvatarError(false); setSubzone(null); setServiceZones([]); setCategory(null); setSubcategory(null);
      setPhotoIdx(0);
      setLoading(!p);
      setFullyLoaded(false);
    }
    didInitRef.current = true;
    setError(null);

    async function load() {
      // Single query: listing + all related data via PostgREST joins
      // Note: subzones join excluded (no FK constraint on subzone_id)
      // Note: profiles NOT joined here — whatsapp is fetched lazily on contact click
      // Si venís de una card, la query ya se lanzó en el onClick (prefetch) y viaja en
      // paralelo con la navegación → acá se consume la respuesta ya en vuelo. Deep link /
      // F5 no tiene prefetch → cae al fallback (misma query, mismo select compartido).
      const prefetched = takeListingDetailPrefetch(listingId);
      const { data: full, error: le } = prefetched
        ? await prefetched
        : await supabase
            .from("listings")
            .select(LISTING_DETAIL_SELECT)
            .eq("id", listingId)
            .single();

      if (!mounted) return;
      if (le || !full) {
        setError("Anúncio não encontrado.");
        setLoading(false);
        return;
      }

      setListing(full);

      // Tracking de vista (una sola vez por anuncio cargado)
      if (viewTracked.current !== listingId) {
        viewTracked.current = listingId;
        trackListingView(listingId, session?.user?.id ?? null);
      }

      setPhotos([...(full.listing_photos ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setCategory(full.categories ?? null);
      setSubcategory(full.subcategories ?? null);
      setLocality(full.localities ?? null);
      setLoading(false);
      setFullyLoaded(true);

      // Datos secundarios en paralelo (dependen de la query principal):
      // - seller público (nombre + avatar, sin teléfono)
      // - subzone aparte (subzone_id no tiene FK → join PostgREST no disponible)
      const needsZones = full.location_type === "zonas_de_atencion" && !full.covers_all_island;
      const [sellerRes, subzoneRes, zonesRes] = await Promise.all([
        full.user_id
          ? supabase.from("profiles_public").select("id,full_name,avatar_url").eq("id", full.user_id).single()
          : Promise.resolve({ data: null }),
        full.subzone_id
          ? supabase.from("subzones").select("id,name").eq("id", full.subzone_id).single()
          : Promise.resolve({ data: null }),
        needsZones
          ? supabase.from("listing_service_zones").select("subzones(name, locality_id, localities(name))").eq("listing_id", listingId)
          : Promise.resolve({ data: [] }),
      ]);
      if (!mounted) return;
      setSeller(sellerRes.data ?? null);
      setSubzone(subzoneRes.data ?? null);
      setServiceZones(zonesRes.data ?? []);
    }

    load();
    return () => { mounted = false; };
  }, [listingId]);

  const openLightbox = (idx: number) => {
    setLightboxIdx(idx);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const lightboxNext = useCallback(() => {
    setLightboxIdx((i) => (i + 1) % photos.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [photos.length]);

  const lightboxPrev = useCallback(() => {
    setLightboxIdx((i) => (i - 1 + photos.length) % photos.length);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [photos.length]);

  // Close on Escape / navigate with arrow keys
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") lightboxNext();
      if (e.key === "ArrowLeft") lightboxPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, closeLightbox, lightboxNext, lightboxPrev]);

  // Mouse drag to pan when zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  };
  const handleMouseUp = () => setIsDragging(false);

  // Scroll wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.005)));
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  };

  // Touch: pinch-to-zoom + double-tap
  const lastTap = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStart.current = { dist: Math.hypot(dx, dy), panX: pan.x, panY: pan.y };
    } else if (e.touches.length === 1) {
      // double tap to zoom
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setZoom((z) => (z > 1 ? 1 : 2.5));
        setPan({ x: 0, y: 0 });
      }
      lastTap.current = now;
      // prepare drag
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
      setIsDragging(true);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStart.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / touchStart.current.dist;
      setZoom((z) => Math.min(5, Math.max(1, z * scale)));
      touchStart.current.dist = dist;
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      setPan({
        x: dragStart.current.panX + (e.touches[0].clientX - dragStart.current.x),
        y: dragStart.current.panY + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };
  const handleTouchEnd = () => {
    touchStart.current = null;
    setIsDragging(false);
  };

  // Pre-fetch seller phone so the contact button is fully synchronous (avoids mobile popup blocker).
  // T10: se dispara apenas se conoce user_id + sesión (sin esperar a que cargue el
  // perfil público del vendedor), en paralelo con la 2ª tanda de queries.
  useEffect(() => {
    const uid = listing?.user_id;
    if (!session) { setSellerPhone(null); setPhoneLoaded(true); return; }
    if (!uid) { setSellerPhone(null); setPhoneLoaded(false); return; }
    setPhoneLoaded(false);
    let active = true;
    supabase.rpc("get_seller_whatsapp", { seller_id: uid })
      .then(({ data }) => { if (active) { setSellerPhone(data ?? null); setPhoneLoaded(true); } });
    return () => { active = false; };
  }, [session, listing?.user_id]);

  // Estado de favorito desde el caché de sesión (T3 V2): mismo Set que /listings y
  // /store ya cargaron. Con caché caliente: 0 RTT por detalle. Sin caché (deep link):
  // se carga el Set completo 1 vez y sirve para todos los detalles siguientes.
  useEffect(() => {
    if (!session || !listingId || Number.isNaN(listingId)) { setIsFavorite(false); return; }
    const uid = session.user.id;
    const cached = getCachedFavorites(uid);
    if (cached) { setIsFavorite(cached.has(listingId)); return; }
    let mounted = true;
    loadFavorites(uid).then((ids) => { if (mounted) setIsFavorite(ids.has(listingId)); });
    return () => { mounted = false; };
  }, [session, listingId]);

  const toggleFavorite = async () => {
    if (!session) { router.push("/signin?msg=fav"); return; }
    const uid = session.user.id;
    setFavBusy(true);
    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("profile_id", uid);
      // Actualizar el caché para que el cambio se refleje al volver a la lista/loja.
      removeFavorite(uid, listingId);
      setIsFavorite(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ listing_id: listingId, profile_id: uid });
      addFavorite(uid, listingId);
      setIsFavorite(true);
    }
    setFavBusy(false);
  };

  // URL do WhatsApp pré-calculada (usada num <a> nativo — não é bloqueado por popup blockers)
  const waHref = sellerPhone
    ? buildWaUrl(
        sellerPhone,
        (category?.whatsapp_message ?? `Olá! Vi seu anúncio "${listing?.title}" no Mercado Ilha e quero saber mais.`)
          .replace("[título]", listing?.title ?? "")
          .replace("[title]", listing?.title ?? "")
      )
    : null;

  // Fallback para quando ainda não há telefone (não logado ou vendedor sem número)
  const handleContactFallback = () => {
    if (!session) { router.push("/signin?msg=contact"); return; }
    if (!phoneLoaded) return; // teléfono aún cargando: no afirmar que no tiene número
    alert("Este vendedor ainda não cadastrou o número de WhatsApp.");
  };

  const sendReport = async () => {
    if (!reportReason.trim()) return;
    await supabase.from("reports").insert({
      listing_id: listingId,
      reporter_profile_id: session?.user?.id ?? null,
      reason: reportReason,
      status: "new",
    });
    setReportSent(true);
    setReportOpen(false);
  };

  // ── States ──
  // Spinner solo en deep link / refresh sin datos previos; navegando desde una card
  // hay preview → se pinta el layout al instante (T9).
  if (loading && !listing) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  if (error || !listing) return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/listings" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Anúncio</h1>
      </header>
      <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>😕</div>
        <p style={{ fontWeight: 700, color: "#1e293b" }}>Anúncio não encontrado</p>
        <Link href="/listings" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>Ver anúncios</Link>
      </div>
    </div>
  );

  const price = listing.price != null
    ? `R$ ${Number(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : listing.price_text ?? "Consulte";
  // Quando há preço fixo, o texto de preço vira uma nota curta abaixo do valor (mesma
  // regra do card em components/ListingCard.tsx).
  const priceNote = listing.price != null ? (listing.price_text?.trim() || null) : null;

  // Requiere user_id conocido (llega con la query completa) para no marcar "dueño"
  // durante el render optimista, cuando aún no sabemos de quién es el anuncio.
  const isOwner = !!listing.user_id && session?.user?.id === listing.user_id;

  return (
    <div className="page-body" style={{ background: "#fff" }}>
      {/* Header */}
      <header className="page-header">
        <button
          type="button"
          onClick={handleBack}
          style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
        >←</button>
        <h1 style={{ fontSize: "1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {listing.title}
        </h1>
        {!isOwner && (
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={favBusy}
            title={session ? (isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos") : "Entre para favoritar"}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: favBusy ? "wait" : "pointer",
              fontSize: "1.15rem",
              flexShrink: 0,
              transition: "background 0.15s, transform 0.1s",
            }}
          >
            {favBusy ? "⏳" : isFavorite ? "❤️" : "🤍"}
          </button>
        )}
      </header>

      {/* ── Galería de fotos ── */}
      <div style={{ position: "relative", background: "#fff" }}>
        {photos.length > 0 ? (
          <>
            <div
              onClick={() => openLightbox(photoIdx)}
              style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#fff", cursor: "zoom-in" }}
            >
              <Image
                src={photos[photoIdx]?.photo_url}
                alt={listing.title}
                fill
                priority={photoIdx === 0}
                sizes="(max-width: 480px) 100vw, 480px"
                style={{ objectFit: "contain" }}
              />
            </div>
            {/* Counter */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 12,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                fontSize: "0.75rem",
                fontWeight: 700,
                borderRadius: 999,
                padding: "3px 10px",
              }}
            >
              {photoIdx + 1}/{photos.length}
            </div>
            {/* Prev / Next */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: "1rem" }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "#fff", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: "1rem" }}
                >
                  ›
                </button>
              </>
            )}
            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div style={{ display: "flex", gap: 4, padding: "6px 8px", background: "#fff", overflowX: "auto" }}>
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    style={{ padding: 0, border: i === photoIdx ? "2px solid var(--blue-main)" : "2px solid transparent", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}
                  >
                    <Image src={p.photo_url} alt="" width={44} height={44} sizes="44px" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, display: "block" }} />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>
            🛍️
          </div>
        )}
      </div>

      {/* ── Info principal ── */}
      <div style={{ padding: "1rem" }}>

        {/* Título + condição (na mesma linha) + preço */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", lineHeight: 1.3 }}>
            {listing.title}
          </h2>
          {listing.condition && (
            <span className="badge badge-sand" style={{ flexShrink: 0, marginTop: 2 }}>{listing.condition}</span>
          )}
        </div>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--blue-main)", marginBottom: priceNote ? 2 : 16 }}>
          {price}
        </div>

        {/* Detalhe opcional do preço (ex: "por unidade", "a combinar"): mesma nota que já
            aparece no card, menor e logo abaixo do preço. */}
        {priceNote && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
            {priceNote}
          </div>
        )}

        {/* Descripción: si el preview del feed ya la trajo (LISTINGS_SELECT/STORE_SELECT),
            se pinta al instante aunque la query del detalle no haya vuelto. Si todavía no
            hay descripción y la query no confirmó (!fullyLoaded), skeleton. El "sin
            descripción" (render vacío) solo se resuelve cuando fullyLoaded confirma que
            realmente no hay — un preview con description:null (caché viejo) no lo prueba. */}
        {listing.description || listing.description_rich ? (
          <RichText
            rich={listing.description_rich}
            plain={listing.description}
            style={{ fontSize: "1.05rem", color: "#111", lineHeight: 1.65, marginBottom: 16 }}
          />
        ) : fullyLoaded ? null : (
          <div style={{ marginBottom: 16 }} aria-hidden>
            {[92, 88, 70].map((w, i) => (
              <div key={i} style={{ height: 12, width: `${w}%`, background: "#eef2f7", borderRadius: 6, marginBottom: 8 }} />
            ))}
          </div>
        )}

        {/* Ubicación (sem recuadro) */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: "1.1rem", marginTop: 1 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--blue-main)" }}>
              {listing.location_type === "zonas_de_atencion"
                ? listing.covers_all_island
                  ? "Toda a ilha"
                  : (() => {
                      const byLoc = new Map<string, string[]>();
                      for (const r of serviceZones) {
                        const lname = r.subzones?.localities?.name ?? "—";
                        const zname = r.subzones?.name;
                        if (!zname) continue;
                        if (!byLoc.has(lname)) byLoc.set(lname, []);
                        byLoc.get(lname)!.push(zname);
                      }
                      const parts = Array.from(byLoc.entries()).map(([l, zs]) => `${l} (${zs.join(", ")})`);
                      return parts.length ? `Atende: ${parts.join(" · ")}` : "Zonas de atendimento";
                    })()
                : (
                  <>
                    {locality?.name ?? "Tinharé"}
                    {subzone && ` · ${subzone.name}`}
                  </>
                )}
            </div>
            {listing.other_location_text && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                {listing.other_location_text}
              </div>
            )}
          </div>
        </div>

        {/* Vendedor (skeleton mientras carga el perfil público — T9) */}
        {seller ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "0.875rem",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--blue-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
                flexShrink: 0,
                overflow: "hidden",
              }}
            >
              {seller.avatar_url && !avatarError ? (
                <Image src={seller.avatar_url} alt={seller.full_name} width={44} height={44} sizes="44px" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setAvatarError(true)} />
              ) : "👤"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{seller.full_name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Vendedor</div>
            </div>
            <Link
              href={`/store/${seller.id}`}
              style={{
                fontSize: "0.92rem",
                color: "#fff",
                fontWeight: 700,
                textDecoration: "none",
                background: "var(--blue-main)",
                padding: "0.6rem 1.1rem",
                borderRadius: 999,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              Ver loja →
            </Link>
          </div>
        ) : (!isOwner && listing.user_id ? (
          <div
            style={{
              background: "#fff", border: "1px solid var(--border)", borderRadius: 12,
              padding: "0.875rem", marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
            }}
            aria-hidden
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#eef2f7", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: "55%", background: "#eef2f7", borderRadius: 6, marginBottom: 6 }} />
              <div style={{ height: 10, width: "30%", background: "#f1f5f9", borderRadius: 6 }} />
            </div>
          </div>
        ) : null)}

        {/* Botão WhatsApp — aparece assim que se sabe que não é o dono (T10), sem esperar
            o perfil do vendedor. <a> nativo quando há telefone (evita bloqueio de popup). */}
        {!isOwner && listing.user_id && (
          waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWhatsappClick(listingId, "listing")}
              className="btn btn-whatsapp btn-block"
              style={{ fontSize: "1.05rem", padding: "0.875rem", marginBottom: 12, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              💬 {category?.contact_button_text ?? "Contatar"} pelo WhatsApp
            </a>
          ) : (
            <button
              type="button"
              onClick={handleContactFallback}
              className="btn btn-whatsapp btn-block"
              style={{ fontSize: "1.05rem", padding: "0.875rem", marginBottom: 12, cursor: "pointer" }}
            >
              💬 {category?.contact_button_text ?? "Contatar"} pelo WhatsApp
            </button>
          )
        )}

        {/* Se é o dono, mostrar opções */}
        {isOwner && (
          <div
            style={{
              background: "var(--blue-xlight)",
              borderRadius: 12,
              padding: "0.875rem",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "var(--blue-main)", fontWeight: 700 }}>
              Este é o seu anúncio
            </span>
            <Link
              href={`/listings/${listingId}/edit`}
              style={{
                background: "var(--sand)",
                color: "#fff",
                borderRadius: 10,
                padding: "0.5rem 1.05rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(239, 159, 39, 0.45)",
              }}
            >
              Editar anúncio
            </Link>
          </div>
        )}

        {/* Compartilhar anúncio */}
        <button
          type="button"
          onClick={() =>
            compartilhar({
              title: listing.title,
              text: "Vi este anúncio no Mercado Ilha: " + listing.title,
              url: window.location.href,
            })
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            padding: "0.75rem",
            marginBottom: 12,
            background: "#fff",
            border: "2px solid var(--blue-main)",
            borderRadius: 12,
            color: "var(--blue-main)",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: "pointer",
          }}
        >
          <ShareIcon /> Compartilhar anúncio
        </button>

        {/* Denunciar */}
        {!isOwner && !reportSent && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            {!reportOpen ? (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline" }}
              >
                Denunciar anúncio
              </button>
            ) : (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "0.875rem",
                  textAlign: "left",
                }}
              >
                <p style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 8 }}>Por que você está denunciando?</p>
                <select
                  className="form-select"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Selecione...</option>
                  <option value="spam">Spam / Publicidade enganosa</option>
                  <option value="falso">Informações falsas</option>
                  <option value="proibido">Produto/serviço proibido</option>
                  <option value="golpe">Suspeita de golpe</option>
                  <option value="outro">Outro</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setReportOpen(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={sendReport} disabled={!reportReason}>
                    Enviar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {reportSent && (
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", marginTop: 8 }}>
            ✅ Denúncia enviada. Obrigado!
          </p>
        )}

      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          {/* Top bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(0,0,0,0.5)", zIndex: 2 }}>
            <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>
              {lightboxIdx + 1} / {photos.length}
            </span>
            {zoom > 1 && (
              <button
                type="button"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 700 }}
              >
                Resetar zoom
              </button>
            )}
            <button
              type="button"
              onClick={closeLightbox}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 36, height: 36, fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>

          {/* Image container */}
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={() => { setZoom((z) => (z > 1 ? 1 : 2.5)); setPan({ x: 0, y: 0 }); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={photos[lightboxIdx]?.photo_url}
              alt={listing.title}
              draggable={false}
              style={{
                maxWidth: "100vw",
                maxHeight: "100vh",
                objectFit: "contain",
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.15s ease",
                userSelect: "none",
                WebkitUserSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={lightboxPrev}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: "1.4rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={lightboxNext}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: "1.4rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
              >
                ›
              </button>
            </>
          )}

          {/* Thumbnail strip at bottom */}
          {photos.length > 1 && (
            <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, padding: "0 16px", zIndex: 2 }}>
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setLightboxIdx(i); setZoom(1); setPan({ x: 0, y: 0 }); }}
                  style={{
                    padding: 0,
                    border: i === lightboxIdx ? "2px solid #fff" : "2px solid rgba(255,255,255,0.3)",
                    borderRadius: 6,
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: i === lightboxIdx ? 1 : 0.55,
                    transition: "opacity 0.15s",
                  }}
                >
                  <Image src={p.photo_url} alt="" width={52} height={52} sizes="52px" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 4, display: "block" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
