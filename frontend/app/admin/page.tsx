"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Tab = "dashboard" | "metricas" | "listings" | "reports" | "banners" | "users" | "settings" | "categorias";

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
  { group: "Eletrodomésticos & Conserto", icons: [
    { e: "❄️", l: "Geladeira / Frigorífico" }, { e: "🌀", l: "Máquina de lavar" },
    { e: "📺", l: "Televisão" }, { e: "🔌", l: "Eletrodoméstico" },
    { e: "🎛️", l: "Painel / Controles" }, { e: "🫧", l: "Lava-louças" },
    { e: "💡", l: "Elétrica" }, { e: "🛠️", l: "Conserto geral" },
    { e: "🔧", l: "Reparo / Manutenção" }, { e: "🪛", l: "Eletrônica" },
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
  { group: "Cuidados infantis", icons: [
    { e: "🧸", l: "Babá / Brinquedos" }, { e: "👶", l: "Bebê" }, { e: "🍼", l: "Mamadeira" },
    { e: "🎠", l: "Recreação infantil" }, { e: "🎒", l: "Mochila / Escola" },
  ]},
  { group: "Esportes", icons: [
    { e: "🏄", l: "Surf" }, { e: "🤿", l: "Mergulho" }, { e: "💪", l: "Academia / Musculação" },
    { e: "🎾", l: "Tênis / Raquete" },
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
      const uid = data.session.user.id;
      const cacheKey = `mercado-ilha-admin-${uid}`;
      if (sessionStorage.getItem(cacheKey) === "1") { setReady(true); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();
      if (profile?.role !== "admin") { router.push("/"); return; }
      sessionStorage.setItem(cacheKey, "1");
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
        {tabBtn("metricas", "Métricas", "📈")}
        {tabBtn("categorias", "Categorias", "🏷️")}
        {tabBtn("users", "Usuários", "👥")}
        {tabBtn("listings", "Anúncios", "🛍️")}
        {tabBtn("banners", "Banners", "🖼️")}
        {tabBtn("settings", "Config", "⚙️")}
        {tabBtn("reports", "Denúncias", "🚨")}
      </div>

      <div style={{ padding: "1rem" }}>
        <div style={{ display: tab === "dashboard" ? undefined : "none" }}><Dashboard /></div>
        <div style={{ display: tab === "metricas" ? undefined : "none" }}><Metrics /></div>
        <div style={{ display: tab === "listings" ? undefined : "none" }}><Listings /></div>
        <div style={{ display: tab === "reports" ? undefined : "none" }}><Reports /></div>
        <div style={{ display: tab === "banners" ? undefined : "none" }}><Banners /></div>
        <div style={{ display: tab === "users" ? undefined : "none" }}><Users /></div>
        <div style={{ display: tab === "categorias" ? undefined : "none" }}><Categories /></div>
        <div style={{ display: tab === "settings" ? undefined : "none" }}><Settings /></div>
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
// Métricas (tracking pre-monetización)
// ─────────────────────────────────────────────
function Metrics() {
  const [summary, setSummary] = useState<any>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sumRes, topRes] = await Promise.all([
        supabase.rpc("get_tracking_summary"),
        supabase.rpc("get_top_listings_by_whatsapp", { _limit: 10 }),
      ]);
      setSummary(sumRes.data ?? null);
      setTop(topRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  if (!summary) {
    return (
      <div className="card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        Ainda não há dados de métricas. Verifique se a migração de tracking foi executada no Supabase.
      </div>
    );
  }

  const cards = [
    { label: "Clicks WhatsApp (total)", value: summary.whatsapp_total ?? 0, icon: "💬", color: "#059669" },
    { label: "Clicks WhatsApp (7 dias)", value: summary.whatsapp_last_7d ?? 0, icon: "🔥", color: "#059669" },
    { label: "Visualizações (total)", value: summary.views_total ?? 0, icon: "👁️", color: "var(--blue-main)" },
    { label: "Visualizações (7 dias)", value: summary.views_last_7d ?? 0, icon: "📅", color: "var(--blue-main)" },
    { label: "Clicks em banners (total)", value: summary.banner_total ?? 0, icon: "🖼️", color: "var(--sand)" },
    { label: "Clicks em banners (7 dias)", value: summary.banner_last_7d ?? 0, icon: "🖼️", color: "var(--sand)" },
  ];

  return (
    <div>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.875rem" }}>Métricas de engajamento</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
        {cards.map((c) => (
          <div key={c.label} className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b", margin: "1.25rem 0 0.75rem" }}>
        Anúncios com mais contatos
      </h2>
      {top.length === 0 ? (
        <div className="card" style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Ainda não houve clicks de WhatsApp em anúncios.
        </div>
      ) : (
        <div className="card" style={{ padding: "0.5rem 0.875rem" }}>
          {top.map((row: any, i: number) => (
            <div
              key={row.listing_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.55rem 0",
                borderBottom: i < top.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <span style={{ fontWeight: 900, color: "var(--text-muted)", minWidth: 20, fontSize: "0.85rem" }}>{i + 1}</span>
              <Link href={`/listings/${row.listing_id}`} style={{ flex: 1, fontSize: "0.85rem", color: "#1e293b", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.title}
              </Link>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>💬 {row.wa_clicks}</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--blue-main)", whiteSpace: "nowrap" }}>👁️ {row.views}</span>
            </div>
          ))}
        </div>
      )}
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

    // Clean up R2 photos before deleting the listing
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? "";
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
            <input className="form-input" type="tel" placeholder="75 99999-9999" value={bWhatsapp} onChange={(e) => setBWhatsapp(e.target.value)} maxLength={20} />
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

  // New category form
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("");
  const [newCatType, setNewCatType] = useState("fija");
  const [newCatBtn, setNewCatBtn] = useState("Contatar");
  const [newCatSaving, setNewCatSaving] = useState(false);
  const [pickingNewCatIcon, setPickingNewCatIcon] = useState(false);

  // Edit category
  const [editingCat, setEditingCat] = useState<{ id: number; name: string; slug: string; type: string; btn: string; description: string; sectionId: number | null } | null>(null);
  const [editingCatSaving, setEditingCatSaving] = useState(false);

  // New subcategory form
  const [addingSubFor, setAddingSubFor] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubIcon, setNewSubIcon] = useState("🌊");
  const [newSubSaving, setNewSubSaving] = useState(false);
  const [pickingNewSubIcon, setPickingNewSubIcon] = useState(false);

  // Edit subcategory
  const [editingSub, setEditingSub] = useState<{ id: number; catId: number; name: string } | null>(null);
  const [editingSubSaving, setEditingSubSaving] = useState(false);

  // Sections management
  const [sections, setSections] = useState<any[]>([]);
  const [showSections, setShowSections] = useState(false);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionSaving, setNewSectionSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: number; title: string } | null>(null);
  const [editingSectionSaving, setEditingSectionSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("categories").select("id,name,slug,icon,is_active,location_type,contact_button_text,description,sort_order,home_section_id").order("sort_order"),
      supabase.from("home_sections").select("id,title,sort_order,is_featured_block").order("sort_order"),
    ]).then(([{ data: cats }, { data: secs }]) => {
      setCategories(cats ?? []);
      setSections(secs ?? []);
      setLoading(false);
    });
  }, []);

  const toSlug = (name: string) => name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const loadSubcats = async (catId: number) => {
    if (subcats[catId] !== undefined) return;
    setLoadingSubcats((p) => ({ ...p, [catId]: true }));
    const { data } = await supabase.from("subcategories").select("id,name,icon,is_active,sort_order").eq("category_id", catId).order("sort_order");
    setSubcats((p) => ({ ...p, [catId]: data ?? [] }));
    setLoadingSubcats((p) => ({ ...p, [catId]: false }));
  };

  const moveCat = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= categories.length) return;
    const next = [...categories];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    const results = await Promise.all(
      next.map((cat, i) => supabase.from("categories").update({ sort_order: i }).eq("id", cat.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      alert("Erro ao salvar ordem: " + failed.error.message);
      return;
    }
    setCategories(next.map((cat, i) => ({ ...cat, sort_order: i })));
  };

  const moveSubcat = async (catId: number, idx: number, dir: -1 | 1) => {
    const list = subcats[catId] ?? [];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const next = [...list];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    const results = await Promise.all(
      next.map((sub, i) => supabase.from("subcategories").update({ sort_order: i }).eq("id", sub.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      alert("Erro ao salvar ordem: " + failed.error.message);
      return;
    }
    setSubcats((prev) => ({ ...prev, [catId]: next.map((sub, i) => ({ ...sub, sort_order: i })) }));
  };

  const handleExpand = (catId: number) => {
    if (expanded === catId) { setExpanded(null); return; }
    setExpanded(catId);
    loadSubcats(catId);
  };

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(""), 2500); };

  // ── Section management ──
  const addSection = async () => {
    if (!newSectionTitle.trim()) { flash("Informe o título da seção."); return; }
    setNewSectionSaving(true);
    const { data, error } = await supabase.from("home_sections").insert({
      title: newSectionTitle.trim(), sort_order: sections.length, is_featured_block: false,
    }).select().single();
    if (!error && data) { setSections((p) => [...p, data]); setNewSectionTitle(""); setShowNewSection(false); flash("Seção criada."); }
    else flash("Erro: " + error?.message);
    setNewSectionSaving(false);
  };

  const saveEditSection = async () => {
    if (!editingSection || !editingSection.title.trim()) { flash("Informe o título."); return; }
    setEditingSectionSaving(true);
    const { error } = await supabase.from("home_sections").update({ title: editingSection.title.trim() }).eq("id", editingSection.id);
    if (!error) { setSections((p) => p.map((s) => s.id === editingSection.id ? { ...s, title: editingSection.title.trim() } : s)); setEditingSection(null); flash("Seção atualizada."); }
    else flash("Erro: " + error.message);
    setEditingSectionSaving(false);
  };

  const deleteSection = async (sectionId: number) => {
    if (!confirm("Deletar esta seção? As categorias associadas ficarão sem seção.")) return;
    const { error } = await supabase.from("home_sections").delete().eq("id", sectionId);
    if (!error) { setSections((p) => p.filter((s) => s.id !== sectionId)); flash("Seção deletada."); }
    else flash("Erro: " + error.message);
  };

  const moveSection = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    const results = await Promise.all(next.map((s, i) => supabase.from("home_sections").update({ sort_order: i }).eq("id", s.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) { alert("Erro ao reordenar: " + failed.error.message); return; }
    setSections(next.map((s, i) => ({ ...s, sort_order: i })));
  };

  const assignSection = async (catId: number, sectionId: number | null) => {
    const { error } = await supabase.from("categories").update({ home_section_id: sectionId }).eq("id", catId);
    if (!error) setCategories((p) => p.map((c) => c.id === catId ? { ...c, home_section_id: sectionId } : c));
    else flash("Erro: " + error.message);
  };

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

  const toggleCat = async (catId: number, current: boolean) => {
    await supabase.from("categories").update({ is_active: !current }).eq("id", catId);
    setCategories((p) => p.map((c) => c.id === catId ? { ...c, is_active: !current } : c));
    revalidateHome();
  };

  const deleteCat = async (catId: number) => {
    if (!confirm("Deletar esta categoria? Os anúncios existentes não serão afetados.")) return;
    const { error } = await supabase.from("categories").delete().eq("id", catId);
    if (!error) { setCategories((p) => p.filter((c) => c.id !== catId)); flash("Categoria deletada."); revalidateHome(); }
    else flash("Erro: " + error.message);
  };

  const addCategory = async () => {
    if (!newCatName.trim() || !newCatSlug.trim()) { flash("Nome e slug são obrigatórios."); return; }
    setNewCatSaving(true);
    const { data, error } = await supabase.from("categories").insert({
      name: newCatName.trim(), slug: newCatSlug.trim(), icon: newCatIcon || null,
      location_type: newCatType, contact_button_text: newCatBtn || "Contatar",
      is_active: true, sort_order: categories.length,
    }).select().single();
    if (!error && data) {
      setCategories((p) => [...p, data]);
      setShowNewCat(false); setNewCatName(""); setNewCatSlug(""); setNewCatIcon(""); setNewCatType("fija"); setNewCatBtn("Contatar");
      flash("Categoria criada.");
      revalidateHome();
    } else flash("Erro: " + error?.message);
    setNewCatSaving(false);
  };

  const toggleSubcat = async (subcatId: number, catId: number, current: boolean) => {
    await supabase.from("subcategories").update({ is_active: !current }).eq("id", subcatId);
    setSubcats((p) => ({ ...p, [catId]: (p[catId] ?? []).map((s) => s.id === subcatId ? { ...s, is_active: !current } : s) }));
  };

  const deleteSubcat = async (subcatId: number, catId: number) => {
    if (!confirm("Deletar esta subcategoria?")) return;
    await supabase.from("subcategories").delete().eq("id", subcatId);
    setSubcats((p) => ({ ...p, [catId]: (p[catId] ?? []).filter((s) => s.id !== subcatId) }));
    flash("Subcategoria deletada.");
  };

  const addSubcat = async (catId: number) => {
    if (!newSubName.trim()) { flash("Informe o nome."); return; }
    setNewSubSaving(true);
    const { data, error } = await supabase.from("subcategories").insert({
      category_id: catId, name: newSubName.trim(), slug: toSlug(newSubName.trim()),
      icon: newSubIcon || null, is_active: true, sort_order: (subcats[catId] ?? []).length,
    }).select().single();
    if (!error && data) {
      setSubcats((p) => ({ ...p, [catId]: [...(p[catId] ?? []), data] }));
      setAddingSubFor(null); setNewSubName(""); setNewSubIcon("🌊");
      flash("Subcategoria criada.");
    } else flash("Erro: " + error?.message);
    setNewSubSaving(false);
  };

  const saveEditCat = async () => {
    if (!editingCat || !editingCat.name.trim() || !editingCat.slug.trim()) { flash("Nome e slug são obrigatórios."); return; }
    const snapshot = categories;
    const updated = {
      name: editingCat.name.trim(),
      slug: editingCat.slug.trim(),
      location_type: editingCat.type,
      contact_button_text: editingCat.btn || "Contatar",
      description: editingCat.description.trim() || null,
      home_section_id: editingCat.sectionId,
    };
    setCategories((p) => p.map((c) => c.id === editingCat!.id ? { ...c, ...updated } : c));
    setEditingCat(null);
    flash("Categoria atualizada.");
    const { error } = await supabase.from("categories").update(updated).eq("id", editingCat.id);
    if (error) {
      setCategories(snapshot);
      flash("Erro ao salvar: " + error.message);
    } else {
      revalidateHome();
    }
  };

  const saveEditSub = async () => {
    if (!editingSub || !editingSub.name.trim()) { flash("Informe o nome."); return; }
    const snapshotSubs = subcats;
    const newName = editingSub.name.trim();
    setSubcats((p) => ({ ...p, [editingSub!.catId]: (p[editingSub!.catId] ?? []).map((s) => s.id === editingSub!.id ? { ...s, name: newName } : s) }));
    setEditingSub(null);
    flash("Subcategoria atualizada.");
    const { error } = await supabase.from("subcategories").update({ name: newName }).eq("id", editingSub.id);
    if (error) {
      setSubcats(snapshotSubs);
      flash("Erro ao salvar: " + error.message);
    }
  };

  const isPicking = (type: "cat" | "subcat", id: number) => pickingFor?.type === type && pickingFor?.id === id;

  const revalidateHome = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;
    fetch("/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Categorias ({categories.length})</h2>
        <button type="button" onClick={() => setShowNewCat((v) => !v)} className="btn btn-primary" style={{ padding: "0.4rem 0.9rem", fontSize: "0.8rem" }}>
          {showNewCat ? "Cancelar" : "+ Nova"}
        </button>
      </div>

      {msg && <p style={{ fontSize: "0.8rem", color: msg.startsWith("Erro") ? "#dc2626" : "#059669", fontWeight: 600, marginBottom: 8 }}>{msg}</p>}

      {/* ── Seções do home ── */}
      <div className="card" style={{ padding: "0.75rem", marginBottom: "0.875rem" }}>
        <button type="button" onClick={() => setShowSections((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}>Seções do home ({sections.length})</span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{showSections ? "▲" : "▼"}</span>
        </button>
        {showSections && (
          <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {sections.map((sec, secIdx) => (
              <div key={sec.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.5rem 0.625rem", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", minWidth: 22 }}>#{sec.id}</span>
                {editingSection !== null && editingSection.id === sec.id ? (
                  <>
                    <input className="form-input" type="text" value={editingSection.title}
                      onChange={(e) => setEditingSection((p) => p ? { ...p, title: e.target.value } : p)}
                      style={{ flex: 1, fontSize: "0.8rem", padding: "0.25rem 0.5rem" }} />
                    <button type="button" className="btn btn-primary" disabled={editingSectionSaving} onClick={saveEditSection} style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}>
                      {editingSectionSaving ? "..." : "💾"}
                    </button>
                    <button type="button" onClick={() => setEditingSection(null)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", fontSize: "0.72rem", color: "var(--text-muted)" }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: sec.is_featured_block ? 700 : 400, color: "#1e293b" }}>
                      {sec.title}{sec.is_featured_block ? " ⭐" : ""}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button type="button" disabled={secIdx === 0} onClick={() => moveSection(secIdx, -1)}
                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "0px 5px", cursor: secIdx === 0 ? "default" : "pointer", fontSize: "0.6rem", color: secIdx === 0 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "14px" }}>↑</button>
                      <button type="button" disabled={secIdx === sections.length - 1} onClick={() => moveSection(secIdx, 1)}
                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "0px 5px", cursor: secIdx === sections.length - 1 ? "default" : "pointer", fontSize: "0.6rem", color: secIdx === sections.length - 1 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "14px" }}>↓</button>
                    </div>
                    <button type="button" onClick={() => setEditingSection({ id: sec.id, title: sec.title })}
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.2rem 0.45rem", cursor: "pointer", fontSize: "0.72rem", color: "var(--blue-main)" }}>✏️</button>
                    {!sec.is_featured_block && (
                      <button type="button" onClick={() => deleteSection(sec.id)}
                        style={{ background: "#fef2f2", border: "none", borderRadius: 6, padding: "0.2rem 0.45rem", cursor: "pointer", color: "#dc2626", fontSize: "0.72rem" }}>🗑️</button>
                    )}
                  </>
                )}
              </div>
            ))}
            {showNewSection ? (
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <input className="form-input" type="text" placeholder="Nome da nova seção *" value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)} style={{ flex: 1, fontSize: "0.8rem" }} />
                <button type="button" className="btn btn-primary" disabled={newSectionSaving} onClick={addSection} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                  {newSectionSaving ? "..." : "Criar"}
                </button>
                <button type="button" onClick={() => { setShowNewSection(false); setNewSectionTitle(""); }}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-muted)" }}>✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowNewSection(true)}
                style={{ background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "0.5rem", cursor: "pointer", fontSize: "0.78rem", color: "var(--blue-main)", fontWeight: 600, marginTop: 2 }}>
                + Nova seção
              </button>
            )}
          </div>
        )}
      </div>

      {/* New category form */}
      {showNewCat && (
        <div className="card" style={{ padding: "0.875rem", marginBottom: "0.875rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <button type="button" onClick={() => setPickingNewCatIcon((v) => !v)}
              style={{ fontSize: "1.4rem", width: 44, height: 44, borderRadius: 10, flexShrink: 0, cursor: "pointer", border: "1px solid var(--border)", background: "#fff" }}>
              {newCatIcon || "📌"}
            </button>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="form-input" type="text" placeholder="Nome da categoria *" value={newCatName}
                onChange={(e) => { setNewCatName(e.target.value); setNewCatSlug(toSlug(e.target.value)); }} />
            </div>
          </div>
          {pickingNewCatIcon && (
            <IconPicker selected={newCatIcon} onSelect={(e) => { setNewCatIcon(e); setPickingNewCatIcon(false); }} />
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <select className="form-select" value={newCatType} onChange={(e) => setNewCatType(e.target.value)} style={{ flex: 1 }}>
              <option value="fija">Localização fixa</option>
              <option value="zonas_de_atencion">Zonas de atendimento</option>
            </select>
            <input className="form-input" type="text" placeholder="Botão (ex: Contatar)" value={newCatBtn}
              onChange={(e) => setNewCatBtn(e.target.value)} style={{ flex: 1 }} />
          </div>
          <button type="button" className="btn btn-primary" disabled={newCatSaving} onClick={addCategory}>
            {newCatSaving ? "Salvando..." : "✅ Criar categoria"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {categories.map((cat, catIdx) => (
          <div key={cat.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Category row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem" }}>
              <button type="button" title="Alterar ícone"
                onClick={() => setPickingFor(isPicking("cat", cat.id) ? null : { type: "cat", id: cat.id })}
                style={{ fontSize: "1.4rem", width: 44, height: 44, borderRadius: 10, flexShrink: 0, cursor: "pointer",
                  border: isPicking("cat", cat.id) ? "2px solid var(--blue-main)" : "1px solid var(--border)",
                  background: isPicking("cat", cat.id) ? "var(--blue-xlight)" : "#fff" }}>
                {cat.icon || "📌"}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: cat.is_active ? "#1e293b" : "#94a3b8" }}>{cat.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{cat.slug}</span>
                  {cat.home_section_id ? (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "var(--blue-xlight)", color: "var(--blue-main)", borderRadius: 4, padding: "0px 5px" }}>
                      #{cat.home_section_id}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, background: "#fef9c3", color: "#a16207", borderRadius: 4, padding: "0px 5px" }}>
                      sem seção
                    </span>
                  )}
                </div>
              </div>
              {/* Order buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button type="button" title="Mover para cima" disabled={catIdx === 0}
                  onClick={() => moveCat(catIdx, -1)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0px 6px", cursor: catIdx === 0 ? "default" : "pointer", fontSize: "0.65rem", color: catIdx === 0 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "16px" }}>
                  ↑
                </button>
                <button type="button" title="Mover para baixo" disabled={catIdx === categories.length - 1}
                  onClick={() => moveCat(catIdx, 1)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0px 6px", cursor: catIdx === categories.length - 1 ? "default" : "pointer", fontSize: "0.65rem", color: catIdx === categories.length - 1 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "16px" }}>
                  ↓
                </button>
              </div>
              <button type="button" onClick={() => toggleCat(cat.id, cat.is_active)} title={cat.is_active ? "Desativar" : "Ativar"}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.25rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", flexShrink: 0 }}>
                {cat.is_active ? "✅" : "⏸️"}
              </button>
              <button type="button" onClick={() => handleExpand(cat.id)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.75rem", color: "var(--text-muted)", flexShrink: 0 }}>
                {expanded === cat.id ? "▲" : "▼"}
              </button>
              <button type="button" onClick={() => deleteCat(cat.id)}
                style={{ background: "#fef2f2", border: "none", borderRadius: 8, padding: "0.25rem 0.5rem", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem", flexShrink: 0 }}>
                🗑️
              </button>
            </div>

            {isPicking("cat", cat.id) && (
              <div style={{ padding: "0 0.75rem 0.75rem" }}>
                <IconPicker selected={cat.icon || ""} onSelect={(icon) => saveCatIcon(cat.id, icon)} />
              </div>
            )}

            {expanded === cat.id && (
              <div style={{ borderTop: "1px solid var(--border)", background: "#f8fafc" }}>
                {/* Edit category form — inside expanded panel */}
                {editingCat != null && editingCat.id === cat.id ? (
                  <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6, background: "#eff6ff" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--blue-main)", marginBottom: 2 }}>✏️ Editar categoria</div>
                    <input className="form-input" type="text" placeholder="Nome *" value={editingCat.name}
                      onChange={(e) => { const n = e.target.value; setEditingCat((p) => p ? { ...p, name: n, slug: toSlug(n) } : p); }} />
                    <input className="form-input" type="text" placeholder="Descrição (aparece na home)" value={editingCat.description}
                      onChange={(e) => setEditingCat((p) => p ? { ...p, description: e.target.value } : p)} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <select className="form-select" value={editingCat.type} onChange={(e) => setEditingCat((p) => p ? { ...p, type: e.target.value } : p)} style={{ flex: 1 }}>
                        <option value="fija">Localização fixa</option>
                        <option value="zonas_de_atencion">Zonas de atendimento</option>
                      </select>
                      <input className="form-input" type="text" placeholder="Botão" value={editingCat.btn} onChange={(e) => setEditingCat((p) => p ? { ...p, btn: e.target.value } : p)} style={{ flex: 1 }} />
                    </div>
                    <select className="form-select" value={editingCat.sectionId ?? ""} onChange={(e) => setEditingCat((p) => p ? { ...p, sectionId: e.target.value ? Number(e.target.value) : null } : p)}>
                      <option value="">— Sem seção (não aparece no home) —</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>#{s.id} · {s.title}</option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" className="btn btn-primary" disabled={editingCatSaving} onClick={saveEditCat} style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem" }}>
                        {editingCatSaving ? "..." : "💾 Salvar"}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditingCat(null)} style={{ fontSize: "0.8rem", padding: "0.35rem 0.6rem", border: "1px solid var(--border)" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => setEditingCat({ id: cat.id, name: cat.name, slug: cat.slug, type: cat.location_type ?? "fija", btn: cat.contact_button_text ?? "Contatar", description: cat.description ?? "", sectionId: cat.home_section_id ?? null })}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", fontSize: "0.78rem", color: "var(--blue-main)", fontWeight: 600, textAlign: "left" }}>
                    ✏️ Editar categoria
                  </button>
                )}

                {loadingSubcats[cat.id] ? (
                  <div style={{ textAlign: "center", padding: "0.75rem" }}><div className="spinner" /></div>
                ) : (
                  <>
                    {(subcats[cat.id] ?? []).map((sub, subIdx) => (
                      <div key={sub.id}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.625rem 0.75rem", borderBottom: "1px solid var(--border)" }}>
                          <button type="button" title="Alterar ícone"
                            onClick={() => setPickingFor(isPicking("subcat", sub.id) ? null : { type: "subcat", id: sub.id, catId: cat.id })}
                            style={{ fontSize: "1.2rem", width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                              border: isPicking("subcat", sub.id) ? "2px solid var(--blue-main)" : "1px solid var(--border)",
                              background: isPicking("subcat", sub.id) ? "var(--blue-xlight)" : "#fff" }}>
                            •
                          </button>
                          <button type="button"
                            onClick={() => setEditingSub(editingSub != null && editingSub.id === sub.id ? null : { id: sub.id, catId: cat.id, name: sub.name })}
                            style={{ flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.8rem", color: sub.is_active ? "var(--blue-main)" : "#94a3b8", textDecoration: editingSub != null && editingSub.id === sub.id ? "underline" : "none" }}>
                              {sub.name} ✏️
                            </div>
                          </button>
                          {/* Subcat order buttons */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                            <button type="button" title="Mover para cima" disabled={subIdx === 0}
                              onClick={() => moveSubcat(cat.id, subIdx, -1)}
                              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "0px 5px", cursor: subIdx === 0 ? "default" : "pointer", fontSize: "0.6rem", color: subIdx === 0 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "15px" }}>
                              ↑
                            </button>
                            <button type="button" title="Mover para baixo" disabled={subIdx === (subcats[cat.id] ?? []).length - 1}
                              onClick={() => moveSubcat(cat.id, subIdx, 1)}
                              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "0px 5px", cursor: subIdx === (subcats[cat.id] ?? []).length - 1 ? "default" : "pointer", fontSize: "0.6rem", color: subIdx === (subcats[cat.id] ?? []).length - 1 ? "#cbd5e1" : "var(--blue-main)", lineHeight: "15px" }}>
                              ↓
                            </button>
                          </div>
                          <button type="button" onClick={() => toggleSubcat(sub.id, cat.id, sub.is_active)}
                            style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.2rem 0.45rem", cursor: "pointer", fontSize: "0.72rem", flexShrink: 0 }}>
                            {sub.is_active ? "✅" : "⏸️"}
                          </button>
                          <button type="button" onClick={() => deleteSubcat(sub.id, cat.id)}
                            style={{ background: "#fef2f2", border: "none", borderRadius: 8, padding: "0.2rem 0.45rem", cursor: "pointer", color: "#dc2626", fontSize: "0.72rem", flexShrink: 0 }}>
                            🗑️
                          </button>
                        </div>
                        {isPicking("subcat", sub.id) && (
                          <div style={{ padding: "0.5rem 0.75rem", background: "#f1f5f9", borderBottom: "1px solid var(--border)" }}>
                            <IconPicker selected={sub.icon || ""} onSelect={(icon) => saveSubcatIcon(sub.id, cat.id, icon)} />
                          </div>
                        )}
                        {editingSub != null && editingSub.id === sub.id && (
                          <div style={{ padding: "0.5rem 0.75rem", background: "#eff6ff", borderBottom: "1px solid var(--border)", display: "flex", gap: 6 }}>
                            <input className="form-input" type="text" placeholder="Nome *" value={editingSub.name}
                              onChange={(e) => setEditingSub((p) => p ? { ...p, name: e.target.value } : p)}
                              style={{ flex: 1, fontSize: "0.8rem" }} />
                            <button type="button" className="btn btn-primary" disabled={editingSubSaving} onClick={saveEditSub} style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                              {editingSubSaving ? "..." : "💾"}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setEditingSub(null)} style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem", border: "1px solid var(--border)" }}>
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add subcategory */}
                    {addingSubFor === cat.id ? (
                      <div style={{ padding: "0.625rem 0.75rem", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button type="button" onClick={() => setPickingNewSubIcon((v) => !v)}
                            style={{ fontSize: "1.1rem", width: 36, height: 36, borderRadius: 8, flexShrink: 0, cursor: "pointer", border: "1px solid var(--border)", background: "#fff" }}>
                            {newSubIcon || "•"}
                          </button>
                          <input className="form-input" type="text" placeholder="Nome da subcategoria *" value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        {pickingNewSubIcon && (
                          <IconPicker selected={newSubIcon} onSelect={(e) => { setNewSubIcon(e); setPickingNewSubIcon(false); }} />
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" className="btn btn-primary" disabled={newSubSaving} onClick={() => addSubcat(cat.id)} style={{ flex: 1, fontSize: "0.8rem", padding: "0.35rem" }}>
                            {newSubSaving ? "..." : "Criar"}
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => { setAddingSubFor(null); setNewSubName(""); setNewSubIcon(""); }} style={{ fontSize: "0.8rem", padding: "0.35rem 0.6rem", border: "1px solid var(--border)" }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setAddingSubFor(cat.id); setNewSubName(""); setNewSubIcon(""); setPickingNewSubIcon(false); }}
                        style={{ width: "100%", padding: "0.6rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "var(--blue-main)", fontWeight: 600 }}>
                        + Nova subcategoria
                      </button>
                    )}
                  </>
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

  // Bottom nav custom shortcut
  const [navIcon, setNavIcon] = useState("🍽️");
  const [navLabel, setNavLabel] = useState("Comida");
  const [navSlug, setNavSlug] = useState("gastronomia");
  const [navSaving, setNavSaving] = useState(false);
  const [navMsg, setNavMsg] = useState("");
  const [showNavIconPicker, setShowNavIconPicker] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("admin_settings").select("value").eq("key", "admin_whatsapp").single(),
      supabase.from("admin_settings").select("value").eq("key", "nav_custom_1").single(),
      supabase.from("categories").select("slug,name").eq("is_active", true).order("sort_order"),
    ]).then(([waRes, navRes, catRes]) => {
      if (waRes.data?.value?.value) setWhatsapp(String(waRes.data.value.value));
      if (navRes.data?.value) {
        const v = navRes.data.value as { icon?: string; label?: string; category_slug?: string };
        if (v.icon) setNavIcon(v.icon);
        if (v.label) setNavLabel(v.label);
        if (v.category_slug) setNavSlug(v.category_slug);
      }
      setCategories(catRes.data ?? []);
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

  const saveNav = async () => {
    if (!navLabel.trim() || !navSlug.trim()) { setNavMsg("Preencha o rótulo e a categoria."); return; }
    setNavSaving(true);
    setNavMsg("");
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "nav_custom_1", value: { icon: navIcon, label: navLabel.trim(), category_slug: navSlug.trim() } }, { onConflict: "key" });
    setNavMsg(error ? "Erro: " + error.message : "Atalho salvo com sucesso.");
    setNavSaving(false);
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>Configurações</h2>

      {/* WhatsApp de contato */}
      <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>📱 WhatsApp de contato</div>
        <div className="form-group">
          <label className="form-label">Número (sugestões e reclamações)</label>
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

      {/* Bottom nav custom shortcut */}
      <div className="card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>🔗 Atalho da barra inferior</div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
          O quarto botão da barra de navegação inferior. Aparece como: {navIcon} {navLabel}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <button
            type="button"
            onClick={() => setShowNavIconPicker((v) => !v)}
            title="Escolher ícone"
            style={{
              fontSize: "1.5rem", width: 48, height: 48, borderRadius: 10, flexShrink: 0,
              cursor: "pointer", border: showNavIconPicker ? "2px solid var(--blue-main)" : "1px solid var(--border)",
              background: showNavIconPicker ? "var(--blue-xlight)" : "#fff",
            }}
          >
            {navIcon}
          </button>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              className="form-input"
              type="text"
              placeholder="Rótulo (ex: Comida)"
              value={navLabel}
              onChange={(e) => setNavLabel(e.target.value)}
              maxLength={20}
            />
            <select
              className="form-select"
              value={navSlug}
              onChange={(e) => setNavSlug(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name} ({c.slug})</option>
              ))}
              {categories.length === 0 && <option value={navSlug}>{navSlug}</option>}
            </select>
          </div>
        </div>
        {showNavIconPicker && (
          <IconPicker selected={navIcon} onSelect={(e) => { setNavIcon(e); setShowNavIconPicker(false); }} />
        )}
        {navMsg && (
          <p style={{ fontSize: "0.8rem", color: navMsg.startsWith("Erro") ? "#dc2626" : "#059669", fontWeight: 600 }}>
            {navMsg}
          </p>
        )}
        <button type="button" className="btn btn-primary" disabled={navSaving} onClick={saveNav}>
          {navSaving ? "Salvando..." : "💾 Salvar atalho"}
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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token ?? "";
    const res = await fetch("/api/admin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: deleteConfirm.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setDeleteError(json.error ?? "Erro ao deletar usuário.");
      setDeleting(false);
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const filtered = search
    ? users.filter((u) => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.whatsapp?.includes(search))
    : users;

  if (loading) return <div style={{ textAlign: "center", paddingTop: "2rem" }}><div className="spinner" /></div>;

  return (
    <div>
      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
          <div className="card" style={{ padding: "1.5rem", maxWidth: 340, width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ fontSize: "2rem", textAlign: "center" }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", textAlign: "center" }}>
              Deletar usuário?
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
              Esta ação é <strong style={{ color: "#dc2626" }}>irreversível</strong>. O usuário{" "}
              <strong style={{ color: "#1e293b" }}>{deleteConfirm.name}</strong> e todos os seus anúncios,
              fotos e registros serão permanentemente excluídos.
            </p>
            {deleteError && (
              <p style={{ fontSize: "0.8rem", color: "#dc2626", fontWeight: 600, margin: 0, textAlign: "center" }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setDeleteConfirm(null); setDeleteError(""); }}
                disabled={deleting}
                className="btn btn-outline"
                style={{ flex: 1, padding: "0.6rem", fontSize: "0.875rem" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn"
                style={{ flex: 1, padding: "0.6rem", fontSize: "0.875rem", background: "#dc2626", color: "#fff", border: "none", fontWeight: 700 }}
              >
                {deleting ? "Deletando..." : "Sim, deletar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button
                type="button"
                disabled={busy === u.id}
                onClick={() => { setDeleteError(""); setDeleteConfirm({ id: u.id, name: u.full_name ?? "este usuário" }); }}
                className="btn"
                style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", marginLeft: "auto" }}
              >
                🗑️ Deletar
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted text-center" style={{ paddingTop: "1rem" }}>Nenhum usuário encontrado.</p>}
      </div>
    </div>
  );
}
