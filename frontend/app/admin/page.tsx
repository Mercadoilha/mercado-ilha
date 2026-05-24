"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Tab = "dashboard" | "listings" | "reports" | "banners" | "users" | "settings" | "categorias";

// ─────────────────────────────────────────────
// Icon library
// ─────────────────────────────────────────────
const ICON_GROUPS: { group: string; icons: { e: string; l: string }[] }[] = [
  { group: "Veículos", icons: [
    { e: "🚗", l: "Auto" }, { e: "🚙", l: "4x4 / SUV" }, { e: "🏍️", l: "Moto" },
    { e: "🛵", l: "Scooter" }, { e: "🚜", l: "Trator" }, { e: "🛒", l: "Carro de mão" },
    { e: "🚐", l: "Van" }, { e: "🚛", l: "Caminhão" }, { e: "⛵", l: "Barco" },
    { e: "🚤", l: "Lancha" }, { e: "🚲", l: "Bicicleta" }, { e: "🛺", l: "Triciclo" },
  ]},
  { group: "Serviços do lar", icons: [
    { e: "🏠", l: "Lar" }, { e: "🔨", l: "Carpinteiro" }, { e: "🪚", l: "Marceneiro" },
    { e: "🔧", l: "Técnico / Mecânico" }, { e: "🪛", l: "Eletricista" }, { e: "🚿", l: "Encanador" },
    { e: "🧹", l: "Limpeza" }, { e: "🖌️", l: "Pintor" }, { e: "🧱", l: "Construção" },
    { e: "🏗️", l: "Obra" }, { e: "🪟", l: "Vidraçaria" }, { e: "🛠️", l: "Manutenção" },
    { e: "🪜", l: "Reformas" }, { e: "🔩", l: "Ferragem" }, { e: "⚡", l: "Eletricidade" },
  ]},
  { group: "Beleza & bem-estar", icons: [
    { e: "✂️", l: "Cabeleireiro" }, { e: "💅", l: "Manicure" }, { e: "💆", l: "Massagem" },
    { e: "💇", l: "Barbearia" }, { e: "🧴", l: "Cosméticos" }, { e: "💄", l: "Maquiagem" },
    { e: "🌸", l: "Spa / Estética" }, { e: "🪭", l: "Salão" },
  ]},
  { group: "Saúde", icons: [
    { e: "🦷", l: "Odontólogo" }, { e: "👨‍⚕️", l: "Médico" }, { e: "🏥", l: "Clínica" },
    { e: "💊", l: "Farmácia" }, { e: "🩺", l: "Consulta" }, { e: "🩹", l: "Curativo" },
    { e: "🧬", l: "Laboratório" }, { e: "🔬", l: "Exames" }, { e: "🧘", l: "Bem-estar" },
  ]},
  { group: "Educação", icons: [
    { e: "🎓", l: "Educação" }, { e: "📚", l: "Cursos / Livros" }, { e: "✏️", l: "Aulas" },
    { e: "📖", l: "Leitura" }, { e: "🖥️", l: "Informática" }, { e: "🌐", l: "Idiomas" },
    { e: "🎨", l: "Artes" }, { e: "🎸", l: "Música" },
  ]},
  { group: "Gastronomia", icons: [
    { e: "🍽️", l: "Restaurante" }, { e: "🥘", l: "Comida caseira" }, { e: "🍕", l: "Pizzaria" },
    { e: "🥩", l: "Açougue" }, { e: "🥖", l: "Padaria" }, { e: "🍰", l: "Confeitaria" },
    { e: "☕", l: "Café / Bar" }, { e: "🦀", l: "Frutos do mar" }, { e: "🥬", l: "Orgânicos" },
    { e: "🍦", l: "Sorveteria" }, { e: "🧃", l: "Sucos" }, { e: "🥗", l: "Saudável" },
  ]},
  { group: "Produtos básicos", icons: [
    { e: "🔥", l: "Garrafa de gás" }, { e: "💧", l: "Botijão de água" }, { e: "🧼", l: "Limpeza" },
    { e: "🥚", l: "Ovos / Laticínios" }, { e: "🍞", l: "Pão" }, { e: "📦", l: "Produtos gerais" },
  ]},
  { group: "Imóveis", icons: [
    { e: "🏡", l: "Casa" }, { e: "🏢", l: "Apartamento" }, { e: "🔑", l: "Aluguel" },
    { e: "🌍", l: "Terreno" }, { e: "🏖️", l: "Praia" }, { e: "🏕️", l: "Área rural" },
  ]},
  { group: "Agro & natureza", icons: [
    { e: "🌱", l: "Plantas" }, { e: "🪴", l: "Jardim" }, { e: "🐄", l: "Agropecuário" },
    { e: "🐔", l: "Aves" }, { e: "🐖", l: "Suínos" }, { e: "🐠", l: "Pesca" },
    { e: "🎣", l: "Pesca esportiva" }, { e: "🌾", l: "Agricultura" }, { e: "🪓", l: "Madeira" },
  ]},
  { group: "Entregas", icons: [
    { e: "📫", l: "Entregas" }, { e: "🚚", l: "Frete" }, { e: "📮", l: "Encomendas" },
    { e: "🗺️", l: "Translados" }, { e: "📦", l: "Pacotes" },
  ]},
  { group: "Tecnologia", icons: [
    { e: "💻", l: "Computadores" }, { e: "📱", l: "Celulares" }, { e: "🖨️", l: "Impressoras" },
    { e: "📡", l: "Internet / Antenas" }, { e: "🔋", l: "Baterias / Energia" },
  ]},
  { group: "Eventos & lazer", icons: [
    { e: "🎉", l: "Festas" }, { e: "📸", l: "Fotografia" }, { e: "🎵", l: "Música ao vivo" },
    { e: "🎭", l: "Entretenimento" }, { e: "⚽", l: "Esportes" }, { e: "🌊", l: "Mar / Praia" },
  ]},
  { group: "Moda & vestuário", icons: [
    { e: "👔", l: "Roupas" }, { e: "👗", l: "Moda feminina" }, { e: "👟", l: "Calçados" },
    { e: "🧵", l: "Costura / Alfaiate" }, { e: "👜", l: "Bolsas / Acessórios" },
  ]},
  { group: "Serviços profissionais", icons: [
    { e: "⚖️", l: "Advocacia" }, { e: "💰", l: "Finanças" }, { e: "🔐", l: "Segurança" },
    { e: "📋", l: "Administração" }, { e: "🤝", l: "Consultoria" },
    { e: "📊", l: "Contabilidade" }, { e: "📝", l: "Documentos" },
  ]},
  { group: "Pets", icons: [
    { e: "🐾", l: "Pets" }, { e: "🐕", l: "Cães" }, { e: "🐈", l: "Gatos" },
    { e: "🐦", l: "Aves" }, { e: "💉", l: "Veterinário" },
  ]},
];

