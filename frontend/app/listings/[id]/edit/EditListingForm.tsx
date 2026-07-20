"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "../../../../lib/supabaseClient";
import { compressImage, normalizeFile } from "../../../../lib/imageUtils";
import { getCategoryPlaceholders } from "../../../../lib/categoryPlaceholders";
import ExtraCategoriesPicker, { ExtraCategoryEntry } from "../../../../components/ExtraCategoriesPicker";
import type { PhotoAdjustResult } from "../../../../components/PhotoAdjustModal";
import RichTextEditor from "../../../../components/RichTextEditor";
import { richHasContent, initialEditorHtml } from "../../../../lib/richText";
import { safeBack } from "../../../../lib/safeBack";
import { clearListingPreview } from "../../../../lib/listingPreview";
import { clearListingDetailPrefetch } from "../../../../lib/listingDetailPrefetch";

// El modal de ajuste solo se descarga cuando el usuario toca una foto nueva.
const PhotoAdjustModal = dynamic(() => import("../../../../components/PhotoAdjustModal"), { ssr: false });

type Category = { id: number; name: string; slug: string; location_type: string; contact_button_text: string; whatsapp_message: string | null; expires_in_days: number | null };
type Subcategory = { id: number; name: string };
type Locality = { id: number; name: string };
type Subzone = { id: number; name: string; locality_id: number };
type ExistingPhoto = { id: number; photo_url: string; storage_path: string | null; sort_order: number };
type NewPhoto = { key: number; file: File; preview: string };
// Orden visual único de fotos existentes + nuevas; la posición define sort_order (capa = 0)
type PhotoRef = { kind: "existing"; id: number } | { kind: "new"; key: number };

type EditListingFormProps = {
  listingId: string;
  categories: Category[];
  localities: Locality[];
  allSubzones: Subzone[];
};

