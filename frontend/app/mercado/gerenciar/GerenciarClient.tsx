"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import BackButton from "../../../components/BackButton";
import { useSession } from "../../../contexts/SessionContext";
import { supabase } from "../../../lib/supabaseClient";
import { refreshMercadoPage } from "../../../lib/mercadoApi";
import { VENDOR_SLUG, type AdminCatalog } from "./types";
import CatalogoTab from "./CatalogoTab";

// As abas que não são o catálogo só se montam quando alguém entra nelas.
const PedidosTab = dynamic(() => import("./PedidosTab"), { ssr: false });
const AjustesTab = dynamic(() => import("./AjustesTab"), { ssr: false });
const CaixaTab = dynamic(() => import("./CaixaTab"), { ssr: false });
const EquipeTab = dynamic(() => import("./EquipeTab"), { ssr: false });

type Tab = "catalogo" | "pedidos" | "caixa" | "ajustes" | "equipe";

export default function GerenciarClient() {
  const { session, sessionLoading } = useSession();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("catalogo");

  // A própria função decide se a pessoa pode ver: quem não administra a feira
  // recebe vazio. Não há uma checagem no navegador que se possa burlar.
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_market_catalog_admin", { p_vendor_slug: VENDOR_SLUG });
    setLoading(false);
    if (error || !data) { setDenied(true); setCatalog(null); return; }
    setDenied(false);
    setCatalog(data as AdminCatalog);
  }, []);

  // Depois de SALVAR (preço, WhatsApp, dados da feira), além de recarregar o painel
  // avisa o servidor para regenerar a tela do mercado. Sem isso, a mudança só
  // aparecia no próximo refresco automático, até um minuto depois.
  const saveAndReload = useCallback(async () => {
    await load();
    void refreshMercadoPage();
  }, [load]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) { setLoading(false); return; }
    void load();
  }, [session, sessionLoading, load]);

  const tabBtn = (key: Tab, label: string, icon: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        flex: 1, border: "none", background: "transparent", padding: "0.6rem 0.2rem",
        borderBottom: tab === key ? "2.5px solid var(--green-dark)" : "2.5px solid transparent",
        color: tab === key ? "var(--green-dark)" : "var(--text-muted)",
        fontWeight: tab === key ? 800 : 600, fontSize: "0.75rem", fontFamily: "inherit", cursor: "pointer",
      }}
    >
      <div style={{ fontSize: "1.05rem" }}>{icon}</div>
      {label}
    </button>
  );

  return (
    <div className="page-body">
      <div className="page-header">
        <BackButton fallbackHref="/mercado" />
        <h1>Painel do administrador</h1>
      </div>

      {(loading || sessionLoading) && (
        <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>
      )}

      {!loading && !sessionLoading && !session && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
          <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>Entre na sua conta</p>
          <Link href="/signin?next=/mercado/gerenciar" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Entrar
          </Link>
        </div>
      )}

      {!loading && session && denied && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
          <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>Esta área é da equipe da feira</p>
          <p style={{ fontSize: "0.85rem" }}>Se você faz parte dela, peça para alguém da equipe te adicionar.</p>
        </div>
      )}

      {catalog && (
        <>
          <div style={{ background: "var(--green-dark)", color: "#fff", padding: "0.7rem 1rem" }}>
            <div style={{ fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", fontSize: "1.05rem", fontWeight: 700 }}>
              {catalog.vendor.name}
            </div>
            <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>
              {catalog.vendor.is_active ? "Mercado aberto no app" : "⏸️ Mercado pausado — não aparece no Início"}
            </div>
          </div>

          <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
            {tabBtn("catalogo", "Catálogo", "🧺")}
            {tabBtn("pedidos", "Pedidos", "🧾")}
            {tabBtn("caixa", "Caixa", "💰")}
            {tabBtn("ajustes", "Ajustes", "⚙️")}
            {tabBtn("equipe", "Equipe", "👥")}
          </div>

          {tab === "catalogo" && <CatalogoTab catalog={catalog} onReload={saveAndReload} />}
          {tab === "pedidos" && <PedidosTab vendorId={catalog.vendor.id} />}
          {tab === "caixa" && <CaixaTab vendorId={catalog.vendor.id} onGoToCatalogo={() => setTab("catalogo")} />}
          {tab === "ajustes" && <AjustesTab vendor={catalog.vendor} onReload={saveAndReload} />}
          {tab === "equipe" && <EquipeTab vendorId={catalog.vendor.id} />}
        </>
      )}
    </div>
  );
}
