"use client";

import { useEffect, useRef, useState } from "react";
import { detectPlatform, isStandalone, type BeforeInstallPromptEvent, type Platform } from "../lib/platform";
import InstallInstructions from "./InstallInstructions";

type Props = {
  adminWa: string;
  /** Versión compacta (menos espacio vertical), para el perfil. */
  compact?: boolean;
};

export default function InstallAppCard({ adminWa, compact = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [canPromptAndroid, setCanPromptAndroid] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPromptAndroid(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(detectPlatform());
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanPromptAndroid(false);
  };

  if (standalone || !platform) return null;

  return (
    <section style={{ margin: compact ? "0.25rem 1rem 0.75rem" : "0 1rem 1.5rem" }}>
      <div style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: compact ? "0.75rem 1rem" : "1rem",
      }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "var(--blue-main)",
          }}
        >
          <span>📲 Instale o Mercado Ilha no seu celular</span>
          <span style={{ display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▼</span>
        </button>

        {expanded && (
          <div style={{ marginTop: "0.75rem" }}>
            {platform === "android" && (
              <InstallInstructions
                platform="android"
                onAndroidInstall={handleAndroidInstall}
                androidInstallDisabled={!canPromptAndroid}
                adminWhatsApp={adminWa}
              />
            )}

            {platform === "ios" && (
              <InstallInstructions
                platform="ios"
                onAndroidInstall={handleAndroidInstall}
                adminWhatsApp={adminWa}
                showIosToggle={false}
              />
            )}

            {platform === "other" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                    No Android:
                  </div>
                  <InstallInstructions
                    platform="android"
                    onAndroidInstall={handleAndroidInstall}
                    androidInstallDisabled={!canPromptAndroid}
                    adminWhatsApp={adminWa}
                  />
                </div>
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                    No iPhone:
                  </div>
                  <InstallInstructions
                    platform="ios"
                    onAndroidInstall={handleAndroidInstall}
                    adminWhatsApp={adminWa}
                    showIosToggle={false}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
