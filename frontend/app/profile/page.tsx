"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AvatarUpload from "../../components/AvatarUpload";

export default function ProfilePage() {
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
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
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s ?? null);
    });
    return () => { mounted = false; l?.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    setError(null);

    const uid = session.user.id;

    async function load() {
      // Load or create profile
      let { data: p, error: pe } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (!p && pe?.code === "PGRST116") {
        const { data: np } = await supabase
          .from("profiles")
          .insert({ id: uid, full_name: session.user.email ?? "Usuário", whatsapp: "", role: "user" })
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

      const [listRes, favRes] = await Promise.all([
        supabase.from("listings").select("id,title,price,price_text,status,created_at,expires_at").eq("user_id", uid).order("created_at", { ascending: false }),
        supabase.from("favorites").select("id,listing_id,listings(id,title,price,price_text,status)").eq("profile_id", uid).order("created_at", { ascending: false }),
      ]);

      if (!mounted) return;
      if (listRes.error) setError(listRes.error.message);
      else setMyListings(listRes.data ?? []);
      setFavorites(favRes.data ?? []);
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [session]);

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
      setProfile((p: any) => ({ ...p, full_name: editName.trim(), whatsapp: editWhatsapp.trim() }));
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
    setMyListings((prev) => prev.filter((l) => l.id !== id));
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    setToggling(id);
    const goActive = currentStatus !== "active";
    const update: Record<string, unknown> = {
      status: goActive ? "active" : "paused",
      ...(goActive && { expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }),
    };
    const { error: e } = await supabase.from("listings").update(update).eq("id", id);
    if (!e) setMyListings((prev) => prev.map((l) => l.id === id ? { ...l, ...update } : l));
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
        <p className="text-muted" style={{ marginBottom: 24 }}>Entre para publicar anúncios e gerenciar seus favoritos.</p>
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
          {profile != null && (
            <AvatarUpload
              userId={session.user.id}
              currentAvatarUrl={profile.avatar_url ?? null}
              fullName={profile.full_name ?? ""}
              onUpdate={(url) => setProfile((p: any) => ({ ...p, avatar_url: url }))}
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
                  DDD + número, sem +55. Ex: 75 99999-9999
                </span>
              </div>
              {saveMsg && <p style={{ fontSize: "0.8rem", color: saveMsg.startsWith("Erro") ? "#dc2626" : "#059669" }}>{saveMsg}</p>}
              {error && <p className="text-error">{error}</p>}
              <button type="button" className="btn btn-primary" onClick={saveProfile} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
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
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "0.7rem 0.875rem", fontSize: "0.78rem", color: "#0369a1", marginBottom: "0.5rem", lineHeight: 1.5 }}>
            Os anúncios ficam ativos por <strong>30 dias</strong> e depois são desativados automaticamente. Você pode reativá-los a qualquer momento.
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

        {/* ── Favoritos ── */}
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.625rem" }}>
            Favoritos ({favorites.length})
          </h2>

          {favorites.length === 0 ? (
            <div className="card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Você não tem favoritos ainda.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {favorites.map((fav) => {
                const l = fav.listings as any;
                if (!l) return null;
                return (
                  <Link
                    key={fav.id}
                    href={`/listings/${l.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#fff",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "0.75rem",
                      textDecoration: "none",
                      color: "inherit",
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        ❤️ {l.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--blue-main)", fontWeight: 700, marginTop: 2 }}>
                        {listingPrice(l)}
                      </div>
                    </div>
                    <span style={{ color: "#cbd5e1", flexShrink: 0 }}>›</span>
                  </Link>
                );
              })}
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
