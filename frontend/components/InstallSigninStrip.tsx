"use client";

import { useEffect, useState } from "react";
import { isStandalone } from "../lib/platform";
import InstallCtaButton from "./InstallCtaButton";

/**
 * Franja de instalación para la pantalla "Entrar". Botón prominente y siempre
 * visible (no se descarta) mientras la app no esté instalada. Un único CTA para
 * no duplicar llamados en esta pantalla.
 */
export default function InstallSigninStrip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(!isStandalone());
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        background: "linear-gradient(to right, var(--blue-xlight), var(--blue-light))",
        borderBottom: "2px solid var(--blue-light)",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--blue-main)", lineHeight: 1.3 }}>
          Instale o Mercado Ilha
        </div>
        <div style={{ fontSize: 12, color: "var(--blue-mid)", marginTop: 2, lineHeight: 1.35 }}>
          Acesse mais rápido da tela inicial
        </div>
      </div>
      <div style={{ flexShrink: 0, width: 150 }}>
        <InstallCtaButton label="Instalar App" size="md" />
      </div>
    </div>
  );
}
