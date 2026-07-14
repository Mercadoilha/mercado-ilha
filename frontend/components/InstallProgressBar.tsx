"use client";

import { useEffect, useState } from "react";
import {
  getInstallProgress,
  onInstallProgress,
  type InstallProgressState,
} from "../lib/installProgress";

/**
 * Barra fija superior para la instalación en Android cuando el prompt todavía no llegó.
 * - "preparing": línea animada + "Preparando a instalação…" mientras se espera el prompt.
 * - "ready": el prompt llegó fuera del gesto original → "Pronto — toque para instalar"
 *   (un único toque instala).
 * Renderiza null mientras está oculta → cero impacto en la carga inicial / LCP. Se monta
 * una sola vez en el layout y escucha por eventos (ver lib/installProgress.ts).
 */
export default function InstallProgressBar() {
  const [state, setState] = useState<InstallProgressState>({ phase: "hidden" });

  useEffect(() => {
    setState(getInstallProgress());
    return onInstallProgress(setState);
  }, []);

  if (state.phase === "hidden") return null;

  const ready = state.phase === "ready";

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={ready ? state.onTap : undefined}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: "var(--blue-main)",
        color: "#fff",
        paddingTop: "env(safe-area-inset-top)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        cursor: ready ? "pointer" : "default",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "10px 14px",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>📲</span>
        <span>{ready ? "Pronto — toque para instalar" : "Preparando a instalação…"}</span>
      </div>
      {/* Línea de progreso indeterminada (solo en "preparing") */}
      {!ready && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: "40%",
              background: "var(--sand)",
              borderRadius: 3,
              animation: "install-progress-slide 1.1s ease-in-out infinite",
            }}
          />
          <style>{`@keyframes install-progress-slide{0%{transform:translateX(-100%)}50%{transform:translateX(120%)}100%{transform:translateX(280%)}}`}</style>
        </div>
      )}
    </div>
  );
}
