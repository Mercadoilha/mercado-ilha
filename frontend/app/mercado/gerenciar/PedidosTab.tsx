"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { formatBRL, formatQty } from "../../../lib/mercadoCart";

type Item = {
  id: number;
  product_name: string;
  variant_label: string;
  quantity: number;
  line_total: number;
  added_at_pickup: boolean;
};

type Order = {
  id: number;
  created_at: string;
  total: number;
  status: string;
  customer_name: string;
  customer_whatsapp: string | null;
  market_order_items: Item[];
};

type Filtro = "todos" | "pendentes" | "entregues";

// Os pedidos que entraram pelo app, do mais novo para o mais velho, com o
// contato de quem pediu.
//
// Um pedido feito ainda não é dinheiro: só entra no caixa quando é marcado como
// ENTREGUE (fase-39). Por isso os totais de cima contam o entregue, e o que está
// esperando retirada aparece à parte.
export default function PedidosTab({ vendorId }: { vendorId: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("market_orders")
      .select("id,created_at,total,status,customer_name,customer_whatsapp,market_order_items(id,product_name,variant_label,quantity,line_total,added_at_pickup)")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) { setError("Não foi possível carregar os pedidos."); setOrders([]); return; }
        setOrders((data ?? []) as unknown as Order[]);
      });
    return () => { alive = false; };
  }, [vendorId]);

  const resumo = useMemo(() => {
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
    const month = today.slice(0, 7);
    const r = { diaTotal: 0, diaCount: 0, diaPend: 0, mesTotal: 0, mesCount: 0, mesPend: 0, pendentes: 0, entregues: 0 };
    for (const o of orders ?? []) {
      const d = new Date(o.created_at).toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
      const entregue = o.status === "entregue";
      if (entregue) r.entregues++; else r.pendentes++;
      if (d === today) {
        if (entregue) { r.diaTotal += Number(o.total); r.diaCount++; } else { r.diaPend += Number(o.total); }
      }
      if (d.startsWith(month)) {
        if (entregue) { r.mesTotal += Number(o.total); r.mesCount++; } else { r.mesPend += Number(o.total); }
      }
    }
    return r;
  }, [orders]);

  const visiveis = useMemo(() => {
    const list = orders ?? [];
    if (filtro === "pendentes") return list.filter((o) => o.status !== "entregue");
    if (filtro === "entregues") return list.filter((o) => o.status === "entregue");
    return list;
  }, [orders, filtro]);

  const marcar = async (order: Order, entregue: boolean) => {
    setBusy(order.id); setError(null);
    const { error: err } = await supabase.rpc("set_market_order_delivered", {
      p_order_id: order.id,
      p_delivered: entregue,
    });
    setBusy(null);
    if (err) { setError(err.message); return; }
    setOrders((prev) => (prev ?? []).map((o) => (o.id === order.id ? { ...o, status: entregue ? "entregue" : "novo" } : o)));
  };

  const excluir = async (order: Order) => {
    setBusy(order.id); setError(null);
    const { error: err } = await supabase.rpc("delete_market_order", { p_order_id: order.id });
    setBusy(null);
    if (err) { setError(err.message); return; }
    setConfirmDel(null);
    setOrders((prev) => (prev ?? []).filter((o) => o.id !== order.id));
  };

  if (orders === null) {
    return <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, padding: "0.8rem 1rem 0.6rem", background: "#F7FBF9" }}>
        <Card
          label="Entregue hoje"
          value={formatBRL(resumo.diaTotal)}
          sub={`${resumo.diaCount} ${resumo.diaCount === 1 ? "pedido" : "pedidos"}`}
          extra={resumo.diaPend > 0 ? `${formatBRL(resumo.diaPend)} a retirar` : null}
        />
        <Card
          label="Entregue no mês"
          value={formatBRL(resumo.mesTotal)}
          sub={`${resumo.mesCount} ${resumo.mesCount === 1 ? "pedido" : "pedidos"}`}
          extra={resumo.mesPend > 0 ? `${formatBRL(resumo.mesPend)} a retirar` : null}
        />
      </div>

      <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.45, padding: "0 1rem 0.7rem", background: "#F7FBF9", margin: 0 }}>
        Marque o pedido como <strong>entregue</strong> quando a pessoa retirar. Só o que foi
        entregue entra no caixa e no cálculo de lucro.
      </p>

      <div style={{ display: "flex", gap: 6, padding: "0.6rem 1rem", background: "#F7FBF9", borderBottom: "1px solid var(--border)" }}>
        <Chip label={`Todos (${orders.length})`} on={filtro === "todos"} onClick={() => setFiltro("todos")} />
        <Chip label={`Pendentes (${resumo.pendentes})`} on={filtro === "pendentes"} onClick={() => setFiltro("pendentes")} />
        <Chip label={`Entregues (${resumo.entregues})`} on={filtro === "entregues"} onClick={() => setFiltro("entregues")} />
      </div>

      {error && <p className="text-error" style={{ margin: "1rem", fontSize: "0.82rem" }}>{error}</p>}

      {visiveis.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🧾</div>
          <p style={{ fontWeight: 700, color: "#1e293b" }}>
            {orders.length === 0 ? "Nenhum pedido ainda" : "Nada nesta lista"}
          </p>
        </div>
      )}

      {visiveis.map((order) => {
        const items = order.market_order_items ?? [];
        const expanded = open === order.id;
        const entregue = order.status === "entregue";
        const when = new Date(order.created_at).toLocaleString("pt-BR", {
          timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        const wa = order.customer_whatsapp?.replace(/\D/g, "");
        return (
          <div key={order.id} style={{ background: "#fff", borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => { setOpen(expanded ? null : order.id); setConfirmDel(null); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", border: "none", background: "transparent", padding: "0.75rem 1rem", fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>{order.customer_name}</div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {when} · {items.length} {items.length === 1 ? "item" : "itens"}
                </div>
                <span
                  style={{
                    display: "inline-block", marginTop: 5, fontSize: "0.64rem", fontWeight: 800,
                    borderRadius: 4, padding: "2px 6px",
                    color: entregue ? "#065F46" : "#92400E",
                    background: entregue ? "#DCFCE7" : "#FEF3C7",
                  }}
                >
                  {entregue ? "✓ Entregue" : "Aguardando retirada"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: entregue ? "var(--green-dark)" : "#94A3B8" }}>
                  {formatBRL(Number(order.total))}
                </span>
                <span aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{expanded ? "▲" : "▼"}</span>
              </div>
            </button>

            {expanded && (
              <div style={{ padding: "0 1rem 0.9rem" }}>
                {items.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "0.8rem", color: "#475569", padding: "0.2rem 0" }}>
                    <span>
                      {formatQty(Number(item.quantity))} × {item.product_name}
                      {item.variant_label ? ` — ${item.variant_label}` : ""}
                      {item.added_at_pickup && (
                        <span style={{ marginLeft: 6, fontSize: "0.64rem", fontWeight: 800, color: "var(--green-dark)", background: "#DCFCE7", borderRadius: 4, padding: "1px 5px" }}>
                          na retirada
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatBRL(Number(item.line_total))}</span>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => void marcar(order, !entregue)}
                  disabled={busy === order.id}
                  className="btn btn-block"
                  style={{
                    marginTop: 10, fontSize: "0.85rem", fontWeight: 800,
                    background: entregue ? "#fff" : "var(--green-dark)",
                    color: entregue ? "#475569" : "#fff",
                    border: entregue ? "1.5px solid var(--border)" : "none",
                  }}
                >
                  {busy === order.id ? "Salvando…" : entregue ? "Voltar para pendente" : "Marcar como entregue"}
                </button>

                {wa && (
                  <a
                    href={`https://wa.me/${wa.startsWith("55") || order.customer_whatsapp?.startsWith("+") ? wa : `55${wa}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-block"
                    style={{ marginTop: 8, background: "#25D366", color: "#fff", fontSize: "0.82rem", fontWeight: 800 }}
                  >
                    Falar com {order.customer_name.split(" ")[0]} no WhatsApp
                  </a>
                )}

                {confirmDel === order.id ? (
                  <div style={{ marginTop: 10, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "0.7rem 0.8rem" }}>
                    <p style={{ fontSize: "0.78rem", color: "#991B1B", lineHeight: 1.4, margin: "0 0 8px" }}>
                      Excluir este pedido para sempre? Ele sai da lista e das contas, e não dá para voltar atrás.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void excluir(order)}
                        disabled={busy === order.id}
                        className="btn"
                        style={{ flex: 1, background: "#DC2626", color: "#fff", fontSize: "0.8rem", fontWeight: 800 }}
                      >
                        {busy === order.id ? "Excluindo…" : "Sim, excluir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDel(null)}
                        className="btn btn-ghost"
                        style={{ flex: 1, fontSize: "0.8rem" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDel(order.id)}
                    className="btn btn-ghost btn-block"
                    style={{ marginTop: 6, fontSize: "0.78rem", color: "#B91C1C" }}
                  >
                    Excluir pedido
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: on ? "1.5px solid var(--green-dark)" : "1.5px solid var(--border)",
        background: on ? "var(--green-dark)" : "#fff",
        color: on ? "#fff" : "#475569",
        borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.72rem", fontWeight: 700,
        fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function Card({ label, value, sub, extra }: { label: string; value: string; sub: string; extra?: string | null }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #E3F1EA", borderRadius: 12, padding: "0.6rem 0.7rem" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--green-dark)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sub}</div>
      {extra && <div style={{ fontSize: "0.68rem", color: "#B45309", fontWeight: 700, marginTop: 2 }}>{extra}</div>}
    </div>
  );
}
