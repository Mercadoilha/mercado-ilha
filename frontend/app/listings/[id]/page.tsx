"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function ListingDetailPage() {
  const params = useParams();
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

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

  const buildWhatsAppUrl = () => {
    if (!seller?.whatsapp) return "#";
    const raw = seller.whatsapp.replace(/\D/g, "");
    const number = raw.startsWith("55") ? raw : `55${raw}`;
    const template = category?.whatsapp_message ?? `Olá! Vi seu anúncio "${listing?.title}" no Mercado Ilha e quero saber mais.`;
    const message = template.replace("[título]", listing?.title ?? "").replace("[title]", listing?.title ?? "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
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
        <h1 style={{ fontSize: "1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {listing.title}
        </h1>
      </header>

      {/* ── Galería de fotos ── */}
      <div style={{ position: "relative", background: "#e8eef6" }}>
        {photos.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[photoIdx]?.photo_url}
              alt={listing.title}
              style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }}
            />
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
            <a
              href={buildWhatsAppUrl()}
              target="_blank"
              rel="noreferrer"
              className="btn btn-whatsapp btn-block"
              style={{ fontSize: "1.05rem", padding: "0.875rem", marginBottom: 12 }}
            >
              💬 {category?.contact_button_text ?? "Contatar"} pelo WhatsApp
            </a>
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
    </div>
  );
}