function IconPicker({ selected, onSelect }: { selected: string; onSelect: (e: string) => void }) {
  return (
    <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, padding: "0.5rem", background: "#fafafa" }}>
      {ICON_GROUPS.map((group) => (
        <div key={group.group} style={{ marginBottom: "0.625rem" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {group.group}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {group.icons.map((icon) => (
              <button
                key={icon.e + icon.l}
                type="button"
                title={icon.l}
                onClick={() => onSelect(icon.e)}
                style={{
                  width: 38,
                  height: 38,
                  fontSize: "1.25rem",
                  background: icon.e === selected ? "var(--blue-xlight)" : "#fff",
                  border: icon.e === selected ? "2px solid var(--blue-main)" : "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "border 0.1s",
                }}
              >
                {icon.e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page — auth guard + tab router
// ─────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) { router.push("/signin"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      setReady(true);
    }
    check();
  }, [router]);

  if (!ready) return (
    <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div className="spinner" />
    </div>
  );

  const tabBtn = (t: Tab, label: string, icon: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "0.5rem 0.75rem",
        background: tab === t ? "var(--blue-xlight)" : "transparent",
        border: "none",
        borderRadius: 10,
        color: tab === t ? "var(--blue-main)" : "var(--text-muted)",
        fontWeight: tab === t ? 700 : 600,
        fontSize: "0.68rem",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>Administração</h1>
        <span style={{ marginLeft: "auto", background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700 }}>
          Admin
        </span>
      </header>

      {/* Tab bar */}
      <div style={{ display: "flex", justifyContent: "space-around", padding: "0.5rem 0.5rem 0", background: "#fff", borderBottom: "1px solid var(--border)" }}>
        {tabBtn("dashboard", "Dashboard", "📊")}
        {tabBtn("listings", "Anúncios", "🛍️")}
        {tabBtn("reports", "Denúncias", "🚨")}
        {tabBtn("banners", "Banners", "🖼️")}
        {tabBtn("users", "Usuários", "👥")}
        {tabBtn("categorias", "Categorias", "🏷️")}
        {tabBtn("settings", "Config", "⚙️")}
      </div>

      <div style={{ padding: "1rem" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "listings" && <Listings />}
        {tab === "reports" && <Reports />}
        {tab === "banners" && <Banners />}
        {tab === "users" && <Users />}
        {tab === "categorias" && <Categories />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState({ listings: 0, active: 0, reports: 0, users: 0, banners: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [listRes, repRes, userRes, banRes] = await Promise.all([
        supabase.from("listings").select("id,status"),
        supabase.from("reports").select("id").eq("status", "new"),
        supabase.from("profiles").select("id"),
        supabase.from("banners").select("id").eq("active", true),
      ]);
      const listings = listRes.data ?? [];
      setStats({
        listings: listings.length,
        active: listings.filter((l: any) => l.status === "active").length,
        reports: repRes.data?.length ?? 0,
        users: userRes.data?.length ?? 0,
        banners: banRes.data?.length ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  const cards = [
    { label: "Anúncios ativos", value: stats.active, icon: "✅", color: "#059669" },
    { label: "Total anúncios", value: stats.listings, icon: "🛍️", color: "var(--blue-main)" },
    { label: "Denúncias novas", value: stats.reports, icon: "🚨", color: stats.reports > 0 ? "#dc2626" : "var(--text-muted)" },
    { label: "Usuários", value: stats.users, icon: "👥", color: "var(--blue-main)" },
    { label: "Banners ativos", value: stats.banners, icon: "🖼️", color: "var(--sand)" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.875rem" }}>Visão geral</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Listings management
// ─────────────────────────────────────────────
function Listings() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase
      .from("listings")
      .select("id,title,price,price_text,status,created_at,user_id,profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setListings(data ?? []); setLoading(false); });
  }, []);

  const setStatus = async (id: number, status: string) => {
    setBusy(id);
    setMsg("");
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (!error) {
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
      setMsg(`Anúncio ${id} atualizado para "${status}".`);
    }
    setBusy(null);
  };

  const deleteL = async (id: number) => {
    if (!confirm("Deletar permanentemente este anúncio?")) return;
    setBusy(id);
    await supabase.from("listings").delete().eq("id", id);
    setListings((prev) => prev.filter((l) => l.id !== id));
    setBusy(null);
  };

  const filtered = filter === "all" ? listings : listings.filter((l) => l.status === filter);

  const statusColor: Record<string, string> = {
    active: "#059669", paused: "#d97706", sold: "#6366f1",
    expired: "#94a3b8", hidden: "#f97316", blocked: "#dc2626",
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: "0.875rem", flexWrap: "wrap" }}>
        {["all", "active", "hidden", "blocked", "expired"].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`badge ${filter === f ? "badge-blue" : ""}`}
            style={{ cursor: "pointer", border: filter === f ? "none" : "1px solid var(--border)", background: filter === f ? undefined : "#fff", padding: "0.3rem 0.7rem", borderRadius: 999 }}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
      </div>
      {msg && <p style={{ color: "var(--blue-main)", fontSize: "0.8rem", marginBottom: 8 }}>{msg}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filtered.map((l) => (
          <div key={l.id} className="card" style={{ padding: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/listings/${l.id}`} target="_blank" style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b", textDecoration: "none" }}>
                  {l.title}
                </Link>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {(l.profiles as any)?.full_name ?? "—"} · #{l.id}
                </div>
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: statusColor[l.status] ?? "#94a3b8", flexShrink: 0 }}>
                {l.status}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {l.status !== "active" && (
                <button type="button" disabled={busy === l.id} onClick={() => setStatus(l.id, "active")}
                  className="btn btn-primary" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}>
                  ✅ Ativar
                </button>
              )}
              {l.status !== "hidden" && (
                <button type="button" disabled={busy === l.id} onClick={() => setStatus(l.id, "hidden")}
                  className="btn btn-outline" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", color: "#f97316", borderColor: "#f97316" }}>
                  🙈 Ocultar
                </button>
              )}
              {l.status !== "blocked" && (
                <button type="button" disabled={busy === l.id} onClick={() => setStatus(l.id, "blocked")}
                  className="btn btn-outline" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", color: "#dc2626", borderColor: "#dc2626" }}>
                  🚫 Bloquear
                </button>
              )}
              <button type="button" disabled={busy === l.id} onClick={() => deleteL(l.id)}
                className="btn" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: "#fef2f2", color: "#dc2626" }}>
                🗑️ Deletar
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhum anúncio.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Reports management
// ─────────────────────────────────────────────
function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("reports")
      .select("id,listing_id,reason,details,status,created_at,listings(title)")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => { setReports(data ?? []); setLoading(false); });
  }, []);

  const resolve = async (id: number, status: "resolved" | "dismissed") => {
    setBusy(id);
    await supabase.from("reports").update({ status }).eq("id", id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setBusy(null);
  };

  const hideReportedListing = async (report: any) => {
    setBusy(report.id);
    await supabase.from("listings").update({ status: "hidden" }).eq("id", report.listing_id);
    await supabase.from("reports").update({ status: "resolved" }).eq("id", report.id);
    setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: "resolved" } : r));
    setBusy(null);
  };

  const statusColor: Record<string, string> = {
    new: "#dc2626", reviewing: "#d97706", resolved: "#059669", dismissed: "#94a3b8",
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.875rem" }}>
        Denúncias ({reports.filter((r) => r.status === "new").length} novas)
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {reports.map((r) => (
          <div key={r.id} className="card" style={{ padding: "0.875rem", borderLeft: `3px solid ${statusColor[r.status] ?? "#94a3b8"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Link href={`/listings/${r.listing_id}`} target="_blank" style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b", textDecoration: "none" }}>
                  {(r.listings as any)?.title ?? `Anúncio #${r.listing_id}`} ↗
                </Link>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 3 }}>
                  Motivo: <strong style={{ color: "#1e293b" }}>{r.reason}</strong>
                </div>
                {r.details && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{r.details}</div>}
              </div>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: statusColor[r.status], flexShrink: 0 }}>
                {r.status}
              </span>
            </div>
            {r.status === "new" && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button type="button" disabled={busy === r.id} onClick={() => hideReportedListing(r)}
                  className="btn" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa" }}>
                  🙈 Ocultar anúncio + resolver
                </button>
                <button type="button" disabled={busy === r.id} onClick={() => resolve(r.id, "dismissed")}
                  className="btn btn-ghost" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", border: "1px solid var(--border)" }}>
                  ✕ Dispensar
                </button>
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhuma denúncia.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Banners management
// ─────────────────────────────────────────────
function Banners() {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Rotation interval
  const [rotationSecs, setRotationSecs] = useState("4");
  const [rotSaving, setRotSaving] = useState(false);
  const [rotMsg, setRotMsg] = useState("");

  // New banner form
  const [bTitle, setBTitle] = useState("");
  const [bImageUrl, setBImageUrl] = useState("");
  const [bWhatsapp, setBWhatsapp] = useState("");
  const [bPosition, setBPosition] = useState<"home" | "listado">("home");
  const [bSaving, setBSaving] = useState(false);
  const [bMsg, setBMsg] = useState("");

  useEffect(() => {
    supabase.from("banners").select("*").order("sort_order").then(({ data }) => { setBanners(data ?? []); setLoading(false); });
    supabase.from("admin_settings").select("value").eq("key", "banner_interval").single().then(({ data }) => {
      if (data?.value?.value) setRotationSecs(String(data.value.value));
    });
  }, []);

  const saveRotation = async () => {
    const secs = Number(rotationSecs);
    if (!secs || secs < 1) { setRotMsg("Mínimo 1 segundo."); return; }
    setRotSaving(true);
    setRotMsg("");
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "banner_interval", value: { value: secs } }, { onConflict: "key" });
    // invalidate cache so BannerRotativo picks up new value on next load
    const { invalidateAdminSettingsCache } = await import("../../lib/adminSettings");
    invalidateAdminSettingsCache();
    setRotMsg(error ? "Erro: " + error.message : "Intervalo salvo.");
    setRotSaving(false);
  };

  const toggleBanner = async (id: number, active: boolean) => {
    await supabase.from("banners").update({ active }).eq("id", id);
    setBanners((prev) => prev.map((b) => b.id === id ? { ...b, active } : b));
  };

  const deleteBanner = async (id: number) => {
    if (!confirm("Deletar banner?")) return;
    await supabase.from("banners").delete().eq("id", id);
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  const saveBanner = async () => {
    if (!bImageUrl.trim()) { setBMsg("URL da imagem é obrigatória."); return; }
    if (!bWhatsapp.trim()) { setBMsg("WhatsApp do anunciante é obrigatório."); return; }
    const raw = bWhatsapp.replace(/\D/g, "");
    const number = raw.startsWith("55") ? raw : `55${raw}`;
    const linkUrl = `https://wa.me/${number}?text=${encodeURIComponent("Olá! Vi o anúncio no Mercado Ilha e gostaria de saber mais.")}`;
    setBSaving(true);
    setBMsg("");
    const { data, error } = await supabase.from("banners").insert({
      title: bTitle || null,
      image_url: bImageUrl.trim(),
      link_url: linkUrl,
      position: bPosition,
      sort_order: banners.length,
      active: true,
    }).select().single();
    if (error) { setBMsg("Erro: " + error.message); }
    else { setBanners((prev) => [...prev, data]); setShowForm(false); setBTitle(""); setBImageUrl(""); setBWhatsapp(""); }
    setBSaving(false);
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Rotation interval config */}
      <div className="card" style={{ padding: "0.875rem", marginBottom: "0.875rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b", marginBottom: "0.5rem" }}>
          ⏱️ Tempo de rotação dos banners
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="form-input"
            type="number"
            min={1}
            max={60}
            value={rotationSecs}
            onChange={(e) => setRotationSecs(e.target.value)}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>segundos</span>
          <button type="button" className="btn btn-primary" disabled={rotSaving} onClick={saveRotation} style={{ padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}>
            {rotSaving ? "..." : "Salvar"}
          </button>
        </div>
        {rotMsg && <p style={{ fontSize: "0.75rem", marginTop: 6, color: rotMsg.startsWith("Erro") ? "#dc2626" : "#059669", fontWeight: 600 }}>{rotMsg}</p>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Banners ({banners.length})</h2>
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}>
          {showForm ? "Cancelar" : "+ Novo"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: "0.875rem", marginBottom: "0.875rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div className="form-group">
            <label className="form-label">Título / nome do anunciante (opcional)</label>
            <input className="form-input" type="text" value={bTitle} onChange={(e) => setBTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">URL da imagem *</label>
            <input className="form-input" type="url" placeholder="https://..." value={bImageUrl} onChange={(e) => setBImageUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp do anunciante *</label>
            <input className="form-input" type="tel" placeholder="+55 75 99999-9999" value={bWhatsapp} onChange={(e) => setBWhatsapp(e.target.value)} maxLength={20} />
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 3 }}>
              Ao clicar no banner, o usuário será redirecionado a este número.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Posição</label>
            <select className="form-select" value={bPosition} onChange={(e) => setBPosition(e.target.value as "home" | "listado")}>
              <option value="home">Home</option>
              <option value="listado">Listado</option>
            </select>
          </div>
          {bMsg && <p className="text-error">{bMsg}</p>}
          <button type="button" className="btn btn-primary" disabled={bSaving} onClick={saveBanner}>
            {bSaving ? "Salvando..." : "Salvar banner"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {banners.map((b) => {
          const waMatch = b.link_url?.match(/wa\.me\/(\d+)/);
          const waNumber = waMatch ? `+${waMatch[1]}` : null;
          return (
            <div key={b.id} className="card" style={{ padding: "0.75rem", display: "flex", gap: 10, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt={b.title ?? ""} style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0, background: "var(--blue-xlight)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1e293b" }}>{b.title ?? "Banner"}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {b.position} · {b.active ? "✅ Ativo" : "⏸️ Inativo"}
                </div>
                {waNumber && (
                  <div style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>
                    📱 {waNumber}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => toggleBanner(b.id, !b.active)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.75rem" }}>
                  {b.active ? "⏸️" : "▶️"}
                </button>
                <button type="button" onClick={() => deleteBanner(b.id)}
                  style={{ background: "#fef2f2", border: "none", borderRadius: 8, padding: "0.25rem 0.5rem", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem" }}>
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
        {banners.length === 0 && !showForm && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhum banner cadastrado.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Categories management
// ─────────────────────────────────────────────
function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pickingFor, setPickingFor] = useState<{ type: "cat" | "subcat"; id: number; catId?: number } | null>(null);
  const [subcats, setSubcats] = useState<Record<number, any[]>>({});
  const [loadingSubcats, setLoadingSubcats] = useState<Record<number, boolean>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("categories").select("id,name,slug,icon,is_active").order("sort_order")
      .then(({ data }) => { setCategories(data ?? []); setLoading(false); });
  }, []);

  const loadSubcats = async (catId: number) => {
    if (subcats[catId] !== undefined) return;
    setLoadingSubcats((p) => ({ ...p, [catId]: true }));
    const { data } = await supabase.from("subcategories").select("id,name,icon,is_active").eq("category_id", catId).order("sort_order");
    setSubcats((p) => ({ ...p, [catId]: data ?? [] }));
    setLoadingSubcats((p) => ({ ...p, [catId]: false }));
  };

  const handleExpand = (catId: number) => {
    if (expanded === catId) { setExpanded(null); return; }
    setExpanded(catId);
    loadSubcats(catId);
  };

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 2000); };

  const saveCatIcon = async (catId: number, icon: string) => {
    const { error } = await supabase.from("categories").update({ icon }).eq("id", catId);
    if (!error) { setCategories((p) => p.map((c) => c.id === catId ? { ...c, icon } : c)); flash("Ícone salvo."); }
    else flash("Erro: " + error.message);
    setPickingFor(null);
  };

  const saveSubcatIcon = async (subcatId: number, catId: number, icon: string) => {
    const { error } = await supabase.from("subcategories").update({ icon }).eq("id", subcatId);
    if (!error) {
      setSubcats((p) => ({ ...p, [catId]: (p[catId] ?? []).map((s) => s.id === subcatId ? { ...s, icon } : s) }));
      flash("Ícone salvo.");
    } else flash("Erro: " + error.message);
    setPickingFor(null);
  };

  const isPicking = (type: "cat" | "subcat", id: number) => pickingFor?.type === type && pickingFor?.id === id;

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Categorias</h2>
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.875rem" }}>
        Toque no ícone para escolher. Expanda para editar subcategorias.
      </p>
      {msg && <p style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 600, marginBottom: 8 }}>{msg}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {categories.map((cat) => (
          <div key={cat.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Category row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.75rem" }}>
              <button
                type="button"
                title="Alterar ícone"
                onClick={() => setPickingFor(isPicking("cat", cat.id) ? null : { type: "cat", id: cat.id })}
                style={{
                  fontSize: "1.4rem", width: 44, height: 44, borderRadius: 10, flexShrink: 0, cursor: "pointer",
                  border: isPicking("cat", cat.id) ? "2px solid var(--blue-main)" : "1px solid var(--border)",
                  background: isPicking("cat", cat.id) ? "var(--blue-xlight)" : "#fff",
                }}
              >
                {cat.icon || "📌"}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}>{cat.name}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{cat.slug} · {cat.is_active ? "✅" : "⏸️"}</div>
              </div>
              <button type="button" onClick={() => handleExpand(cat.id)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
                {expanded === cat.id ? "▲" : "▼"} Sub
              </button>
            </div>

            {/* Icon picker for category */}
            {isPicking("cat", cat.id) && (
              <div style={{ padding: "0 0.75rem 0.75rem" }}>
                <IconPicker selected={cat.icon || ""} onSelect={(icon) => saveCatIcon(cat.id, icon)} />
              </div>
            )}

            {/* Subcategories */}
            {expanded === cat.id && (
              <div style={{ borderTop: "1px solid var(--border)", background: "#f8fafc" }}>
                {loadingSubcats[cat.id] ? (
                  <div style={{ textAlign: "center", padding: "0.75rem" }}><div className="spinner" /></div>
                ) : (subcats[cat.id] ?? []).length === 0 ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", padding: "0.75rem", textAlign: "center" }}>Sem subcategorias.</p>
                ) : (
                  (subcats[cat.id] ?? []).map((sub) => (
                    <div key={sub.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.625rem 0.75rem", borderBottom: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          title="Alterar ícone"
                          onClick={() => setPickingFor(isPicking("subcat", sub.id) ? null : { type: "subcat", id: sub.id, catId: cat.id })}
                          style={{
                            fontSize: "1.2rem", width: 38, height: 38, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                            border: isPicking("subcat", sub.id) ? "2px solid var(--blue-main)" : "1px solid var(--border)",
                            background: isPicking("subcat", sub.id) ? "var(--blue-xlight)" : "#fff",
                          }}
                        >
                          {sub.icon || "•"}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.8rem", color: "#1e293b" }}>{sub.name}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{sub.is_active ? "✅ Ativa" : "⏸️ Inativa"}</div>
                        </div>
                      </div>
                      {isPicking("subcat", sub.id) && (
                        <div style={{ padding: "0.5rem 0.75rem", background: "#f1f5f9", borderBottom: "1px solid var(--border)" }}>
                          <IconPicker selected={sub.icon || ""} onSelect={(icon) => saveSubcatIcon(sub.id, cat.id, icon)} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhuma categoria encontrada.</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings management
// ─────────────────────────────────────────────
function Settings() {
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "admin_whatsapp")
      .single()
      .then(({ data }) => {
        if (data?.value?.value) setWhatsapp(String(data.value.value));
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (!whatsapp.trim()) { setMsg("Informe o número."); return; }
    setSaving(true);
    setMsg("");
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "admin_whatsapp", value: { value: whatsapp.trim() } }, { onConflict: "key" });
    setMsg(error ? "Erro: " + error.message : "Número salvo com sucesso.");
    setSaving(false);
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.875rem" }}>Configurações</h2>
      <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div className="form-group">
          <label className="form-label">WhatsApp de contato (sugestões e reclamações)</label>
          <input
            className="form-input"
            type="tel"
            placeholder="+55 75 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            maxLength={20}
          />
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
            Informe o número com código do país, ex: +55 75 99707-5133
          </p>
        </div>
        {msg && (
          <p style={{ fontSize: "0.8rem", color: msg.startsWith("Erro") ? "#dc2626" : "#059669", fontWeight: 600 }}>
            {msg}
          </p>
        )}
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? "Salvando..." : "💾 Salvar número"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Users management
// ─────────────────────────────────────────────
function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("id,full_name,whatsapp,role,created_at,is_active").order("created_at", { ascending: false }).then(({ data }) => {
      setUsers(data ?? []);
      setLoading(false);
    });
  }, []);

  const toggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`${newRole === "admin" ? "Dar" : "Remover"} papel de admin para este usuário?`)) return;
    setBusy(id);
    await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
    setBusy(null);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setBusy(id);
    await supabase.from("profiles").update({ is_active: !isActive }).eq("id", id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_active: !isActive } : u));
    setBusy(null);
  };

  const filtered = search
    ? users.filter((u) => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.whatsapp?.includes(search))
    : users;

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: "0.875rem" }}>
        <input className="form-input" type="text" placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filtered.map((u) => (
          <div key={u.id} className="card" style={{ padding: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}>
                  {u.full_name}
                  {u.role === "admin" && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Admin</span>}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  📱 {u.whatsapp || "—"}
                </div>
                <div style={{ fontSize: "0.7rem", color: u.is_active ? "#059669" : "#dc2626", marginTop: 2, fontWeight: 700 }}>
                  {u.is_active ? "✅ Ativo" : "🚫 Bloqueado"}
                </div>
              </div>
              <Link href={`/store/${u.id}`} target="_blank" style={{ fontSize: "0.75rem", color: "var(--blue-main)", textDecoration: "none", flexShrink: 0 }}>
                Ver loja ↗
              </Link>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" disabled={busy === u.id} onClick={() => toggleRole(u.id, u.role)}
                className="btn btn-outline" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}>
                {u.role === "admin" ? "👤 Remover admin" : "⭐ Tornar admin"}
              </button>
              <button type="button" disabled={busy === u.id} onClick={() => toggleActive(u.id, u.is_active)}
                className="btn" style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: u.is_active ? "#fef2f2" : "#f0fdf4", color: u.is_active ? "#dc2626" : "#059669", border: `1px solid ${u.is_active ? "#fca5a5" : "#86efac"}` }}>
                {u.is_active ? "🚫 Bloquear" : "✅ Desbloquear"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhum usuário encontrado.</p>}
      </div>
    </div>
  );
}
