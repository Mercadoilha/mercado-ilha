"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { getCachedProfile, setCachedProfile } from "../../lib/profileCache";
import { getAdminSettings, whatsappUrl } from "../../lib/adminSettings";
import { trackWhatsappClick } from "../../lib/tracking";
import AvatarUpload from "../../components/AvatarUpload";
import InstallSigninStrip from "../../components/InstallSigninStrip";
import { useSession } from "../../contexts/SessionContext";
import { compartilhar } from "../../lib/share";
import ShareIcon from "../../components/ShareIcon";

// Botón fondo blanco / letra azul (ver minha loja / compartilhar) — dos lado a lado
// dentro do banner azul do perfil.
const outlineBlueBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "0.6rem 0.5rem",
  background: "#fff",
  border: "none",
  borderRadius: 10,
  color: "var(--blue-main)",
  fontWeight: 700,
  fontSize: "0.82rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function ProfilePage() {
  const router = useRouter();
  const { session, sessionLoading } = useSession();

  const [profile, setProfile] = useState<any>(null);
  const [adminWa, setAdminWa] = useState("");
  const [myListings, setMyListings] = useState<any[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, { views: number; wa_clicks: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [bumping, setBumping] = useState<number | null>(null);
  const [bumpMsg, setBumpMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [soldModal, setSoldModal] = useState<{ id: number; title: string } | null>(null);
  const [soldStep, setSoldStep] = useState<"confirm" | "processing" | "done">("confirm");

  // Edit profile
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { setLoading(false); return; }
    const activeSession = session;
    let mounted = true;

    const uid = activeSession.user.id;

    // Render instantáneo desde cache si ya está precargado
    const cached = getCachedProfile(uid);
    if (cached?.profile) {
      setProfile(cached.profile);
      setEditName((cached.profile.full_name as string) ?? "");
      setEditWhatsapp((cached.profile.whatsapp as string) ?? "");
      setMyListings(cached.listings);
      if (cached.statsMap) setStatsMap(cached.statsMap);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);

    async function load() {
      // Profile y listings no dependen entre sí (ambos usan uid) → en paralelo
      const [profileRes, listRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("listings").select("id,title,price,price_text,status,created_at,expires_at,bumped_at,categories(is_product),subcategories(is_product),listing_photos(photo_url,sort_order)")
          .order("sort_order", { referencedTable: "listing_photos" })
          .limit(1, { referencedTable: "listing_photos" })
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_my_listings_stats"),
      ]);

      // Load or create profile
      let p = profileRes.data;
      const pe = profileRes.error;
      if (!p && pe?.code === "PGRST116") {
        const meta = activeSession.user.user_metadata ?? {};
        const { data: np } = await supabase
          .from("profiles")
          .insert({ id: uid, full_name: meta.full_name ?? meta.name ?? "Usuário", whatsapp: meta.whatsapp ?? "", role: "user" })
          .select("*")
          .single();
        p = np;
      }
      if (!mounted) return;
      if (p) {
        setProfile(p);
        setEditName(p.full_name);
        setEditWhatsapp(p.whatsapp ?? "");
      }

      if (!mounted) return;
      if (listRes.error) setError(listRes.error.message);
      else {
        const listings = listRes.data ?? [];
        setMyListings(listings);
        setCachedProfile(uid, { profile: p, listings });
      }

      if (mounted && statsRes.data) {
        const map: Record<number, { views: number; wa_clicks: number }> = {};
        for (const s of statsRes.data as any[]) {
          map[s.listing_id] = { views: Number(s.views) || 0, wa_clicks: Number(s.wa_clicks) || 0 };
        }
        setStatsMap(map);
        setCachedProfile(uid, { statsMap: map });
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [session, sessionLoading]);

  useEffect(() => {
    getAdminSettings().then((s) => setAdminWa(s.whatsapp));
  }, []);

  const saveProfile = async () => {
    if (!session) return;
    setSaving(true);
    setSaveMsg("");
    const { error: e } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim(), whatsapp: editWhatsapp.trim() })
      .eq("id", session.user.id);
    if (e) setSaveMsg("Erro: " + e.message);
    else {
      setProfile((p: any) => {
        const updated = { ...p, full_name: editName.trim(), whatsapp: editWhatsapp.trim() };
        setCachedProfile(session.user.id, { profile: updated });
        return updated;
      });
      setSaveMsg("Salvo com sucesso!");
      setEditMode(false);
    }
    setSaving(false);
  };

  // Elimina o anúncio e tudo relacionado (fotos no R2 + linha na tabela).
  // Usado tanto pelo botão 🗑 (com confirm nativo) quanto pelo fluxo "Vendido" (modal próprio).
  const performDelete = async (id: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? "";

    // Fetch photos first, then delete from R2 (non-blocking per photo)
    const { data: photos } = await supabase
      .from("listing_photos")
      .select("photo_url")
      .eq("listing_id", id);

    if (photos?.length) {
      await Promise.allSettled(
        photos.map((p) =>
          fetch("/api/delete-file", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ url: p.photo_url, listingId: id }),
          }),
        ),
      );
    }

    await supabase.from("listings").delete().eq("id", id);
    setMyListings((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (session) setCachedProfile(session.user.id, { listings: next });
      return next;
    });
  };

  const deleteListing = async (id: number) => {
    if (!confirm("Deletar este anúncio permanentemente?")) return;
    await performDelete(id);
  };

  const confirmSold = async () => {
    if (!soldModal) return;
    setSoldStep("processing");
    await performDelete(soldModal.id);
    setSoldStep("done");
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    setToggling(id);
    const goActive = currentStatus !== "active";
    const update: Record<string, unknown> = {
      status: goActive ? "active" : "paused",
      ...(goActive && {
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        deletion_warning_sent_at: null,
      }),
    };
    const { error: e } = await supabase.from("listings").update(update).eq("id", id);
    if (!e) {
      setMyListings((prev) => {
        const next = prev.map((l) => l.id === id ? { ...l, ...update } : l);
        if (session) setCachedProfile(session.user.id, { listings: next });
        return next;
      });
    }
    setToggling(null);
  };

  // Destacar: empuja el anuncio de vuelta al tope de la home (bumped_at = now)
  // y renueva la validez 30 días. Cooldown de 15min (validado también en la RPC).
  const bumpListing = async (id: number) => {
    setBumping(id);
    setBumpMsg(null);
    const { data, error: e } = await supabase.rpc("bump_listing", { _listing_id: id });
    if (!e) {
      const now = (data as string) ?? new Date().toISOString();
      const update = {
        bumped_at: now,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        deletion_warning_sent_at: null,
      };
      setMyListings((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...update } : l));
        if (session) setCachedProfile(session.user.id, { listings: next });
        return next;
      });
      setBumpMsg({ id, text: "⭐ Anúncio destacado! Aparecerá no topo da tela principal.", ok: true });
    } else {
      const isCooldown = (e.message ?? "").toLowerCase().includes("cooldown");
      setBumpMsg({
        id,
        text: isCooldown
          ? "Você já destacou este anúncio. Tente novamente em até 15 minutos."
          : "Não foi possível destacar o anúncio. Tente novamente.",
        ok: false,
      });
    }
    setBumping(null);
  };

  // Minutos restantes de cooldown (0 = pode destacar). 15min desde bumped_at.
  const cooldownLeftMin = (bumpedAt?: string | null): number => {
    if (!bumpedAt) return 0;
    const diffMs = 15 * 60 * 1000 - (Date.now() - new Date(bumpedAt).getTime());
    return diffMs > 0 ? Math.ceil(diffMs / 60000) : 0;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const listingPrice = (l: any) =>
    l.price != null ? `R$ ${Number(l.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : l.price_text ?? "";

  const statusLabel: Record<string, string> = {
    active: "✅ Ativo",
    paused: "⏸️ Pausado",
    sold: "🏷️ Vendido",
    expired: "⏰ Expirado",
    hidden: "🙈 Oculto",
    blocked: "🚫 Bloqueado",
  };

  // ── Not logged in ──
  if (!loading && !session) return (
    <>
      <InstallSigninStrip />
      <div className="page-body">
        <header className="page-header">
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <h1>Perfil</h1>
        </header>
        <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>👤</div>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1e293b", marginBottom: 8 }}>Bem-vindo ao Mercado Ilha</p>
          <p className="text-muted" style={{ marginBottom: 24 }}>Entre para publicar e gerenciar seus anúncios.</p>
          <Link href="/signin" className="btn btn-primary btn-block">Entrar / Cadastrar</Link>
        </div>
      </div>
    </>
  );

  if (loading) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  return (
    <>
      <InstallSigninStrip />
      <div className="page-body">
        <header className="page-header">
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <h1>Meu perfil</h1>
        </header>

        {/* ── Banner do perfil (edge-to-edge, igual ao banner de /store/[id]) ── */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
            padding: "1.5rem 1rem 1rem",
            color: "#fff",
          }}
        >
          {profile != null && session != null && (
            <AvatarUpload
              userId={session.user.id}
              currentAvatarUrl={profile.avatar_url ?? null}
              fullName={profile.full_name ?? ""}
              onUpdate={(url) => {
                setProfile((p: any) => {
                  const updated = { ...p, avatar_url: url };
                  if (session) setCachedProfile(session.user.id, { profile: updated });
                  return updated;
                });
              }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, marginTop: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile?.full_name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session?.user?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="btn btn-outline"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem", color: "#fff", borderColor: "rgba(255,255,255,0.7)" }}
            >
              {editMode ? "Cancelar" : "Editar"}
            </button>
          </div>

          {!editMode && (
            <div style={{ fontSize: "0.875rem", color: "#fff" }}>
              {profile?.whatsapp ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📱</span>
                  <span>{profile.whatsapp}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ color: "var(--sand-light)", fontSize: "0.8rem", textDecoration: "underline" }}>
                    ⚠️ Adicione seu WhatsApp para que os compradores possam te contatar. Toque aqui para adicionar.
                  </div>
                </button>
              )}
            </div>
          )}

          {editMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="form-group">
                <label className="form-label" style={{ color: "#fff" }}>Nome</label>
                <input className="form-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "#fff" }}>WhatsApp</label>
                <input className="form-input" type="tel" placeholder="71 99999-9999" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} maxLength={20} />
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", marginTop: 4, display: "block" }}>
                  Brasil: só DDD + número (ex: 75 99999-9999). Outro país: com + e código (ex: +54 11 9999-9999)
                </span>
              </div>
              {saveMsg && <p style={{ fontSize: "0.8rem", color: saveMsg.startsWith("Erro") ? "#fecaca" : "var(--green-sea)" }}>{saveMsg}</p>}
              {error && <p className="text-error" style={{ color: "#fecaca" }}>{error}</p>}
              <button type="button" className="btn" onClick={saveProfile} disabled={saving} style={{ background: "#fff", color: "var(--blue-main)" }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}

          {!editMode && session && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 12 }}>
              <Link href={`/store/${session.user.id}`} style={{ ...outlineBlueBtn, fontSize: "0.8rem", padding: "0.6rem 0.4rem", textDecoration: "none" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>Ver minha loja</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  compartilhar({
                    title: "Minha loja no Mercado Ilha",
                    text: "Confira minha loja no Mercado Ilha!",
                    url: window.location.origin + "/store/" + session.user.id,
                  })
                }
                style={{ ...outlineBlueBtn, fontSize: "0.8rem", padding: "0.6rem 0.4rem" }}
              >
                <ShareIcon /> <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>Compartilhar</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* ── Meus anúncios ── */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
              Meus anúncios ({myListings.length})
            </h2>
            <Link href="/publish" className="btn btn-sand" style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
              + Publicar
            </Link>
          </div>

          {myListings.length === 0 ? (
            <div className="card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛍️</div>
              <p style={{ fontSize: "0.875rem" }}>Você ainda não tem anúncios.</p>
              <Link href="/publish" className="btn btn-primary" style={{ marginTop: 12, display: "inline-flex" }}>
                Publicar primeiro anúncio
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {myListings.map((l) => {
                const cdMin = l.status === "active" ? cooldownLeftMin(l.bumped_at) : 0;
                const canBump = l.status === "active" && cdMin === 0 && bumping !== l.id;
                const sortedPhotos = [...(l.listing_photos ?? [])].sort(
                  (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                );
                const firstPhoto: string | null = sortedPhotos[0]?.photo_url ?? null;
                return (
                <div key={l.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "0.75rem",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: "0.625rem" }}>
                    <Link href={`/listings/${l.id}`} style={{ flexShrink: 0, textDecoration: "none" }}>
                      <div
                        style={{
                          width: 62,
                          height: 62,
                          borderRadius: 8,
                          background: firstPhoto ? "#fff" : "var(--blue-xlight)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.7rem",
                          overflow: "hidden",
                          flexShrink: 0,
                          position: "relative",
                        }}
                      >
                        {firstPhoto ? (
                          <Image
                            src={firstPhoto}
                            alt={l.title}
                            fill
                            sizes="62px"
                            style={{ objectFit: "contain" }}
                          />
                        ) : "🛍️"}
                      </div>
                    </Link>
                    <Link
                      href={`/listings/${l.id}`}
                      style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--blue-main)", fontWeight: 700, marginTop: 2 }}>
                        {listingPrice(l)}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                        <span title="Visualizações">👁️ {statsMap[l.id]?.views ?? 0}</span>
                        <span title="Contatos via WhatsApp">💬 {statsMap[l.id]?.wa_clicks ?? 0}</span>
                      </div>
                    </Link>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: l.status === "active" ? "#059669" : "#94a3b8", flexShrink: 0, marginRight: "auto" }}>
                    {statusLabel[l.status] ?? l.status}
                  </span>
                  {l.categories?.is_product && l.subcategories?.is_product !== false && l.status !== "blocked" && l.status !== "sold" && (
                    <button
                      type="button"
                      onClick={() => { setSoldModal({ id: l.id, title: l.title }); setSoldStep("confirm"); }}
                      title="Marcar como vendido e remover o anúncio"
                      style={{
                        background: "#0F6E56",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: "#fff",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.5rem",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Vendido
                    </button>
                  )}
                  {l.status === "active" && (
                    <button
                      type="button"
                      disabled={!canBump}
                      onClick={() => bumpListing(l.id)}
                      title={
                        bumping === l.id
                          ? "Destacando…"
                          : cdMin > 0
                          ? `Você poderá destacar de novo em ${cdMin} min`
                          : "Destacar: aparecer no topo da tela principal (1 vez a cada 15 min)"
                      }
                      style={{
                        background: canBump ? "#EF9F27" : "#fdecc8",
                        border: "none",
                        borderRadius: 6,
                        cursor: canBump ? "pointer" : "not-allowed",
                        color: canBump ? "#fff" : "#b98219",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.5rem",
                        flexShrink: 0,
                        opacity: bumping === l.id ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cdMin > 0 ? `⭐ ${cdMin}min` : "⭐ Destacar"}
                    </button>
                  )}
                  {l.status !== "blocked" && l.status !== "sold" && (
                    <button
                      type="button"
                      disabled={toggling === l.id}
                      onClick={() => toggleStatus(l.id, l.status)}
                      title={l.status === "active" ? "Pausar anúncio" : "Reativar anúncio"}
                      style={{
                        background: l.status === "active" ? "#f1f5f9" : "#dcfce7",
                        border: "none",
                        borderRadius: 6,
                        cursor: toggling === l.id ? "not-allowed" : "pointer",
                        color: l.status === "active" ? "#64748b" : "#059669",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.5rem",
                        flexShrink: 0,
                        opacity: toggling === l.id ? 0.5 : 1,
                      }}
                    >
                      {l.status === "active" ? "Pausar" : "Ativar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteListing(l.id)}
                    title="Deletar anúncio"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#dc2626",
                      fontSize: "1rem",
                      padding: "0 2px",
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                  </div>
                </div>
                {bumpMsg && bumpMsg.id === l.id && (
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: bumpMsg.ok ? "#0f6e56" : "#b45309", padding: "0 0.25rem" }}>
                    {bumpMsg.text}
                  </div>
                )}
                </div>
                );
              })}
            </div>
          )}

          {/* Leyenda del botón Destacar */}
          {myListings.length > 0 && (
            <div style={{ background: "#fff4e0", border: "1px solid #EF9F27", borderRadius: 10, padding: "0.7rem 0.875rem", fontSize: "0.78rem", color: "#92400e", marginTop: "0.5rem", lineHeight: 1.5 }}>
              ⭐ <strong>Destacar:</strong> coloque seu anúncio de volta no topo da tela principal para ser visto por mais pessoas, como se você tivesse acabado de publicá-lo. Você pode destacar cada anúncio <strong>1 vez a cada 15 minutos</strong>.
            </div>
          )}

          {/* Leyenda de validez */}
          <div style={{ background: "#fff8e1", border: "1px solid #fcd34d", borderRadius: 10, padding: "0.7rem 0.875rem", fontSize: "0.78rem", color: "#92400e", marginTop: "0.5rem", marginBottom: "0.5rem", lineHeight: 1.5 }}>
            Os anúncios ficam ativos por <strong>30 dias</strong> e depois são desativados automaticamente. Você pode reativá-los para continuar oferecendo — anúncios inativos por mais de <strong>15 dias</strong> são excluídos permanentemente.
          </div>

          {/* Leyenda de métricas */}
          <div style={{ background: "#e6f1fb", border: "1px solid #b5d4f4", borderRadius: 10, padding: "0.65rem 0.875rem", fontSize: "0.76rem", color: "#185fa5", lineHeight: 1.5 }}>
            <strong>O que significam os números?</strong><br />
            👁️ <strong>Visualizações</strong> — quantas pessoas abriram seu anúncio.<br />
            💬 <strong>Contatos</strong> — quantas pessoas clicaram no WhatsApp para te contatar.
          </div>
        </section>

        {/* ── Panel admin (solo admins) ── */}
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            className="btn btn-outline btn-block"
            style={{ borderColor: "var(--blue-main)", color: "var(--blue-main)", display: "flex", justifyContent: "center" }}
          >
            ⚙️ Painel de administração
          </Link>
        )}

        {/* ── Cerrar sesión ── */}
        <button
          type="button"
          onClick={signOut}
          className="btn btn-outline btn-block"
          style={{ color: "#dc2626", borderColor: "#dc2626", marginTop: 4 }}
        >
          Sair da conta
        </button>

        {/* ── Fale conosco (sugestões ou reclamações), no final de tudo ──
            Mesmo formato do card usado em /informacao. */}
        {adminWa && (
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem", textAlign: "center", marginTop: 4 }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Sugestões ou problemas? Fala com a gente!
            </p>
            <a
              href={whatsappUrl(adminWa, "Tenho uma sugestão para o Mercado Ilha")}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackWhatsappClick(null, "suggestion")}
              className="btn btn-whatsapp"
              style={{ width: "100%", display: "flex", justifyContent: "center", cursor: "pointer", textDecoration: "none" }}
            >
              💬 Fale conosco pelo WhatsApp
            </a>
          </div>
        )}

      </div>

      {/* Modal "Vendido" — confirmação com experiência de conquista + exclusão permanente */}
      {soldModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem",
          }}
        >
          <div className="card" style={{ maxWidth: 360, width: "100%", padding: "1.5rem", textAlign: "center" }}>
            {soldStep === "confirm" && (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🎉</div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>
                  Parabéns pela venda!
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
                  Ao confirmar que <strong>{soldModal.title}</strong> foi vendido, o anúncio será excluído
                  permanentemente do site — fotos, estatísticas e tudo relacionado a ele. Essa ação não pode ser desfeita.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button type="button" className="btn btn-block" style={{ background: "#0F6E56", color: "#fff" }} onClick={confirmSold}>
                    ✅ Sim, foi vendido!
                  </button>
                  <button type="button" className="btn btn-outline btn-block" onClick={() => setSoldModal(null)}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
            {soldStep === "processing" && (
              <div style={{ padding: "1.75rem 0" }}>
                <div className="spinner" />
              </div>
            )}
            {soldStep === "done" && (
              <>
                <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏆</div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0F6E56", marginBottom: 8 }}>
                  Muito bem!
                </h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
                  Seu anúncio foi removido com sucesso. Continue vendendo no Mercado Ilha!
                </p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setSoldModal(null)}>
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
