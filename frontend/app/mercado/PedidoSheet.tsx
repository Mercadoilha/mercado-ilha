"use client";

import { useMemo, useState } from "react";
import BottomSheet from "../../components/BottomSheet";
import QtyStepper from "./QtyStepper";
import { buildWaUrl } from "../../lib/whatsappUrl";
import {
  buildOrderMessage, itemName, lineTotal, registerOrder,
  type VariantIndex, type Vendor,
} from "../../lib/mercadoApi";
import { formatBRL, type CartMap } from "../../lib/mercadoCart";

type Props = {
  vendor: Vendor;
  cart: CartMap;
  index: VariantIndex;
  total: number;
  sent: boolean;
  hasSession: boolean;
  customer: { name: string; whatsapp: string | null };
  onQty: (variantId: number, qty: number) => void;
  onClear: () => void;
  onSent: () => void;
  onLogin: () => void;
  onClose: () => void;
};

export default function PedidoSheet({
  vendor, cart, index, total, sent, hasSession, customer, onQty, onClear, onSent, onLogin, onClose,
}: Props) {
  // "Limpar" pede confirmação: agora está à vista, no alto da lista, e um toque
  // sem querer não pode apagar um carrinho inteiro.
  const [confirmClear, setConfirmClear] = useState(false);

  const rows = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ entry: index.get(Number(id)), qty }))
        .filter((r) => r.entry && r.qty > 0),
    [cart, index],
  );

  // O link do WhatsApp fica pronto ANTES do toque: no celular, abrir uma janela
  // depois de uma resposta do servidor é bloqueado pelo navegador. Por isso o botão
  // é um link de verdade, com a mensagem já montada.
  const waUrl = useMemo(() => {
    if (!vendor.whatsapp) return null;
    return buildWaUrl(vendor.whatsapp, buildOrderMessage(vendor, cart, index, customer.name || null));
  }, [vendor, cart, index, customer.name]);

  const handleSend = () => {
    // Registro do pedido em segundo plano, no mesmo toque: se falhar, o cliente
    // manda o WhatsApp do mesmo jeito — só se perde a estatística.
    // Reenviar não duplica: a base reconhece o mesmo carrinho da mesma pessoa
    // dentro de 6h e devolve o pedido que já existe (fase-39).
    registerOrder({
      vendorId: vendor.id,
      cart,
      customerName: customer.name || "Cliente do app",
      customerWhatsapp: customer.whatsapp,
    });
    onSent();
  };

  return (
    <BottomSheet title="Seu pedido" subtitle={vendor.name} onClose={onClose}>
      {rows.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", padding: "0.5rem 0 1rem" }}>
          Seu pedido está vazio.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}>
              {rows.length} {rows.length === 1 ? "item" : "itens"}
            </span>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, lineHeight: 1, cursor: "pointer",
                border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C",
                borderRadius: 999, padding: "6px 12px", fontSize: "0.75rem", fontWeight: 800,
              }}
            >
              🗑 Limpar
            </button>
          </div>

          {confirmClear && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "0.7rem 0.8rem", marginBottom: 12 }}>
              <p style={{ fontSize: "0.78rem", color: "#991B1B", lineHeight: 1.4, margin: "0 0 8px" }}>
                Limpar o pedido? Todos os itens saem da lista.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setConfirmClear(false); onClear(); }}
                  className="btn"
                  style={{ flex: 1, background: "#DC2626", color: "#fff", fontSize: "0.8rem", fontWeight: 800 }}
                >
                  Sim, limpar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="btn btn-ghost"
                  style={{ flex: 1, fontSize: "0.8rem" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map(({ entry, qty }) => {
              const { variant, product } = entry!;
              return (
                <div
                  key={variant.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    borderBottom: "1px solid var(--border)", paddingBottom: 8,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", lineHeight: 1.25 }}>
                      {itemName(product, variant)}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--green-dark)", fontWeight: 800, marginTop: 2 }}>
                      {formatBRL(lineTotal(variant, qty))}
                    </div>
                  </div>
                  <QtyStepper variant={variant} qty={qty} onChange={onQty} />
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 4px" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155" }}>Total</span>
            <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--green-dark)" }}>{formatBRL(total)}</span>
          </div>

          {(vendor.pickup_place || vendor.deadline_text) && (
            <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", lineHeight: 1.4, margin: "8px 0 14px" }}>
              {vendor.pickup_place && <>Retirada: {vendor.pickup_place}. </>}
              {vendor.deadline_text}
            </p>
          )}

          {sent && (
            <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "0.7rem 0.85rem", marginBottom: 12, fontSize: "0.82rem", color: "#065F46", fontWeight: 600 }}>
              Pedido enviado! Ele fica guardado aqui caso você precise reenviar — reenviar o mesmo pedido não gera um pedido repetido para a feira.
            </div>
          )}

          {!hasSession ? (
            <>
              <button type="button" onClick={onLogin} className="btn btn-primary btn-block">
                Entrar para enviar o pedido
              </button>
              <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
                É rápido e gratuito. Seu pedido fica guardado — ao voltar, ele estará aqui.
              </p>
            </>
          ) : waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleSend}
              className="btn btn-block"
              style={{ background: "#25D366", color: "#fff", fontSize: "0.95rem", fontWeight: 800 }}
            >
              {sent ? "Reenviar pelo WhatsApp" : "Enviar pedido pelo WhatsApp"}
            </a>
          ) : (
            <p style={{ fontSize: "0.82rem", color: "#b45309", textAlign: "center" }}>
              O WhatsApp da feira ainda não foi configurado.
            </p>
          )}
        </>
      )}
    </BottomSheet>
  );
}
