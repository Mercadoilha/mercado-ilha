"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminSettings } from "../lib/adminSettings";
import {
  detectPlatform,
  detectIosBrowser,
  isStandalone,
  type Platform,
} from "../lib/platform";
import {
  getInstallPrompt,
  onInstallPromptChange,
  triggerInstall,
} from "../lib/installPrompt";
import InstallInstructions from "./InstallInstructions";

type IosView = "safari" | "other";

export default function InstalarClient() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [iosView, setIosView] = useState<IosView>("safari");
  const [ready, setReady] = useState(false);
  const [adminWa, setAdminWa] = useState("");
  const [showExit, setShowExit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canPromptAndroid, setCanPromptAndroid] = useState(false);

  useEffect(() => {
    const sync = () => setCanPromptAndroid(!!getInstallPrompt());
    sync();
    return onInstallPromptChange(sync);
  }, []);

  useEffect(() => {
    if (isStandalone()) {
      router.replace("/");
      return;
    }
    const p = detectPlatform();
    setPlatform(p);
    if (p === "ios") setIosView(detectIosBrowser() === "safari" ? "safari" : "other");
    setReady(true);
  }, [router]);

  useEffect(() => {
    getAdminSettings().then((s) => setAdminWa(s.whatsapp));
  }, []);

  const handleAndroidInstall = async () => {
    await triggerInstall();
    setCanPromptAndroid(!!getInstallPrompt());
  };

  const openInSafari = () => {
    // Chrome iOS honra el prefijo x-safari- para reabrir la URL en Safari.
    const url = `${window.location.origin}/instalar`;
    window.location.href = `x-safari-${url}`;
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/instalar`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback antiguo: seleccionar el texto para copiar a mano.
      const el = document.getElementById("instalar-url-text");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const confirmExit = () => {
    setShowExit(false);
    router.push("/");
  };

  if (!ready) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--blue-main)" }} aria-hidden />
    );
  }

  const installUrl =
    typeof window !== "undefined" ? `${window.location.origin}/instalar` : "";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(180deg, var(--blue-xlight) 0%, #fff 55%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Barra superior con salida */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "12px 14px",
        }}
      >
        <button
          type="button"
          onClick={() => setShowExit(true)}
          aria-label="Fechar"
          style={{
            background: "rgba(24,95,165,0.08)",
            border: "none",
            borderRadius: 999,
            width: 34,
            height: 34,
            fontSize: 18,
            lineHeight: 1,
            color: "var(--blue-main)",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: "0.5rem 1.25rem 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.svg"
          alt="Mercado Ilha"
          style={{ height: 84, width: "auto", marginBottom: 16 }}
        />

        <h1
          style={{
            fontSize: "1.4rem",
            fontWeight: 800,
            color: "var(--blue-main)",
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        >
          Instale o Mercado Ilha
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--blue-mid)",
            lineHeight: 1.5,
            maxWidth: 340,
            marginBottom: 22,
          }}
        >
          Deixe o app na tela inicial do seu celular e acesse a ilha inteira num toque —
          mais rápido e sem ocupar espaço.
        </p>

        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* ── ANDROID ── */}
          {platform === "android" && (
            <>
              <InstallInstructions
                platform="android"
                onAndroidInstall={handleAndroidInstall}
                androidInstallDisabled={!canPromptAndroid}
                adminWhatsApp={adminWa}
              />
              {!canPromptAndroid && (
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
                  Se o botão não instalar direto, abra o menu do navegador (⋮) e toque em{" "}
                  <strong>&quot;Instalar app&quot;</strong> ou{" "}
                  <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                </p>
              )}
            </>
          )}

          {/* ── iPhone en Safari ── */}
          {platform === "ios" && iosView === "safari" && (
            <InstallInstructions
              platform="ios"
              onAndroidInstall={() => {}}
              adminWhatsApp={adminWa}
              showIosToggle={false}
            />
          )}

          {/* ── iPhone en Chrome / otro navegador ── */}
          {platform === "ios" && iosView === "other" && (
            <div
              style={{
                background: "#fff",
                border: "1.5px solid var(--blue-light)",
                borderRadius: 14,
                padding: "16px 16px 18px",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 14, color: "#1a3a5c", lineHeight: 1.5, marginBottom: 14 }}>
                No iPhone, o app se instala pelo <strong>Safari</strong>. Toque no botão
                abaixo para abrir esta página no Safari e concluir a instalação:
              </div>

              <button
                type="button"
                onClick={openInSafari}
                style={{
                  background: "var(--sand)",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontSize: 16,
                  fontWeight: 800,
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(239,159,39,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>🧭</span>
                <span>Abrir no Safari</span>
              </button>

              {/* Fallback SIEMPRE visible: copiar el link para pegarlo en Safari. */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 8 }}>
                  Não abriu? Copie o link, abra o <strong>Safari</strong> e cole na barra de
                  endereço:
                </div>
                <div
                  id="instalar-url-text"
                  style={{
                    fontSize: 12.5,
                    color: "var(--blue-main)",
                    background: "var(--blue-xlight)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    wordBreak: "break-all",
                    marginBottom: 8,
                    userSelect: "all",
                  }}
                >
                  {installUrl}
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  style={{
                    background: copied ? "var(--sea-deep, #0F6E56)" : "var(--blue-main)",
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
                  {copied ? "Link copiado! Cole no Safari" : "Copiar link"}
                </button>
              </div>
            </div>
          )}

          {/* ── Desktop / otros ── */}
          {platform === "other" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
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
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>
                  No iPhone:
                </div>
                <InstallInstructions
                  platform="ios"
                  onAndroidInstall={() => {}}
                  adminWhatsApp={adminWa}
                  showIosToggle={false}
                />
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowExit(true)}
          style={{
            marginTop: 24,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            fontSize: 14,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Agora não
        </button>
      </div>

      {/* Modal de confirmación de salida */}
      {showExit && (
        <div
          onClick={() => setShowExit(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,30,55,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "22px 20px",
              maxWidth: 340,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 8 }}>📲</div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--blue-main)", marginBottom: 8 }}>
              Tem certeza que deseja sair sem instalar o app?
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 18 }}>
              Com o app instalado você acessa o Mercado Ilha num toque, direto da tela inicial.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowExit(false)}
                style={{
                  background: "var(--sand)",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: 15,
                  fontWeight: 800,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Continuar instalação
              </button>
              <button
                type="button"
                onClick={confirmExit}
                style={{
                  background: "none",
                  color: "var(--text-muted)",
                  border: "none",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sair mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
