"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { compressImage, normalizeFile } from "../../lib/imageUtils";

type Category = { id: number; name: string; slug: string; location_type: string; contact_button_text: string; whatsapp_message: string | null; expires_in_days: number | null };
type Subcategory = { id: number; name: string };
type Locality = { id: number; name: string };
type Subzone = { id: number; name: string };

export default function PublishPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form data
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [subzones, setSubzones] = useState<Subzone[]>([]);
  const [islandId, setIslandId] = useState<number | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [localityId, setLocalityId] = useState("");
  const [subzoneId, setSubzoneId] = useState("");
  const [otherLocation, setOtherLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceText, setPriceText] = useState("");
  const [condition, setCondition] = useState("");
  const [coversAllIsland, setCoversAllIsland] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data?.session ?? null;
      setSession(s);
      if (s) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", s.user.id).single();
        setProfile(p);
      }
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) { setAuthLoading(false); }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  // Load static data
  useEffect(() => {
    supabase.from("categories").select("id,name,slug,location_type,contact_button_text,whatsapp_message,expires_in_days").eq("is_active", true).order("sort_order").then(({ data }) => setCategories(data ?? []));
    supabase.from("islands").select("id").eq("slug", "tinhare").single().then(({ data }) => setIslandId(data?.id ?? null));
    supabase.from("localities").select("id,name").eq("is_active", true).order("sort_order").then(({ data }) => setLocalities(data ?? []));
  }, []);

  // Load subcategories on category change
  useEffect(() => {
    setSubcategoryId("");
    setSubcategories([]);
    if (!categoryId) return;
    supabase.from("subcategories").select("id,name").eq("category_id", Number(categoryId)).eq("is_active", true).order("sort_order").then(({ data }) => setSubcategories(data ?? []));
  }, [categoryId]);

  // Load subzones on locality change
  useEffect(() => {
    setSubzoneId("");
    setSubzones([]);
    if (!localityId) return;
    supabase.from("subzones").select("id,name").eq("locality_id", Number(localityId)).eq("is_active", true).order("sort_order").then(({ data }) => setSubzones(data ?? []));
  }, [localityId]);

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const locationType = selectedCategory?.location_type ?? "";

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files ?? []).slice(0, 6 - photos.length);
    if (!raw.length) return;
    e.target.value = "";
    const files = await Promise.all(raw.map(normalizeFile));
    setPhotos((prev) => [...prev, ...files].slice(0, 6));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string].slice(0, 6));
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !profile) return;
    setSubmitting(true);
    setError(null);

    if (!categoryId || !subcategoryId || !localityId || !title.trim() || !description.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      setSubmitting(false);
      return;
    }

    // Validate subzone
    const needsSubzone = locationType === "fija" && !coversAllIsland;
    if (needsSubzone && !subzoneId) {
      setError("Selecione a sub-zona.");
      setSubmitting(false);
      return;
    }

    const selectedSubcat = subcategories.find((s) => s.id === Number(subcategoryId));
    const expiresAt = selectedCategory?.expires_in_days
      ? new Date(Date.now() + selectedCategory.expires_in_days * 86400000).toISOString()
      : null;

    // Insert listing
    const { data: listing, error: insertErr } = await supabase
      .from("listings")
      .insert({
        user_id: session.user.id,
        category_id: Number(categoryId),
        subcategory_id: Number(subcategoryId),
        island_id: islandId,
        locality_id: Number(localityId),
        subzone_id: subzoneId ? Number(subzoneId) : null,
        other_location_text: subzoneId === "outros" ? otherLocation : null,
        title: title.trim(),
        description: description.trim(),
        price: price ? Number(price.replace(",", ".")) : null,
        price_text: !price && priceText ? priceText : null,
        condition: condition || null,
        contact_button_text: selectedCategory?.contact_button_text ?? "Contatar",
        whatsapp_message: selectedCategory?.whatsapp_message ?? null,
        location_type: locationType || "fija",
        covers_all_island: coversAllIsland,
        expires_at: expiresAt,
        status: "active",
      })
      .select()
      .single();

    if (insertErr || !listing) {
      setError(insertErr?.message ?? "Erro ao publicar. Tente novamente.");
      setSubmitting(false);
      return;
    }

    // Upload photos to R2
    if (photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        try {
          const compressed = await compressImage(photos[i]);
          const form = new FormData();
          form.append("file", compressed);
          form.append("folder", "listings");

          const res = await fetch("/api/upload", { method: "POST", body: form });
          const data = await res.json();

          if (res.ok && data.url) {
            await supabase.from("listing_photos").insert({
              listing_id: listing.id,
              photo_url: data.url,
              storage_path: data.key ?? null,
              sort_order: i,
            });
          }
        } catch {
          // continue uploading remaining photos even if one fails
        }
      }
    }

    setSuccess(true);
    setTimeout(() => router.push(`/listings/${listing.id}`), 1500);
  };

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Not logged in ──
  if (!session) {
    return (
      <div className="page-body">
        <header className="page-header">
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <h1>Publicar anúncio</h1>
        </header>
        <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔒</div>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1e293b", marginBottom: 8 }}>
            Faça login para publicar
          </p>
          <p className="text-muted" style={{ marginBottom: 24 }}>
            Você precisa de uma conta para anunciar no Mercado Ilha.
          </p>
          <Link href="/signin" className="btn btn-primary btn-block">
            Entrar / Cadastrar
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="page-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "2rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontWeight: 800, color: "var(--blue-main)", marginBottom: 8 }}>Anúncio publicado!</h2>
        <p className="text-muted">Redirecionando...</p>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Publicar anúncio</h1>
      </header>

      <form onSubmit={handleSubmit} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Fotos */}
        <div className="card" style={{ padding: "0.875rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 10 }}>
            Fotos <span className="text-muted">(até 6)</span>
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {photoPreviews.map((src, i) => (
              <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 6 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ width: 72, height: 72, borderRadius: 8, border: "2px dashed var(--blue-light)", background: "var(--blue-xlight)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, color: "var(--blue-main)", fontSize: "0.65rem", fontWeight: 700 }}
              >
                <span style={{ fontSize: "1.4rem" }}>📷</span>
                Adicionar
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoChange} />
        </div>

        {/* Categoria */}
        <div className="form-group">
          <label className="form-label">Categoria *</label>
          <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Selecione uma categoria...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Subcategoria */}
        {subcategories.length > 0 && (
          <div className="form-group">
            <label className="form-label">Subcategoria *</label>
            <select className="form-select" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} required>
              <option value="">Selecione...</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Título */}
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" type="text" placeholder="Ex: iPhone 12 64GB preto" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>

        {/* Descripción */}
        <div className="form-group">
          <label className="form-label">Descrição *</label>
          <textarea className="form-textarea" placeholder="Descreva o que você está anunciando..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required />
        </div>

        {/* Precio */}
        <div className="card" style={{ padding: "0.875rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 10 }}>Preço</p>
          <div className="form-group">
            <label className="form-label">Valor em R$</label>
            <input className="form-input" type="number" placeholder="0,00" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {!price && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Ou texto de preço</label>
              <input className="form-input" type="text" placeholder='Ex: "A combinar", "Sob consulta"' value={priceText} onChange={(e) => setPriceText(e.target.value)} maxLength={60} />
            </div>
          )}
        </div>

        {/* Condición (solo para produtos) */}
        {selectedCategory?.slug === "produtos" && (
          <div className="form-group">
            <label className="form-label">Condição</label>
            <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Não informado</option>
              <option value="Novo">Novo</option>
              <option value="Seminovo">Seminovo</option>
              <option value="Usado">Usado</option>
            </select>
          </div>
        )}

        {/* Localidade */}
        <div className="form-group">
          <label className="form-label">Localidade *</label>
          <select className="form-select" value={localityId} onChange={(e) => setLocalityId(e.target.value)} required>
            <option value="">Selecione a localidade...</option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Cobertura toda a ilha (para zonas de atención) */}
        {locationType === "zonas_de_atencion" && (
          <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem" }}>
            <input type="checkbox" checked={coversAllIsland} onChange={(e) => setCoversAllIsland(e.target.checked)} style={{ width: 18, height: 18 }} />
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Atendo em toda a ilha</span>
          </label>
        )}

        {/* Subzona */}
        {localityId && subzones.length > 0 && !coversAllIsland && (
          <div className="form-group">
            <label className="form-label">
              {locationType === "zonas_de_atencion" ? "Zonas de atendimento" : "Sub-zona *"}
            </label>
            <select className="form-select" value={subzoneId} onChange={(e) => setSubzoneId(e.target.value)} required={locationType === "fija"}>
              <option value="">Selecione...</option>
              {subzones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Referência para "Outros" */}
        {subzoneId && subzones.find((z) => z.id === Number(subzoneId))?.name === "Outros" && (
          <div className="form-group">
            <label className="form-label">Referência da localização</label>
            <input className="form-input" type="text" placeholder='Ex: "Perto da Pousada Sol"' value={otherLocation} onChange={(e) => setOtherLocation(e.target.value)} maxLength={120} />
          </div>
        )}

        {/* Error */}
        {error && <p className="text-error">{error}</p>}

        {/* Submit */}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: "0.875rem", fontSize: "1rem", marginTop: 4 }}>
          {submitting ? "Publicando..." : "✅ Publicar anúncio"}
        </button>

        <p className="text-muted text-center" style={{ fontSize: "0.78rem", paddingBottom: "0.5rem" }}>
          Seu anúncio ficará visível imediatamente após publicação.
        </p>
      </form>
    </div>
  );
}
