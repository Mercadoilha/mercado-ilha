"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { buildWaUrl } from "../../../lib/whatsappUrl";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = Number(params?.id);

  const [listing, setListing] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [seller, setSeller] = useState<any>(null);
  const [category, setCategory] = useState<any>(null);
  const [subcategory, setSubcategory] = useState<any>(null);
  const [locality, setLocality] = useState<any>(null);
  const [subzone, setSubzone] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session ?? null));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => l?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!listingId || Number.isNaN(listingId)) {
      setError("Anúncio não encontrado.");
      setLoading(false);
      return;
    }

    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: l, error: le } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();

      if (!mounted) return;
      if (le || !l) {
        setError("Anúncio não encontrado.");
        setLoading(false);
        return;
      }
      setListing(l);

      // Load related data in parallel
      const [photosRes, sellerRes, catRes, subCatRes, locRes, subzoneRes] = await Promise.all([
        supabase.from("listing_photos").select("*").eq("listing_id", l.id).order("sort_order"),
        supabase.from("profiles").select("id,full_name,whatsapp").eq("id", l.user_id).single(),
        l.category_id ? supabase.from("categories").select("id,name,slug,contact_button_text,whatsapp_message").eq("id", l.category_id).single() : Promise.resolve({ data: null }),
        l.subcategory_id ? supabase.from("subcategories").select("id,name").eq("id", l.subcategory_id).single() : Promise.resolve({ data: null }),
        l.locality_id ? supabase.from("localities").select("id,name").eq("id", l.locality_id).single() : Promise.resolve({ data: null }),
        l.subzone_id ? supabase.from("subzones").select("id,name").eq("id", l.subzone_id).single() : Promise.resolve({ data: null }),
      ]);

      if (!mounted) return;
      setPhotos(photosRes.data ?? []);
      setSeller(sellerRes.data ?? null);
      setCategory(catRes.data ?? null);
      setSubcategory(subCatRes.data ?? null);
      setLocality(locRes.data ?? null);
      setSubzone(subzoneRes.data ?? null);
      setLoading(false);
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

  // Load favorite status whenever session or listing changes
  useEffect(() => {
    if (!session || !listingId || Number.isNaN(listingId)) { setIsFavorite(false); return; }
    supabase
      .from("favorites")
      .select("id")
      .eq("profile_id", session.user.id)
      .eq("listing_id", listingId)
      .maybeSingle()
      .then(({ data }) => setIsFavorite(!!data));
  }, [session, listingId]);

  const toggleFavorite = async () => {
    if (!session) { router.push("/signin?msg=fav"); return; }
    setFavBusy(true);
    if (isFavorite) {
      await supabase
        .from("favorites")
        .delete()
        .eq("listing_id", listingId)
        .eq("profile_id", session.user.id);
      setIsFavorite(false);
    } else {
      await supabase
        .from("favorites")
        .insert({ listing_id: listingId, profile_id: session.user.id });
      setIsFavorite(true);
    }
    setFavBusy(false);
  };

  const buildWhatsAppUrl = () => {
    if (!seller?.whatsapp) return "#";
    const template = category?.whatsapp_message ?? `Olá! Vi seu anúncio "${listing?.title}" no Mercado Ilha e quero saber mais.`;
    const message = template.replace("[título]", listing?.title ?? "").replace("[title]", listing?.title ?? "");
    return buildWaUrl(seller.whatsapp, message);
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
  if (loading) return (
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

  const isOwner = session?.user?.id === listing.user_id;

  return (
    <div className="page-body">
      {/* Header */}
      <header className="page-header">
        <Link href="/listings" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
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
      <div style={{ position: "relative", background: "#e8eef6" }}>
        {photos.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIdx]?.photo_url}
              alt={listing.title}
              onClick={() => openLightbox(photoIdx)}
              style={{ width: "100%", height: 260, objectFit: "cover", display: "block", cursor: "zoom-in" }}
            />
            {/* Zoom hint */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: 12,
                background: "rgba(0,0,0,0.45)",
                color: "#fff",
                fontSize: "0.68rem",
                fontWeight: 600,
                borderRadius: 999,
                padding: "3px 8px",
                pointerEvents: "none",
              }}
            >
              🔍 Toque para ampliar
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo_url} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, display: "block" }} />
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

        {/* Badges */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {category && <span className="badge badge-blue">{category.name}</span>}
          {subcategory && <span className="badge badge-blue">{subcategory.name}</span>}
          {listing.condition && <span className="badge badge-sand">{listing.condition}</span>}
        </div>

        {/* Título + precio */}
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1e293b", lineHeight: 1.3, marginBottom: 6 }}>
          {listing.title}
        </h2>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--blue-main)", marginBottom: 12 }}>
          {price}
        </div>

        {/* Descripción */}
        <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.65, marginBottom: 16 }}>
          {listing.description}
        </p>

        {/* Ubicación */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "var(--blue-xlight)",
            borderRadius: 10,
            padding: "0.75rem",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: "1.1rem", marginTop: 1 }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--blue-main)" }}>
              {locality?.name ?? "Tinharé"}
              {subzone && ` · ${subzone.name}`}
              {listing.covers_all_island && " · Toda a ilha"}
            </div>
            {listing.other_location_text && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                {listing.other_location_text}
              </div>
            )}
          </div>
        </div>

        {/* Vendedor */}
        {seller && (
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
              }}
            >
              👤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>{seller.full_name}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Vendedor</div>
            </div>
            <Link
              href={`/store/${seller.id}`}
              style={{ fontSize: "0.78rem", color: "var(--blue-main)", fontWeight: 700, textDecoration: "none" }}
            >
              Ver loja →
            </Link>
          </div>
        )}

        {/* Botão WhatsApp */}
        {!isOwner && (
          seller?.whatsapp ? (
            <button
              type="button"
              onClick={() => {
                if (!session) { router.push("/signin?msg=contact"); return; }
                window.open(buildWhatsAppUrl(), "_blank", "noreferrer");
              }}
              className="btn btn-whatsapp btn-block"
              style={{ fontSize: "1.05rem", padding: "0.875rem", marginBottom: 12, cursor: "pointer" }}
            >
              💬 {category?.contact_button_text ?? "Contatar"} pelo WhatsApp
            </button>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "0.875rem",
                background: "#f1f5f9",
                borderRadius: 12,
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                marginBottom: 12,
              }}
            >
              Contato não disponível
            </div>
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
              textAlign: "center",
              fontSize: "0.875rem",
              color: "var(--blue-main)",
              fontWeight: 700,
            }}
          >
            ✏️ Este é o seu anúncio
          </div>
        )}

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 4, display: "block" }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
