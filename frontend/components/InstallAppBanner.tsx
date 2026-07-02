"use client";

import { useState, useEffect, useRef } from "react";
import { getAdminSettings } from "../lib/adminSettings";
import { detectPlatform, isStandalone, type BeforeInstallPromptEvent } from "../lib/platform";
import InstallInstructions from "./InstallInstructions";

const DISMISS_KEY = "install_banner_dismissed_at";
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

type Platform = "android" | "ios";

export default function InstallAppBanner() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [visible, setVisible] = useState(false);
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
    if (isStandalone()) return;

    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_TTL) return;

    const detected = detectPlatform();
    if (detected === "other") return;
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

  if (!visible) return null;

  return (
    <>
      <style>{`
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

        {platform && (
          <InstallInstructions
            platform={platform}
            onAndroidInstall={handleAndroidInstall}
            adminWhatsApp={adminWhatsApp}
          />
        )}
      </div>
    </>
  );
}
