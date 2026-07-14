"use client";

import { useEffect, useState } from "react";
import { detectPlatform, isAppInstalled } from "../lib/platform";
import { getInstallPrompt, onInstallPromptChange } from "../lib/installPrompt";
import InstallCtaButton from "./InstallCtaButton";

/**
 * Popup de invitación a instalar, al abrir la app en el navegador (no instalada).
 * Se monta diferido desde el home para no afectar el LCP: espera un instante tras
 * el render principal antes de aparecer. Aparece como máximo UNA vez por día (iPhone
 * y Android); cerrarlo solo lo descarta en esta apertura (queda en la pantalla
 * principal). El botón usa InstallCtaButton, así Android instala en el acto y iPhone
 * va a /instalar (donde se resuelve Safari).
 *
 * Android: NO aparece hasta que el prompt de instalación esté capturado (así el toque
 * SIEMPRE instala directo). Si Chrome nunca lo dispara, el popup no aparece.
 * Invitación forzada (post-cadastro Android): flag en sessionStorage que muestra el
 * popup sin contar contra el límite de 1×/día.
 */
const POPUP_KEY = "install_popup_last_shown_at";
const FORCE_KEY = "force_install_invite";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function InstallInvitePopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const platform = detectPlatform();
    if (platform === "other") return; // solo celulares

    // Invitación forzada tras crear cuenta (Android): ignora el límite de 1×/día.
    let forced = false;
    try {
      forced = sessionStorage.getItem(FORCE_KEY) === "1";
      if (forced) sessionStorage.removeItem(FORCE_KEY);
    } catch {
      forced = false;
    }

    // Máximo una vez por día (salvo invitación forzada).
    if (!forced) {
      let last = 0;
      try {
        last = Number(localStorage.getItem(POPUP_KEY)) || 0;
      } catch {
        last = 0;
      }
      if (Date.now() - last < ONE_DAY_MS) return;
    }

    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    let unsub = () => {};

    // El contador 1×/día se registra recién cuando el popup se muestra de verdad.
    const showNow = () => {
      if (cancelled) return;
      setVisible(true);
      if (!forced) {
        try {
          localStorage.setItem(POPUP_KEY, String(Date.now()));
        } catch {
          /* localStorage no disponible: se mostrará igual, sin recordar */
        }
      }
    };

    // No mostrar si ya está instalado, incluso abriendo desde el navegador (link/QR).
    isAppInstalled().then((installed) => {
      if (cancelled || installed) return;

      // Diferido: no compite con la carga inicial del home (piso ~1.4s por el LCP).
      t = setTimeout(() => {
        if (cancelled) return;
        if (platform === "ios") {
          // iPhone: no depende de beforeinstallprompt → mostrar directo.
          showNow();
          return;
        }
        // Android: esperar a tener el prompt capturado antes de aparecer (sin límite).
        if (getInstallPrompt()) {
          showNow();
          return;
        }
        unsub = onInstallPromptChange(() => {
          if (getInstallPrompt()) {
            unsub();
            showNow();
          }
        });
      }, 1400);
    });

    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
      unsub();
    };
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
