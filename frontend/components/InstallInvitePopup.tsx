"use client";

import { useEffect, useState } from "react";
import { detectPlatform, isStandalone } from "../lib/platform";
import InstallCtaButton from "./InstallCtaButton";

/**
 * Popup de invitación a instalar, al abrir la app en el navegador (no instalada).
 * Se monta diferido desde el home para no afectar el LCP: espera un instante tras
 * el render principal antes de aparecer. Aparece como máximo UNA vez por día (iPhone
 * y Android); cerrarlo solo lo descarta en esta apertura (queda en la pantalla
 * principal). El botón usa InstallCtaButton, así Android instala en el acto y iPhone
 * va a /instalar (donde se resuelve Safari).
 */
const POPUP_KEY = "install_popup_last_shown_at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function InstallInvitePopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (detectPlatform() === "other") return; // solo celulares

    // Máximo una vez por día: si ya se mostró en las últimas 24 h, no reaparece.
    let last = 0;
    try {
      last = Number(localStorage.getItem(POPUP_KEY)) || 0;
    } catch {
      last = 0;
    }
    if (Date.now() - last < ONE_DAY_MS) return;

    // Diferido: no compite con la carga inicial del home.
    const t = setTimeout(() => {
      setVisible(true);
      try {
        localStorage.setItem(POPUP_KEY, String(Date.now()));
      } catch {
        /* localStorage no disponible: se mostrará igual, sin recordar */
      }
    }, 1400);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,55,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: "22px 20px 20px",
          maxWidth: 400,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 -6px 40px rgba(0,0,0,0.25)",
          marginBottom: "calc(env(safe-area-inset-bottom) + 8px)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.svg" alt="Mercado Ilha" style={{ height: 56, width: "auto", marginBottom: 12 }} />
        <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--blue-main)", marginBottom: 6 }}>
          Instale o Mercado Ilha
        </div>
        <p style={{ fontSize: "0.9rem", color: "var(--blue-mid)", lineHeight: 1.5, marginBottom: 18 }}>
          Acesse a ilha inteira num toque, direto da tela inicial do seu celular.
        </p>

        <InstallCtaButton label="Instalar App" onActed={dismiss} />

        <button
          type="button"
          onClick={dismiss}
          style={{
            marginTop: 12,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Agora não
        </button>
      </div>
    </div>
  );
}
