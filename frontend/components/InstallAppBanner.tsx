"use client";

import { useState, useEffect, useRef } from "react";
import { getAdminSettings, whatsappUrl } from "../lib/adminSettings";

const DISMISS_KEY = "install_banner_dismissed_at";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

type Platform = "android" | "ios";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppBanner() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosExpanded, setIosExpanded] = useState(false);
  const [adminWhatsApp, setAdminWhatsApp] = useState("");
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Register beforeinstallprompt listener immediately (fires early in page load)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Decide whether to show and on which platform
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_TTL) return;

    const ua = navigator.userAgent;
    let detected: Platform | null = null;
    if (/Android/i.test(ua)) {
      detected = "android";
    } else if (/iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream) {
      detected = "ios";
    }

    if (!detected) return;
    setPlatform(detected);
    setVisible(true);
  }, []);

  // Load admin WhatsApp only when the banner becomes visible
  useEffect(() => {
    if (!visible) return;
    getAdminSettings().then((s) => setAdminWhatsApp(s.whatsapp));
  }, [visible]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") setVisible(false);
    deferredPrompt.current = null;
  };

  const helpMessage =
    "Olá! Estou com dificuldades para instalar o Mercado Ilha na tela de início. Pode me ajudar?";

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes ib-slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ib-steps { animation: ib-slideDown 0.2s ease; }
        .ib-chevron { display: inline-block; transition: transform 0.2s; }
        .ib-chevron.open { transform: rotate(180deg); }
        .ib-dismiss:hover { opacity: 1 !important; }
      `}</style>

      <div style={{
        background: "linear-gradient(to right, var(--blue-xlight), var(--blue-light))",
        borderBottom: "2px solid var(--blue-light)",
        padding: "14px 16px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>📲</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--blue-main)", lineHeight: 1.3 }}>
              Instale o Mercado Ilha
            </div>
            <div style={{ fontSize: 12, color: "var(--blue-mid)", marginTop: 2, lineHeight: 1.4 }}>
              Acesse mais rápido direto da tela inicial do seu celular
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar"
            className="ib-dismiss"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "2px 4px",
              color: "var(--blue-main)",
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Android: native install prompt */}
        {platform === "android" && (
          <button
            type="button"
            onClick={handleAndroidInstall}
            style={{
              background: "var(--sand)",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 700,
              width: "100%",
              border: "none",
              cursor: "pointer",
            }}
          >
            Instalar agora
          </button>
        )}

        {/* iOS: manual instructions */}
        {platform === "ios" && (
          <>
            <button
              type="button"
              onClick={() => setIosExpanded((v) => !v)}
              style={{
                background: "var(--sand)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 16px",
                fontSize: 14,
                fontWeight: 700,
                width: "100%",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Ver como instalar</span>
              <span className={`ib-chevron${iosExpanded ? " open" : ""}`}>▼</span>
            </button>

            {iosExpanded && (
              <div
                className="ib-steps"
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  border: "1.5px solid var(--blue-light)",
                  marginTop: 10,
                  overflow: "hidden",
                }}
              >
                {/* Safari notice */}
                <div style={{
                  background: "#FFF7E6",
                  border: "1px solid var(--sand-light)",
                  borderRadius: 7,
                  margin: 12,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 12, color: "#7c4a00", lineHeight: 1.4 }}>
                    Abra o site pelo <strong>Safari</strong> e siga os passos:
                  </span>
                </div>

                {/* Steps */}
                {([
                  { num: 1, text: <>Toque nos <strong style={{ color: "var(--blue-main)" }}>&ldquo;...&rdquo;</strong> no canto inferior direito</> },
                  { num: 2, text: <>Toque em <strong style={{ color: "var(--blue-main)" }}>&ldquo;Compartilhar&rdquo;</strong></> },
                  { num: 3, text: <>Role para baixo e toque em <strong style={{ color: "var(--blue-main)" }}>&ldquo;Ver mais&rdquo;</strong></> },
                  { num: 4, text: <>Toque em <strong style={{ color: "var(--blue-main)" }}>&ldquo;Adicionar à Tela de Início&rdquo;</strong></> },
                ] as const).map((step, idx, arr) => (
                  <div
                    key={step.num}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: idx < arr.length - 1 ? "1px solid var(--blue-xlight)" : "none",
                    }}
                  >
                    <span style={{
                      width: 20,
                      height: 20,
                      minWidth: 20,
                      borderRadius: "50%",
                      background: "var(--blue-main)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {step.num}
                    </span>
                    <span style={{ fontSize: 13, color: "#1a3a5c", lineHeight: 1.4 }}>
                      {step.text}
                    </span>
                  </div>
                ))}

                {/* Contact link */}
                {adminWhatsApp && (
                  <div style={{
                    textAlign: "center",
                    fontSize: 12,
                    color: "#666",
                    padding: "10px 12px 12px",
                  }}>
                    Se tiver dificuldades,{" "}
                    <a
                      href={whatsappUrl(adminWhatsApp, helpMessage)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--blue-main)", textDecoration: "underline" }}
                    >
                      entre em contato conosco
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
