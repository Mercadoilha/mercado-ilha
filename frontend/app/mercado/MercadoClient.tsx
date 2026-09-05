"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import QtyStepper from "./QtyStepper";
import { useSession } from "../../contexts/SessionContext";
import { supabase } from "../../lib/supabaseClient";
import { getCachedProfile } from "../../lib/profileCache";
import {
  cartCount, cartTotal, indexVariants,
  type Catalog, type Product, type Variant,
} from "../../lib/mercadoApi";
import { formatBRL, formatQty, readCart, writeCart, type CartMap } from "../../lib/mercadoCart";

// A folha do pedido só se monta quando o cliente abre — não pesa na entrada da tela.
const PedidoSheet = dynamic(() => import("./PedidoSheet"), { ssr: false });

// Marca deixada antes de ir ao login: ao voltar, a folha do pedido reabre sozinha
// no ponto exato onde a pessoa estava.
const PENDING_KEY = "mercado_pedido_pendente";

export default function MercadoClient({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const { session } = useSession();
  const vendor = catalog?.vendor ?? null;
  const sections = catalog?.sections ?? [];

  const index = useMemo(() => indexVariants(sections), [sections]);
  const [cart, setCart] = useState<CartMap>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; whatsapp: string | null }>({ name: "", whatsapp: null });
  const headerRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  // O cabeçalho azul já é sticky no topo. Medimos a altura real dele (e a da barra de
  // atalhos) em vez de chutar um número: assim os atalhos param exatamente embaixo do
  // cabeçalho, e o pulo para uma seção não deixa o título escondido atrás dos dois.
  const [offsets, setOffsets] = useState({ header: 49, chips: 49 });

  useEffect(() => {
    const measure = () => setOffsets({
      header: headerRef.current?.offsetHeight ?? 49,
      chips: chipsRef.current?.offsetHeight ?? 49,
    });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [catalog]);

  // Carrinho guardado no telefone: recarregar a página, sair e voltar, ou passar
  // pelo login não apaga nada.
  useEffect(() => {
    if (!vendor) return;
    setCart(readCart(vendor.id));
    try {
      if (sessionStorage.getItem(PENDING_KEY)) {
        sessionStorage.removeItem(PENDING_KEY);
        setSheetOpen(true);
      }
    } catch { /* sessionStorage indisponível */ }
  }, [vendor]);

  // Nome e WhatsApp de quem pede saem do perfil (já está logado na hora de enviar),
  // então ninguém precisa digitar nada. Fora do caminho crítico: quase sempre já
  // veio no aquecimento do perfil ao abrir o app.
  useEffect(() => {
    if (!session) { setCustomer({ name: "", whatsapp: null }); return; }
    const cached = getCachedProfile(session.user.id)?.profile as any;
    if (cached?.full_name) {
      setCustomer({ name: String(cached.full_name), whatsapp: cached.whatsapp ? String(cached.whatsapp) : null });
      return;
    }
    let alive = true;
    supabase.from("profiles").select("full_name,whatsapp").eq("id", session.user.id).single()
      .then(({ data }) => {
        if (alive && data) setCustomer({ name: data.full_name ?? "", whatsapp: data.whatsapp ?? null });
      }, () => {});
    return () => { alive = false; };
  }, [session]);

  const setQty = useCallback((variantId: number, qty: number) => {
    if (!vendor) return;
    setCart((prev) => {
      const next = { ...prev };
      if (qty > 0) next[variantId] = qty; else delete next[variantId];
      writeCart(vendor.id, next);
      return next;
    });
    setSent(false);
  }, [vendor]);

  const clear = useCallback(() => {
    if (!vendor) return;
    setCart({});
    writeCart(vendor.id, {});
    setSent(false);
    setSheetOpen(false);
  }, [vendor]);

  // Sem sessão: guarda a marca e manda para a tela de sempre de Entrar/Cadastrar,
  // que depois devolve o cliente aqui com o pedido intacto.
  const goToLogin = useCallback(() => {
    try { sessionStorage.setItem(PENDING_KEY, "1"); } catch { /* ignorar */ }
    router.push("/signin?msg=pedido&next=/mercado");
  }, [router]);

  const total = useMemo(() => cartTotal(cart, index), [cart, index]);
  const count = useMemo(() => cartCount(cart), [cart]);

  if (!vendor) {
    return (
      <div className="page-body">
        <div className="page-header">
          <BackButton fallbackHref="/" />
          <h1>Mercado Agroecológico</h1>
        </div>
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌿</div>
          <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Mercado indisponível no momento</p>
          <p style={{ fontSize: "0.875rem" }}>Volte em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-body" style={{ paddingBottom: count > 0 ? 76 : 0 }}>
      <div className="page-header" ref={headerRef}>
        <BackButton fallbackHref="/" />
        <h1>Mercado Agroecológico</h1>
      </div>

      {/* Cabeçalho verde: identidade do mercado + as três coisas que o cliente
          precisa saber antes de pedir (quando é, onde retira, até quando pede). */}
      <div style={{ background: "linear-gradient(135deg, #0F6E56 0%, #14805F 55%, #18946D 100%)", color: "#fff", padding: "1.1rem 1rem 1.2rem" }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.18em", color: "var(--green-sea)", textTransform: "uppercase" }}>
          Mercado
        </div>
        <div style={{ fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif", fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.15 }}>
          {vendor.name}
        </div>
        {vendor.tagline && (
          <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 1.35 }}>{vendor.tagline}</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: "0.78rem" }}>
          {vendor.delivery_day && <div>📅 {vendor.delivery_day}</div>}
          {vendor.pickup_place && <div>📍 Retirada: {vendor.pickup_place}</div>}
          {vendor.deadline_text && (
            <div style={{ background: "rgba(255,255,255,0.16)", borderRadius: 8, padding: "6px 10px", marginTop: 4, fontWeight: 700 }}>
              ⏰ {vendor.deadline_text}
            </div>
          )}
        </div>
      </div>

      {/* Histórico do próprio cliente: o que ele já pediu e quanto gastou por mês. */}
      <Link
        href="/mercado/meus-pedidos"
        prefetch={false}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#fff", borderBottom: "1px solid var(--border)", padding: "0.7rem 1rem",
          fontSize: "0.85rem", fontWeight: 700, color: "var(--green-dark)", textDecoration: "none",
        }}
      >
        <span>🧾 Meus pedidos</span>
        <span aria-hidden="true">→</span>
      </Link>

      {/* Atalhos para as seções: a lista é longa, e daqui se pula direto. */}
      <div
        ref={chipsRef}
        style={{
          position: "sticky", top: offsets.header, zIndex: 9, background: "#fff", borderBottom: "1px solid var(--border)",
          display: "flex", gap: 8, padding: "0.6rem 1rem", overflowX: "auto", WebkitOverflowScrolling: "touch",
        }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`sec-${s.slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{
              flexShrink: 0, border: "1.5px solid var(--green-sea)", background: "#F2FBF7", color: "var(--green-dark)",
              borderRadius: 999, padding: "0.35rem 0.75rem", fontSize: "0.78rem", fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {s.emoji ? `${s.emoji} ` : ""}{s.name}
          </button>
        ))}
      </div>

      {sections.map((section) => (
        <section key={section.id} id={`sec-${section.slug}`} style={{ scrollMarginTop: offsets.header + offsets.chips }}>
          <h2
            style={{
              background: "var(--green-dark)", color: "#fff", fontSize: "0.82rem", fontWeight: 800,
              letterSpacing: "0.04em", textTransform: "uppercase", padding: "0.55rem 1rem", margin: 0,
            }}
          >
            {section.emoji ? `${section.emoji} ` : ""}{section.name}
          </h2>
          <div style={{ background: "#fff" }}>
            {(section.products ?? []).map((product) => (
              <ProductRow key={product.id} product={product} cart={cart} onChange={setQty} />
            ))}
          </div>
        </section>
      ))}

      {/* Acesso da equipe da feira. Quem não é da equipe vê um aviso ao entrar —
          não há consulta nenhuma aqui, então isto não custa nada à tela. */}
      {session && (
        <div style={{ padding: "0.9rem 1rem 0", textAlign: "center" }}>
          <Link href="/mercado/gerenciar" prefetch={false} style={{ fontSize: "0.74rem", color: "var(--text-muted)", textDecoration: "none" }}>
            🔒 Área da feira
          </Link>
        </div>
      )}

      {vendor.footer_note && (
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.45, padding: "1rem 1rem 1.5rem", background: "#F7FBF9" }}>
          {vendor.footer_note}
        </p>
      )}

      {/* Barra do pedido: fica acima da barra de navegação, sempre à vista. */}
      {count > 0 && (
        <div
          style={{
            position: "fixed", bottom: "var(--nav-height)", left: 0, right: 0, zIndex: 90,
            maxWidth: "var(--max-width)", margin: "0 auto", background: "var(--green-dark)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "0.7rem 1rem", boxShadow: "0 -6px 20px rgba(8,40,30,0.22)",
          }}
        >
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>{count} {count === 1 ? "item" : "itens"}</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>{formatBRL(total)}</div>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              background: "#fff", color: "var(--green-dark)", border: "none", borderRadius: 10,
              padding: "0.6rem 1.1rem", fontSize: "0.9rem", fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            Ver pedido →
          </button>
        </div>
      )}

      {sheetOpen && (
        <PedidoSheet
          vendor={vendor}
          cart={cart}
          index={index}
          total={total}
          sent={sent}
          hasSession={!!session}
          customer={customer}
          onQty={setQty}
          onClear={clear}
          onSent={() => setSent(true)}
          onLogin={goToLogin}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Um produto e suas formas de venda
// ---------------------------------------------------------------
function ProductRow({
  product, cart, onChange,
}: {
  product: Product;
  cart: CartMap;
  onChange: (variantId: number, qty: number) => void;
}) {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  const single = variants.length === 1;

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "0.7rem 1rem" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.25 }}>
            {product.name}
            {product.is_alcoholic && (
              <span style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 800, color: "#92400e", background: "#fef3c7", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle" }}>
                +18
              </span>
            )}
          </div>
          {product.description && (
            <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 3, lineHeight: 1.35 }}>{product.description}</p>
          )}
          {product.is_seasonal && (
            <p style={{ fontSize: "0.7rem", color: "#b45309", marginTop: 3 }}>Sazonal — confirme a disponibilidade</p>
          )}
          {single && <VariantPrice variant={variants[0]} />}
        </div>
        {single && (
          variants[0].is_sold_out
            ? <SoldOut />
            : <QtyStepper variant={variants[0]} qty={cart[variants[0].id] ?? 0} onChange={onChange} />
        )}
      </div>

      {!single && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {variants.map((v) => (
            <div
              key={v.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                background: "#F7FBF9", border: "1px solid #E3F1EA", borderRadius: 10, padding: "0.45rem 0.6rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155" }}>{v.label}</div>
                <VariantPrice variant={v} compact />
              </div>
              {v.is_sold_out ? <SoldOut /> : <QtyStepper variant={v} qty={cart[v.id] ?? 0} onChange={onChange} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// O que acabou continua na lista, marcado — o cliente vê que existe e volta na
// semana seguinte, em vez de achar que a feira não vende aquilo.
function SoldOut() {
  return (
    <span
      style={{
        flexShrink: 0, fontSize: "0.7rem", fontWeight: 800, color: "#b91c1c",
        background: "#fee2e2", borderRadius: 8, padding: "0.3rem 0.5rem",
      }}
    >
      Esgotado
    </span>
  );
}

function VariantPrice({ variant, compact }: { variant: Variant; compact?: boolean }) {
  return (
    <div style={{ marginTop: compact ? 1 : 4, fontSize: compact ? "0.78rem" : "0.88rem", color: "var(--green-dark)", fontWeight: 800 }}>
      {formatBRL(variant.price)}
      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
        {" "}/ {variant.unit_label}
      </span>
      {variant.note && (
        <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 500, color: "var(--text-muted)" }}>{variant.note}</span>
      )}
    </div>
  );
}

