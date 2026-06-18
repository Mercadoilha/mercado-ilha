"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { getCachedProfile, setCachedProfile } from "../../lib/profileCache";
import AvatarUpload from "../../components/AvatarUpload";
import { useSession } from "../../contexts/SessionContext";
import { compartilhar } from "../../lib/share";
import ShareIcon from "../../components/ShareIcon";

export default function ProfilePage() {
  const router = useRouter();
  const { session, sessionLoading } = useSession();

  const [profile, setProfile] = useState<any>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [statsMap, setStatsMap] = useState<Record<number, { views: number; wa_clicks: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

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
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError(null);

    async function load() {
      // Profile y listings no dependen entre sí (ambos usan uid) → en paralelo
      const [profileRes, listRes, statsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("listings").select("id,title,price,price_text,status,created_at,expires_at").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.rpc("get_my_listings_stats"),
      ]);

      // Load or create profile
      let p = profileRes.data;
      const pe = profileRes.error;
      if (!p && pe?.code === "PGRST116") {
        const { data: np } = await supabase
          .from("profiles")
          .insert({ id: uid, full_name: activeSession.user.email ?? "Usuário", whatsapp: "", role: "user" })
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
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [session, sessionLoading]);

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

  const deleteListing = async (id: number) => {
    if (!confirm("Deletar este anúncio permanentemente?")) return;
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

  const toggleStatus = async (id: number, currentStatus: string) => {
    setToggling(id);
    const goActive = currentStatus !== "active";
    const update: Record<string, unknown> = {
      status: goActive ? "active" : "paused",
      ...(goActive && { expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }),
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
  );

  if (loading) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Meu perfil</h1>
      </header>

      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* ── Card de perfil ── */}
        <div
          className="card"
          style={{ padding: "1rem" }}
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
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile?.full_name}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session?.user?.email}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="btn btn-outline"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
            >
              {editMode ? "Cancelar" : "Editar"}
            </button>
          </div>

          {!editMode && (
            <div style={{ fontSize: "0.875rem", color: "#1e293b" }}>
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
                  <div style={{ color: "#ef4444", fontSize: "0.8rem", textDecoration: "underline" }}>
                    ⚠️ Adicione seu WhatsApp para que os compradores possam te contatar. Toque aqui para adicionar.
                  </div>
                </button>
              )}
            </div>
          )}

          {editMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
              </div>
              <div className="form-group">
                <label className="form-label">WhatsApp</label>
                <input className="form-input" type="tel" placeholder="71 99999-9999" value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} maxLength={20} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Brasil: só DDD + número (ex: 75 99999-9999). Outro país: com + e código (ex: +54 11 9999-9999)
                </span>
              </div>
              {saveMsg && <p style={{ fontSize: "0.8rem", color: saveMsg.startsWith("Erro") ? "#dc2626" : "#059669" }}>{saveMsg}</p>}
              {error && <p className="text-error">{error}</p>}
              <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}

          {!editMode && session && (
            <button
              type="button"
              onClick={() =>
                compartilhar({
                  title: "Minha loja no Mercado Ilha",
                  text: "Confira minha loja no Mercado Ilha!",
                  url: window.location.origin + "/store/" + session.user.id,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "0.6rem",
                marginTop: 12,
                background: "#fff",
                border: "2px solid var(--blue-main)",
                borderRadius: 10,
                color: "var(--blue-main)",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              <ShareIcon /> Compartilhar minha loja
            </button>
          )}
        </div>

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

          {/* Leyenda de validez */}
          <div style={{ background: "#fff8e1", border: "1px solid #fcd34d", borderRadius: 10, padding: "0.7rem 0.875rem", fontSize: "0.78rem", color: "#92400e", marginBottom: "0.5rem", lineHeight: 1.5 }}>
            Os anúncios ficam ativos por <strong>30 dias</strong> e depois são desativados automaticamente. Você pode reativá-los para continuar oferecendo — anúncios inativos por mais de <strong>15 dias</strong> são excluídos permanentemente.
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
              {myListings.map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "0.75rem",
                    gap: 8,
                  }}
                >
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
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: l.status === "active" ? "#059669" : "#94a3b8", flexShrink: 0 }}>
                    {statusLabel[l.status] ?? l.status}
                  </span>
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
              ))}
            </div>
          )}
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

      </div>
    </div>
  );
}