export default function EditListingForm({ listingId: listingIdParam, categories, localities, allSubzones }: EditListingFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const listingId = Number(listingIdParam);

  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  // Form fields
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [extraEntries, setExtraEntries] = useState<ExtraCategoryEntry[]>([]);
  const [localityId, setLocalityId] = useState("");
  const [subzoneId, setSubzoneId] = useState("");
  const [serviceZoneIds, setServiceZoneIds] = useState<number[]>([]);
  const [otherLocation, setOtherLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionRich, setDescriptionRich] = useState("");
  const [price, setPrice] = useState("");
  const [priceText, setPriceText] = useState("");
  const [condition, setCondition] = useState("");
  const [coversAllIsland, setCoversAllIsland] = useState(false);

  // Photo management
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [photoOrder, setPhotoOrder] = useState<PhotoRef[]>([]);
  const [adjustKey, setAdjustKey] = useState<number | null>(null);
  const newKeyRef = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  // Load listing data once session is ready
  useEffect(() => {
    if (authLoading || !session) return;
    if (!listingId || Number.isNaN(listingId)) { setNotFound(true); setDataLoading(false); return; }

    async function load() {
      const { data, error: le } = await supabase
        .from("listings")
        .select("*, listing_photos(*)")
        .eq("id", listingId)
        .single();

      if (le || !data) { setNotFound(true); setDataLoading(false); return; }
      if (data.user_id !== session.user.id) { setNotFound(true); setDataLoading(false); return; }

      setCategoryId(String(data.category_id ?? ""));
      setSubcategoryId(String(data.subcategory_id ?? ""));
      setLocalityId(String(data.locality_id ?? ""));
      setSubzoneId(String(data.subzone_id ?? ""));
      setOtherLocation(data.other_location_text ?? "");
      setTitle(data.title ?? "");
      setDescription(data.description ?? "");
      setDescriptionRich(richHasContent(data.description_rich) ? data.description_rich : "");
      setPrice(data.price != null ? String(data.price) : "");
      setPriceText(data.price_text ?? "");
      setCondition(data.condition ?? "");
      setCoversAllIsland(data.covers_all_island ?? false);

      // Precargar zonas de atención (categorías que se trasladan al cliente)
      const { data: zones } = await supabase.from("listing_service_zones").select("subzone_id").eq("listing_id", listingId);
      setServiceZoneIds((zones ?? []).map((z: any) => z.subzone_id));

      // Precargar categorías secundarias
      const { data: extras } = await supabase.from("listing_extra_categories").select("category_id,subcategory_id").eq("listing_id", listingId);
      setExtraEntries((extras ?? []).map((x: any) => ({
        categoryId: String(x.category_id),
        subcategoryId: x.subcategory_id != null ? String(x.subcategory_id) : "",
      })));

      const photos = [...(data.listing_photos ?? [])].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setExistingPhotos(photos);
      setPhotoOrder(photos.map((p: any) => ({ kind: "existing" as const, id: p.id })));
      setDataLoading(false);
    }

    load();
  }, [authLoading, session, listingId]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!categoryId) { setSubcategories([]); return; }
    supabase.from("subcategories").select("id,name").eq("category_id", Number(categoryId)).eq("is_active", true).order("sort_order")
      .then(({ data }) => setSubcategories(data ?? []));
  }, [categoryId]);

  // Si la categoría principal coincide con una secundaria, quitarla (no duplicar).
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
  const totalPhotos = photoOrder.length;

  const removeExistingPhoto = (id: number) => {
    setRemovedPhotoIds((prev) => [...prev, id]);
    setPhotoOrder((prev) => prev.filter((r) => !(r.kind === "existing" && r.id === id)));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const canAdd = 4 - totalPhotos;
    if (canAdd <= 0) return;
    const raw = Array.from(e.target.files ?? []).slice(0, canAdd);
    if (!raw.length) return;
    e.target.value = "";
    const files = await Promise.all(raw.map(normalizeFile));
    const entries: NewPhoto[] = await Promise.all(
      files.map(async (file) => {
        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
        return { key: newKeyRef.current++, file, preview };
      })
    );
    setNewPhotos((prev) => [...prev, ...entries]);
    setPhotoOrder((prev) => [...prev, ...entries.map((en) => ({ kind: "new" as const, key: en.key }))]);
  };

  const removeNewPhoto = (key: number) => {
    setNewPhotos((p) => p.filter((n) => n.key !== key));
    setPhotoOrder((prev) => prev.filter((r) => !(r.kind === "new" && r.key === key)));
  };

  const movePhoto = (i: number, dir: -1 | 1) => {
    setPhotoOrder((prev) => {
      const a = [...prev];
      [a[i], a[i + dir]] = [a[i + dir], a[i]];
      return a;
    });
  };

  const applyAdjust = (res: PhotoAdjustResult | null) => {
    if (res && adjustKey !== null) {
      setNewPhotos((prev) =>
        prev.map((n) =>
          n.key === adjustKey
            ? {
                ...n,
                file: new File([res.blob], n.file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() }),
                preview: res.dataUrl,
              }
            : n
        )
      );
    }
    setAdjustKey(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);

    if (!categoryId || !title.trim() || !description.trim()) {
      setError("Preencha todos os campos obrigatórios.");
      setSubmitting(false);
      return;
    }

    // Categorías secundarias: subcategoría obligatoria si la categoría tiene subcategorías.
    const validExtras = extraEntries.filter((e) => e.categoryId);
    if (validExtras.some((e) => e.hasSubcats && !e.subcategoryId)) {
      setError("Escolha a subcategoria das categorias adicionais.");
      setSubmitting(false);
      return;
    }

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

    // Update listing
    const { error: updErr } = await supabase
      .from("listings")
      .update({
        category_id: Number(categoryId),
        subcategory_id: subcategoryId ? Number(subcategoryId) : null,
        locality_id: localityIdToSave,
        subzone_id: subzoneIdToSave,
        other_location_text: otherText,
        title: title.trim(),
        description: description.trim(),
        description_rich: descriptionRich || null,
        price: price ? Number(price.replace(",", ".")) : null,
        price_text: !price && priceText ? priceText : null,
        condition: condition || null,
        contact_button_text: selectedCategory?.contact_button_text ?? "Contatar",
        location_type: locationType || "fija",
        covers_all_island: isZonas ? coversAllIsland : false,
      })
      .eq("id", listingId)
      .eq("user_id", session.user.id);

    if (updErr) {
      setError(updErr.message ?? "Erro ao salvar. Tente novamente.");
      setSubmitting(false);
      return;
    }

    // Sincronizar zonas de atención: borrar e reinsertar
    await supabase.from("listing_service_zones").delete().eq("listing_id", listingId);
    if (isZonas && !coversAllIsland && serviceZoneIds.length > 0) {
      await supabase.from("listing_service_zones").insert(
        serviceZoneIds.map((zid) => ({ listing_id: listingId, subzone_id: zid }))
      );
    }

    // Sincronizar categorías secundarias: borrar e reinsertar
    await supabase.from("listing_extra_categories").delete().eq("listing_id", listingId);
    if (validExtras.length > 0) {
      await supabase.from("listing_extra_categories").insert(
        validExtras.map((e) => ({
          listing_id: listingId,
          category_id: Number(e.categoryId),
          subcategory_id: e.subcategoryId ? Number(e.subcategoryId) : null,
        }))
      );
    }

    // Delete removed photos
    if (removedPhotoIds.length > 0) {
      const token = session.access_token;
      const toRemove = existingPhotos.filter((p) => removedPhotoIds.includes(p.id));
      await Promise.allSettled(
        toRemove.map((p) =>
          fetch("/api/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ url: p.photo_url, listingId }),
          })
        )
      );
      await supabase.from("listing_photos").delete().in("id", removedPhotoIds);
    }

    // La posición en photoOrder define el sort_order final (capa = 0), tanto
    // para las fotos existentes reordenadas como para las nuevas.
    const toUpload: { pos: number; entry: NewPhoto }[] = [];
    const orderTasks: PromiseLike<unknown>[] = [];
    photoOrder.forEach((ref, pos) => {
      if (ref.kind === "new") {
        const entry = newPhotos.find((n) => n.key === ref.key);
        if (entry) toUpload.push({ pos, entry });
      } else {
        const p = existingPhotos.find((e2) => e2.id === ref.id);
        if (p && p.sort_order !== pos) {
          orderTasks.push(supabase.from("listing_photos").update({ sort_order: pos }).eq("id", ref.id));
        }
      }
    });
    if (orderTasks.length > 0) await Promise.all(orderTasks);

    // Upload new photos en paralelo: el tiempo total es el de la foto más
    // lenta, no la suma.
    if (toUpload.length > 0) {
      const token = session.access_token;
      const uploaded = await Promise.all(
        toUpload.map(async ({ pos, entry }) => {
          try {
            const compressed = await compressImage(entry.file);
            const form = new FormData();
            form.append("file", compressed);
            form.append("folder", "listings");
            const res = await fetch("/api/upload", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: form,
            });
            const data = await res.json();
            if (res.ok && data.url) {
              return { listing_id: listingId, photo_url: data.url, storage_path: data.key ?? null, sort_order: pos };
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

    // Invalida o preview otimista desatualizado (título/preço antigos) para que, ao voltar
    // ao detalhe, não faça flash com o dado anterior à edição — o fetch completo do detalhe
    // já vai trazer o dado fresco de qualquer forma (o componente remonta ao voltar).
    clearListingPreview(listingId);
    clearListingDetailPrefetch(listingId);
    setSuccess(true);
    // back() (não push) para não empilhar uma tela nova: volta direto à mesma entrada de
    // detalhe que já existia no histórico antes de entrar em editar, sem duplicar.
    safeBack(router, `/listings/${listingId}`);
  };

  if (authLoading || dataLoading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-body">
        <header className="page-header">
          <button
            type="button"
            onClick={() => safeBack(router, "/")}
            style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
          >←</button>
          <h1>Editar anúncio</h1>
        </header>
        <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
          <p style={{ fontWeight: 700 }}>Faça login para editar.</p>
          <Link href="/signin" className="btn btn-primary btn-block" style={{ marginTop: 16, display: "inline-flex" }}>Entrar</Link>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-body">
        <header className="page-header">
          <button
            type="button"
            onClick={() => safeBack(router, "/listings")}
            style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
          >←</button>
          <h1>Editar anúncio</h1>
        </header>
        <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>😕</div>
          <p style={{ fontWeight: 700, color: "#1e293b" }}>Anúncio não encontrado ou sem permissão.</p>
          <Link href="/listings" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>Ver anúncios</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "2rem" }}>
        <div style={{ fontSize: "4rem", marginBottom: 16 }}>✅</div>
        <h2 style={{ fontWeight: 800, color: "var(--blue-main)", marginBottom: 8 }}>Anúncio atualizado!</h2>
        <p className="text-muted">Redirecionando...</p>
      </div>
    );
  }

  return (
    <div className="page-body">
      <header className="page-header">
        <button
          type="button"
          onClick={() => safeBack(router, `/listings/${listingId}`)}
          style={{ color: "#fff", background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", padding: 0 }}
        >←</button>
        <h1>Editar anúncio</h1>
      </header>

      <form onSubmit={handleSubmit} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Fotos existentes + novas (lista única ordenável) */}
        <div className="card" style={{ padding: "0.875rem" }}>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", marginBottom: 2 }}>
            Fotos <span className="text-muted">(até 4)</span>
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", margin: "0 0 10px" }}>
            Fotos já salvas não podem ser editadas — para trocar o enquadramento, remova e envie de novo. Nas fotos novas, toque para girar ou ajustar.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            {photoOrder.map((ref, i) => {
              const isNew = ref.kind === "new";
              const newKey = ref.kind === "new" ? ref.key : null;
              const existingId = ref.kind === "existing" ? ref.id : null;
              const src = ref.kind === "new"
                ? newPhotos.find((n) => n.key === ref.key)?.preview
                : existingPhotos.find((p) => p.id === ref.id)?.photo_url;
              if (!src) return null;
              return (
                <div key={isNew ? `n-${newKey}` : `e-${existingId}`} style={{ width: 72 }}>
                  <div style={{ position: "relative", width: 72, height: 72 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      onClick={newKey !== null ? () => setAdjustKey(newKey) : undefined}
                      style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", border: isNew ? "2px solid #059669" : "1px solid var(--border)", cursor: isNew ? "pointer" : "default" }}
                    />
                    {i === 0 && (
                      <span style={{ position: "absolute", left: 0, bottom: 0, background: "var(--blue-main)", color: "#fff", fontSize: "0.55rem", fontWeight: 700, padding: "1px 6px", borderRadius: "0 6px 0 8px", pointerEvents: "none", letterSpacing: "0.03em" }}>
                        CAPA
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => (newKey !== null ? removeNewPhoto(newKey) : removeExistingPhoto(existingId!))}
                      style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ✕
                    </button>
                  </div>
                  {photoOrder.length > 1 && (
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
                        disabled={i === photoOrder.length - 1}
                        aria-label="Mover para a direita"
                        style={{ width: 30, height: 20, borderRadius: 6, border: "1px solid var(--border)", background: "#fff", color: "var(--blue-main)", fontWeight: 700, fontSize: "0.8rem", lineHeight: 1, padding: 0, cursor: i === photoOrder.length - 1 ? "default" : "pointer", opacity: i === photoOrder.length - 1 ? 0.35 : 1 }}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Add photo button */}
            {totalPhotos < 4 && (
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

        {adjustKey !== null && (() => {
          const entry = newPhotos.find((n) => n.key === adjustKey);
          return entry ? (
            <PhotoAdjustModal
              imageSrc={entry.preview}
              onConfirm={applyAdjust}
              onCancel={() => setAdjustKey(null)}
            />
          ) : null;
        })()}

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
          <RichTextEditor
            initialHtml={initialEditorHtml(descriptionRich, description)}
            placeholder={ph.description}
            ariaLabel="Descrição do anúncio"
            maxLength={1000}
            onChange={(rich, plain) => {
              setDescription(plain);
              setDescriptionRich(richHasContent(rich) ? rich : "");
            }}
          />
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
              <input className="form-input" type="text" placeholder={ph.priceText} value={priceText} onChange={(e) => setPriceText(e.target.value)} maxLength={60} />
            </div>
          )}
        </div>

        {/* Condición */}
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
              <select className="form-select" value={localityId} onChange={(e) => { setLocalityId(e.target.value); setSubzoneId(""); }} required>
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

        {error && <p className="text-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: "0.875rem", fontSize: "1rem", marginTop: 4 }}>
          {submitting ? "Salvando..." : "💾 Salvar alterações"}
        </button>

        <button
          type="button"
          onClick={() => safeBack(router, `/listings/${listingId}`)}
          style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)", paddingBottom: "0.5rem", background: "none", border: "none", cursor: "pointer" }}
        >
          Cancelar e voltar ao anúncio
        </button>
      </form>
    </div>
  );
}
