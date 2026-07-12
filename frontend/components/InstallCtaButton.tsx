"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  detectPlatform,
  isStandalone,
  type Platform,
} from "../lib/platform";
import { getInstallPrompt, triggerInstall } from "../lib/installPrompt";

type Props = {
  /** Texto del CTA. Por regla del proyecto siempre "Instalar App". */
  label?: string;
  /** Estilo prominente (acento) o discreto. */
  size?: "md" | "lg";
  /** Si true, no ocupa lugar cuando la app ya está instalada (default). */
  hideWhenStandalone?: boolean;
  style?: React.CSSProperties;
  /** Se llama después de disparar la acción (para cerrar popups, etc.). */
  onActed?: () => void;
};

/**
 * Botón único "Instalar App". Centraliza QUÉ hace el botón según contexto:
 *  - Android: dispara el prompt nativo (instala en el acto). Si el prompt no está
 *    disponible todavía, deriva a /instalar (instrucciones manuales).
 *  - iPhone (Safari o Chrome/otros): navega a /instalar, la pantalla dedicada que
 *    resuelve el caso Chrome→Safari y muestra el video.
 *  - Desktop/otros: deriva a /instalar.
 * Se oculta solo si la app ya está instalada.
 */
export default function InstallCtaButton({
  label = "Instalar App",
  size = "lg",
  hideWhenStandalone = true,
  style,
  onActed,
}: Props) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(detectPlatform());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (hideWhenStandalone && standalone) return null;

  const handleClick = async () => {
    if (platform === "android" && getInstallPrompt()) {
      await triggerInstall();
      onActed?.();
      return;
    }
    // iPhone (Safari o Chrome), Android sin prompt disponible, o desktop → pantalla dedicada.
    router.push("/instalar");
    onActed?.();
  };

  const big = size === "lg";

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: "var(--sand)",
        color: "#fff",
        borderRadius: 12,
        padding: big ? "14px 20px" : "11px 16px",
        fontSize: big ? 16 : 14,
        fontWeight: 800,
        width: "100%",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(239,159,39,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...style,
      }}
    >
      <span style={{ fontSize: big ? 20 : 18, lineHeight: 1 }}>📲</span>
      <span>{label}</span>
    </button>
  );
}
