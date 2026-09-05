"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import BackButton from "../../../components/BackButton";
import { useSession } from "../../../contexts/SessionContext";
import { supabase } from "../../../lib/supabaseClient";
import { formatBRL, formatQty } from "../../../lib/mercadoCart";

// A folha de "adicionar" só se monta quando alguém abre — e é ela quem carrega o
// catálogo. Quem só vem olhar o histórico não paga nada por isso.
const AdicionarSheet = dynamic(() => import("./AdicionarSheet"), { ssr: false });

type Item = {
  id: number;
  product_name: string;
  variant_label: string;
  unit_label: string;
  quantity: number;
  line_total: number;
  // true = o cliente acrescentou na hora da retirada (não estava no pedido enviado)
  added_at_pickup: boolean;
};

type Order = {
  id: number;
  created_at: string;
  total: number;
  market_order_items: Item[];
};

// Agrupa por mês ("setembro de 2026") mantendo a ordem do mais novo para o mais
// velho, e soma o gasto de cada mês.
type MonthGroup = { key: string; label: string; total: number; orders: Order[] };

function groupByMonth(orders: Order[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const order of orders) {
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Bahia" });
    const g = groups.get(key) ?? { key, label, total: 0, orders: [] };
    g.total = Math.round((g.total + Number(order.total)) * 100) / 100;
    g.orders.push(order);
    groups.set(key, g);
  }
  return [...groups.values()];
}

export default function MeusPedidosClient() {
  const { session, sessionLoading } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  // As regras da base já limitam ao dono: ninguém enxerga pedido de outra pessoa.
  const load = useCallback(async () => {
    if (!session) { setOrders([]); return; }
    // Enquanto a fase-33 não estiver rodada na base, a coluna added_at_pickup ainda
    // não existe: nesse caso o histórico segue funcionando, só sem a marca de
    // "na retirada".
    const withMark = await supabase
      .from("market_orders")
      .select("id,created_at,total,market_order_items(id,product_name,variant_label,unit_label,quantity,line_total,added_at_pickup)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const res = withMark.error
      ? await supabase
          .from("market_orders")
          .select("id,created_at,total,market_order_items(id,product_name,variant_label,unit_label,quantity,line_total)")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(100)
      : withMark;

    if (res.error) { setError("Não foi possível carregar seus pedidos."); setOrders([]); return; }
    setError(null);
    setOrders((res.data ?? []) as unknown as Order[]);
  }, [session]);

  useEffect(() => {
    if (sessionLoading) return;
    void load();
  }, [load, sessionLoading]);

  // Tirar algo que foi acrescentado por engano. O pedido enviado à feira não se
  // toca: só sai o que o próprio cliente somou depois.
  const removePickupItem = async (itemId: number) => {
    const { error: err } = await supabase.rpc("remove_pickup_item", { p_item_id: itemId });
    if (err) { setError("Não foi possível remover o item."); return; }
    await load();
  };

  const groups = useMemo(() => groupByMonth(orders ?? []), [orders]);

  return (
    <div className="page-body">
      <div className="page-header">
        <BackButton fallbackHref="/mercado" />
        <h1>Meus pedidos</h1>
      </div>

      {!sessionLoading && !session && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🧾</div>
          <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>Entre para ver seus pedidos</p>
          <Link href="/signin?next=/mercado/meus-pedidos" className="btn btn-primary btn-block" style={{ maxWidth: 260, margin: "0 auto" }}>
            Entrar / Cadastrar
          </Link>
        </div>
      )}

      {session && orders === null && (
        <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>
      )}

      {error && <p className="text-error" style={{ margin: "1rem" }}>{error}</p>}

      {session && orders !== null && orders.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌿</div>
          <p style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Você ainda não fez pedidos</p>
          <p style={{ fontSize: "0.875rem", marginBottom: 14 }}>Seus pedidos do Mercado Agroecológico aparecem aqui.</p>
          <Link href="/mercado" className="btn btn-primary" style={{ textDecoration: "none" }}>Ir ao mercado</Link>
        </div>
      )}

      {session && orders !== null && orders.length > 0 && (
        <p style={{ fontSize: "0.76rem", color: "#065F46", background: "#ECFDF5", borderBottom: "1px solid #A7F3D0", lineHeight: 1.45, padding: "0.7rem 1rem", margin: 0 }}>
          Levou algo a mais na hora de retirar? Abra o pedido e toque em <strong>Adicionar o que levei a mais</strong> —
          assim seu histórico e o total do mês ficam certos.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.key}>
          {/* Cabeçalho do mês: quanto foi gasto no total naquele mês */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--green-dark)", color: "#fff", padding: "0.5rem 1rem",
              fontSize: "0.8rem", fontWeight: 800, textTransform: "capitalize",
            }}
          >
            <span>{group.label}</span>
            <span>{formatBRL(group.total)}</span>
          </div>

          {group.orders.map((order) => {
            const items = order.market_order_items ?? [];
            const expanded = open === order.id;
            const when = new Date(order.created_at).toLocaleString("pt-BR", {
              timeZone: "America/Bahia", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            });
            return (
              <div key={order.id} style={{ background: "#fff", borderBottom: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : order.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    width: "100%", border: "none", background: "transparent", padding: "0.8rem 1rem",
                    fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#1e293b" }}>{when}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {items.length} {items.length === 1 ? "item" : "itens"} · toque para ver
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--green-dark)" }}>
                      {formatBRL(Number(order.total))}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                      {expanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div style={{ padding: "0 1rem 0.9rem" }}>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                          fontSize: "0.8rem", color: "#475569", padding: "0.25rem 0",
                        }}
                      >
                        <span style={{ minWidth: 0, flex: 1 }}>
                          {formatQty(Number(item.quantity))} × {item.product_name}
                          {item.variant_label ? ` — ${item.variant_label}` : ""}
                          {item.added_at_pickup && (
                            <span style={{ marginLeft: 6, fontSize: "0.66rem", fontWeight: 800, color: "var(--green-dark)", background: "#DCFCE7", borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>
                              na retirada
                            </span>
                          )}
                        </span>
                        <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatBRL(Number(item.line_total))}</span>
                        {item.added_at_pickup && (
                          <button
                            type="button"
                            onClick={() => removePickupItem(item.id)}
                            aria-label="Remover item"
                            style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "0 2px", flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setAdding(order.id)}
                      className="btn btn-outline btn-block"
                      style={{ marginTop: 10, fontSize: "0.8rem", borderColor: "var(--green-dark)", color: "var(--green-dark)" }}
                    >
                      + Adicionar o que levei a mais
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {adding !== null && (
        <AdicionarSheet
          orderId={adding}
          onClose={() => setAdding(null)}
          onDone={async () => { setAdding(null); await load(); }}
        />
      )}

      {session && orders !== null && orders.length > 0 && (
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.45, padding: "1rem" }}>
          Esta é a lista dos pedidos que você enviou pelo app, mais o que você acrescentou na
          retirada. Ajustes combinados direto com a feira pelo WhatsApp não entram sozinhos aqui.
        </p>
      )}
    </div>
  );
}
