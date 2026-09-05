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
  customer_name: string;
  customer_whatsapp: string | null;
  market_order_items: Item[];
};

// Os pedidos que entraram pelo app, do mais novo para o mais velho, com o
// contato de quem pediu. O resumo de cima já dá a leitura do dia e do mês.
export default function PedidosTab({ vendorId }: { vendorId: number }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("market_orders")
      .select("id,created_at,total,customer_name,customer_whatsapp,market_order_items(id,product_name,variant_label,quantity,line_total,added_at_pickup)")
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
    let diaTotal = 0, diaCount = 0, mesTotal = 0, mesCount = 0;
    for (const o of orders ?? []) {
      const d = new Date(o.created_at).toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
      if (d === today) { diaTotal += Number(o.total); diaCount++; }
      if (d.startsWith(month)) { mesTotal += Number(o.total); mesCount++; }
    }
    return { diaTotal, diaCount, mesTotal, mesCount };
  }, [orders]);

  if (orders === null) {
    return <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, padding: "0.8rem 1rem", background: "#F7FBF9", borderBottom: "1px solid var(--border)" }}>
        <Card label="Hoje" value={formatBRL(resumo.diaTotal)} sub={`${resumo.diaCount} ${resumo.diaCount === 1 ? "pedido" : "pedidos"}`} />
        <Card label="Este mês" value={formatBRL(resumo.mesTotal)} sub={`${resumo.mesCount} ${resumo.mesCount === 1 ? "pedido" : "pedidos"}`} />
      </div>

      {error && <p className="text-error" style={{ margin: "1rem", fontSize: "0.82rem" }}>{error}</p>}

      {orders.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🧾</div>
          <p style={{ fontWeight: 700, color: "#1e293b" }}>Nenhum pedido ainda</p>
        </div>
      )}

      {orders.map((order) => {
        const items = order.market_order_items ?? [];
        const expanded = open === order.id;
        const when = new Date(order.created_at).toLocaleString("pt-BR", {
          timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        const wa = order.customer_whatsapp?.replace(/\D/g, "");
        return (
          <div key={order.id} style={{ background: "#fff", borderBottom: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : order.id)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%", border: "none", background: "transparent", padding: "0.75rem 1rem", fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>{order.customer_name}</div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {when} · {items.length} {items.length === 1 ? "item" : "itens"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--green-dark)" }}>{formatBRL(Number(order.total))}</span>
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

                {wa && (
                  <a
                    href={`https://wa.me/${wa.startsWith("55") || order.customer_whatsapp?.startsWith("+") ? wa : `55${wa}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-block"
                    style={{ marginTop: 10, background: "#25D366", color: "#fff", fontSize: "0.82rem", fontWeight: 800 }}
                  >
                    Falar com {order.customer_name.split(" ")[0]} no WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #E3F1EA", borderRadius: 12, padding: "0.6rem 0.7rem" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--green-dark)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}
