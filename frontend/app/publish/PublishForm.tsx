"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabaseClient";
import { compressImage, normalizeFile } from "../../lib/imageUtils";
import { getCategoryPlaceholders } from "../../lib/categoryPlaceholders";
import ExtraCategoriesPicker, { ExtraCategoryEntry } from "../../components/ExtraCategoriesPicker";
import type { PhotoAdjustResult } from "../../components/PhotoAdjustModal";

// El modal de ajuste solo se descarga cuando el usuario toca una foto:
// cero costo en la carga de /publish.
const PhotoAdjustModal = dynamic(() => import("../../components/PhotoAdjustModal"), { ssr: false });

type Category = { id: number; name: string; slug: string; location_type: string; contact_button_text: string; whatsapp_message: string | null; expires_in_days: number | null };
type Subcategory = { id: number; name: string };
type Locality = { id: number; name: string };
type Subzone = { id: number; name: string; locality_id: number };

type PublishFormProps = {
  categories: Category[];
  localities: Locality[];
  allSubzones: Subzone[];
  islandId: number | null;
};

export default function PublishForm({ categories, localities, allSubzones, islandId }: PublishFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form data
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [extraEntries, setExtraEntries] = useState<ExtraCategoryEntry[]>([]);
  const [localityId, setLocalityId] = useState("");
  const [subzoneId, setSubzoneId] = useState("");
  const [serviceZoneIds, setServiceZoneIds] = useState<number[]>([]);
  const [otherLocation, setOtherLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceText, setPriceText] = useState("");
  const [condition, setCondition] = useState("");
  const [coversAllIsland, setCoversAllIsland] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [adjustIdx, setAdjustIdx] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth guard — el formulario se muestra apenas conocemos la sesión.
  // El perfil se carga en segundo plano y NO bloquea el render (el insert
  // solo usa session.user.id; el perfil existe por el trigger de registro).
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data?.session ?? null;
      setSession(s);
      setAuthLoading(false);
      if (s) {
        supabase.from("profiles").select("*").eq("id", s.user.id).single()
          .then(({ data: p }) => setProfile(p));
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) { setAuthLoading(false); }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  // Load subcategories on category change
  useEffect(() => {
    setSubcategoryId("");
    setSubcategories([]);
    if (!categoryId) return;
    supabase.from("subcategories").select("id,name").eq("category_id", Number(categoryId)).eq("is_active", true).order("sort_order").then(({ data }) => setSubcategories(data ?? []));
  }, [categoryId]);

  // Reset subzona al cambiar de localidad (path "fija")
  useEffect(() => { setSubzoneId(""); }, [localityId]);

  // Reset selección de ubicación al cambiar de categoría (evita arrastrar zonas a un anuncio fija)
  useEffect(() => { setServiceZoneIds([]); setCoversAllIsland(false); }, [categoryId]);

  // Si la nueva categoría principal coincide con una secundaria, quitarla (no duplicar).
  useEffect(() => {
    if (!categoryId) return;
    setExtraEntries((prev) => prev.filter((e) => e.categoryId !== categoryId));
  }, [categoryId]);

  const selectedCategory = categories.find((c) => c.id === Number(categoryId));
  const locationType = selectedCategory?.location_type ?? "";
  const ph = getCategoryPlaceholders(selectedCategory?.slug);

  // Sub-zonas de la localidad seleccionada (path "fija")
  const localitySubzones = localityId ? allSubzones.filter((z) => z.locality_id === Number(localityId)) : [];

  const toggleServiceZone = (id: number) =>
    setServiceZoneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleLocalityZones = (localityZoneIds: number[], allSelected: boolean) =>
    setServiceZoneIds((prev) =>
      allSelected
        ? prev.filter((x) => !localityZoneIds.includes(x))
        : Array.from(new Set([...prev, ...localityZoneIds]))
    );

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    if (!raw.length) return;
    e.target.value = "";
    const files = await Promise.all(raw.map(normalizeFile));
    setPhotos((prev) => [...prev, ...files].slice(0, 4));
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string].slice(0, 4));
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
    setPhotoPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const movePhoto = (i: number, dir: -1 | 1) => {
    const swap = <T,>(arr: T[]) => {
      const a = [...arr];
      [a[i], a[i + dir]] = [a[i + dir], a[i]];
      return a;
    };
    setPhotos(swap);
    setPhotoPreviews(swap);
  };

  const applyAdjust = (res: PhotoAdjustResult | null) => {
    if (res && adjustIdx !== null) {
      const base = photos[adjustIdx]?.name.replace(/\.[^.]+$/, "") ?? "foto";
      const file = new File([res.blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
      setPhotos((p) => p.map((f, i) => (i === adjustIdx ? file : f)));
      setPhotoPreviews((p) => p.map((s, i) => (i === adjustIdx ? res.dataUrl : s)));
    }
    setAdjustIdx(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);

    // El perfil (FK de listings.user_id) normalmente ya cargó en segundo plano.
    // Si aún no, lo buscamos ahora en vez de bloquear silenciosamente el botón.
    let prof = profile;
    if (!prof) {
      const { data: p } = await supabase.from("profiles").select("id").eq("id", session.user.id).single();
      prof = p;
      if (p) setProfile(p);
    }
    if (!prof) {
      setError("Não encontramos seu perfil. Recarregue a página e tente novamente.");
      setSubmitting(false);
      return;
    }

    const missingSubcat = subcategories.length > 0 && !subcategoryId;
    if (!categoryId || missingSubcat || !title.trim() || !description.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      setSubmitting(false);
      return;
    }

    // Categorías secundarias: si la categoría tiene subcategorías, la subcategoría es obligatoria.
    const validExtras = extraEntries.filter((e) => e.categoryId);
    if (validExtras.some((e) => e.hasSubcats && !e.subcategoryId)) {
      setError("Escolha a subcategoria das categorias adicionais.");
      setSubmitting(false);
      return;
    }

    // Validate location según tipo de categoría
    const isZonas = locationType === "zonas_de_atencion";
    if (isZonas) {
      if (!coversAllIsland && serviceZoneIds.length === 0) {
        setError("Selecione ao menos uma zona de atendimento ou marque \"toda a ilha\".");
        setSubmitting(false);
        return;
      }
    } else if (locationType === "fija") {
      if (!localityId) {
        setError("Selecione a localidade.");
        setSubmitting(false);
        return;
      }
      if (!subzoneId) {
        setError("Selecione a sub-zona.");
        setSubmitting(false);
        return;
      }
    }

    const expiresAt = new Date(Date.now() + (selectedCategory?.expires_in_days ?? 30) * 86400000).toISOString();

    // Resolver ubicación según el tipo de categoría
    let localityIdToSave: number | null;
    let subzoneIdToSave: number | null;
    let otherText: string | null;
    if (isZonas) {
      const firstZone = allSubzones.find((z) => z.id === serviceZoneIds[0]);
      localityIdToSave = coversAllIsland ? null : firstZone?.locality_id ?? null;
      subzoneIdToSave = null;
      otherText = null;
    } else {
      localityIdToSave = localityId ? Number(localityId) : null;
      subzoneIdToSave = subzoneId ? Number(subzoneId) : null;
      const selZone = localitySubzones.find((z) => z.id === Number(subzoneId));
      otherText = selZone?.name === "Outros" ? otherLocation.trim() || null : null;
    }

    // Insert listing
    const { data: listing, error: insertErr } = await supabase
      .from("listings")
      .insert({
        user_id: session.user.id,
        category_id: Number(categoryId),
        subcategory_id: subcategoryId ? Number(subcategoryId) : null,
        island_id: islandId,
        locality_id: localityIdToSave,
        subzone_id: subzoneIdToSave,
        other_location_text: otherText,
        title: title.trim(),
        description: description.trim(),
        price: price ? Number(price.replace(",", ".")) : null,
        price_text: priceText.trim() || null,
        condition: condition || null,
        contact_button_text: selectedCategory?.contact_button_text ?? "Contatar",
        whatsapp_message: selectedCategory?.whatsapp_message ?? null,
        location_type: locationType || "fija",
        covers_all_island: isZonas ? coversAllIsland : false,
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

    // Guardar zonas de atención (categorías que se trasladan al cliente)
    if (isZonas && !coversAllIsland && serviceZoneIds.length > 0) {
      await supabase.from("listing_service_zones").insert(
        serviceZoneIds.map((zid) => ({ listing_id: listing.id, subzone_id: zid }))
      );
    }

    // Guardar categorías secundarias (solo para descubrimiento; no afectan comportamiento)
    if (validExtras.length > 0) {
      await supabase.from("listing_extra_categories").insert(
        validExtras.map((e) => ({
          listing_id: listing.id,
          category_id: Number(e.categoryId),
          subcategory_id: e.subcategoryId ? Number(e.subcategoryId) : null,
        }))
      );
    }

    // Upload photos to R2 en paralelo: el tiempo total es el de la foto más
    // lenta, no la suma. sort_order se conserva por índice original, no por
    // orden de llegada. Una foto que falla no aborta las demás.
    if (photos.length > 0) {
      const uploaded = await Promise.all(
        photos.map(async (photo, i) => {
          try {
            const compressed = await compressImage(photo);
            const form = new FormData();
            form.append("file", compressed);
            form.append("folder", "listings");

            const res = await fetch("/api/upload", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: form,
            });
            const data = await res.json();

            if (res.ok && data.url) {
              return { listing_id: listing.id, photo_url: data.url, storage_path: data.key ?? null, sort_order: i };
            }
          } catch {
            // esta foto falla, las demás siguen
          }
          return null;
        })
      );
      const rows = uploaded.filter((r): r is NonNullable<typeof r> => r !== null);
      if (rows.length > 0) {
        await supabase.from("listing_photos").insert(rows);
      }
    }

    // Revalida la home (ISR) para que el anúncio aparezca al instante.
    // Fire-and-forget: si falla, igual aparece dentro de la ventana de 60s.
    fetch("/api/revalidate", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});

    setSuccess(true);
    router.push(`/listings/${listing.id}`);
  };

  // ── Auth loading ──
  if (authLoading) {
    const bar = (w: string, h = 14) => (
      <div style={{ width: w, height: h, borderRadius: 6, background: "#e6eef7" }} />
    );
    return (
      <div className="page-body">
        <header className="page-header">
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <h1>Publicar anúncio</h1>
        </header>
        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ background: "var(--blue-xlight)", border: "1px solid var(--blue-light)", borderRadius: 10, padding: "0.75rem", fontSize: "0.85rem", color: "var(--blue-main)", fontWeight: 600 }}>
            💡 Dica: capriche na primeira foto — é a que aparece na lista.
          </div>
          <div className="card" style={{ padding: "0.875rem", display: "flex", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 72, height: 72, borderRadius: 8, background: "#e6eef7" }} />
            ))}
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {bar("35%", 12)}
              {bar("100%", 44)}
            </div>
          ))}
        </div>
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
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 2 }}>
            Fotos <span className="text-muted">(até 4)</span>
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", margin: "0 0 10px" }}>
            A 1ª foto é a capa do anúncio. Toque na foto para girar ou ajustar.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            {photoPreviews.map((src, i) => (
              <div key={i} style={{ width: 72 }}>
                <div style={{ position: "relative", width: 72, height: 72 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    onClick={() => setAdjustIdx(i)}
                    style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)", cursor: "pointer" }}
                  />
                  {i === 0 && (
                    <span style={{ position: "absolute", left: 0, bottom: 0, background: "var(--blue-main)", color: "#fff", fontSize: "0.55rem", fontWeight: 700, padding: "1px 6px", borderRadius: "0 6px 0 8px", pointerEvents: "none", letterSpacing: "0.03em" }}>
                      CAPA
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
                {photoPreviews.length > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => movePhoto(i, -1)}
                      disabled={i === 0}
                      aria-label="Mover para a esquerda"
                      style={{ width: 30, height: 20, borderRadius: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--blue-main)", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1, padding: 0, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1 }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(i, 1)}
                      disabled={i === photoPreviews.length - 1}
                      aria-label="Mover para a direita"
                      style={{ width: 30, height: 20, borderRadius: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--blue-main)", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1, padding: 0, cursor: i === photoPreviews.length - 1 ? "default" : "pointer", opacity: i === photoPreviews.length - 1 ? 0.35 : 1 }}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            ))}
            {photos.length < 4 && (
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

        {adjustIdx !== null && photoPreviews[adjustIdx] && (
          <PhotoAdjustModal
            imageSrc={photoPreviews[adjustIdx]}
            onConfirm={applyAdjust}
            onCancel={() => setAdjustIdx(null)}
          />
        )}

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

        {/* Categorías secundarias (aparecer também em) */}
        {categoryId && (
          <ExtraCategoriesPicker
            categories={categories}
            primaryCategoryId={categoryId}
            entries={extraEntries}
            onChange={setExtraEntries}
          />
        )}

        {/* Título */}
        <div className="form-group">
          <label className="form-label">Título *</label>
          <input className="form-input" type="text" placeholder={ph.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </div>

        {/* Descripción */}
        <div className="form-group">
          <label className="form-label">Descrição *</label>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 6px" }}>
            Dedique alguns minutos para descrever bem seu anúncio: uma boa descrição vende mais e mais rápido.
          </p>
          <textarea className="form-textarea" placeholder={ph.description} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required />
        </div>

        {/* Precio */}
        <div className="card" style={{ padding: "0.875rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 10 }}>Preço</p>
          <div className="form-group">
            <label className="form-label">Valor em R$</label>
            <input className="form-input" type="number" placeholder="0,00" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label">
              {price ? "Detalhe abaixo do preço (opcional)" : "Ou texto de preço"}
            </label>
            <input
              className="form-input"
              type="text"
              placeholder={price ? 'Ex: "+ frete", "por pessoa", "cada"' : ph.priceText}
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              maxLength={price ? 30 : 40}
            />
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
              {price
                ? "Texto curto que aparece abaixo do valor no anúncio."
                : "Use quando não há um valor fixo. Mantenha curto para ficar bem no card."}
            </p>
          </div>
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

        {/* ── Ubicación tipo FIJA: una localidad + una sub-zona ── */}
        {locationType !== "zonas_de_atencion" && (
          <>
            <div className="form-group">
              <label className="form-label">Localidade *</label>
              <select className="form-select" value={localityId} onChange={(e) => setLocalityId(e.target.value)} required>
                <option value="">Selecione a localidade...</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {localityId && localitySubzones.length > 0 && (
              <div className="form-group">
                <label className="form-label">Sub-zona *</label>
                <select className="form-select" value={subzoneId} onChange={(e) => setSubzoneId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {localitySubzones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </div>
            )}

            {subzoneId && localitySubzones.find((z) => z.id === Number(subzoneId))?.name === "Outros" && (
              <div className="form-group">
                <label className="form-label">Referência da localização</label>
                <input className="form-input" type="text" placeholder='Ex: "Perto da Pousada Sol"' value={otherLocation} onChange={(e) => setOtherLocation(e.target.value)} maxLength={120} />
              </div>
            )}
          </>
        )}

        {/* ── Ubicación tipo ZONAS DE ATENCIÓN: múltiples sub-zonas o toda a ilha ── */}
        {locationType === "zonas_de_atencion" && (
          <div className="form-group">
            <label className="form-label">Zonas de atendimento *</label>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: -4, marginBottom: 8 }}>
              Marque apenas as zonas onde você atende.
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", marginBottom: 10 }}>
              <input type="checkbox" checked={coversAllIsland} onChange={(e) => setCoversAllIsland(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Atendo em toda a ilha</span>
            </label>

            {!coversAllIsland && localities.map((loc) => {
              const zones = allSubzones.filter((z) => z.locality_id === loc.id);
              if (zones.length === 0) return null;
              const zoneIds = zones.map((z) => z.id);
              const allSelected = zoneIds.every((id) => serviceZoneIds.includes(id));
              return (
                <div key={loc.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem", marginBottom: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.88rem", color: "var(--blue-main)", marginBottom: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={allSelected} onChange={() => toggleLocalityZones(zoneIds, allSelected)} style={{ width: 16, height: 16 }} />
                    {loc.name} <span style={{ fontWeight: 500, color: "var(--text-muted)", fontSize: "0.78rem" }}>(todas)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 24 }}>
                    {zones.map((z) => (
                      <label key={z.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                        <input type="checkbox" checked={serviceZoneIds.includes(z.id)} onChange={() => toggleServiceZone(z.id)} style={{ width: 15, height: 15 }} />
                        {z.name}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
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
