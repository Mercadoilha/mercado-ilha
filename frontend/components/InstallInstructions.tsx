"use client";

import { useEffect, useState } from "react";
import { whatsappUrl } from "../lib/adminSettings";

type Props = {
  platform: "android" | "ios";
  onAndroidInstall: () => void;
  androidInstallDisabled?: boolean;
  adminWhatsApp: string;
  showIosToggle?: boolean;
};

const helpMessage =
  "Olá! Estou com dificuldades para instalar o Mercado Ilha na tela de início. Pode me ajudar?";

export default function InstallInstructions({
  platform,
  onAndroidInstall,
  androidInstallDisabled,
  adminWhatsApp,
  showIosToggle = true,
}: Props) {
  const [iosExpanded, setIosExpanded] = useState(!showIosToggle);
  const [browser, setBrowser] = useState<"safari" | "chrome">("safari");
  const [iosVersion, setIosVersion] = useState<[number, number] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (/CriOS/i.test(navigator.userAgent)) setBrowser("chrome");
    const m = navigator.userAgent.match(/OS (\d+)(?:[._](\d+))?/);
    if (m) setIosVersion([Number(m[1]), Number(m[2] || 0)]);
  }, []);

  // Antes do iOS 16.4 a Apple só permite instalar pelo Safari
  const chromeBlocked =
    iosVersion !== null && (iosVersion[0] < 16 || (iosVersion[0] === 16 && iosVersion[1] < 4));
  // iPhones com iOS antigo têm telas diferentes no Safari
  const safariVideo = iosVersion !== null && iosVersion[0] < 26 ? "instalar-safari-antigo" : "instalar-safari";
  const videoSrc = browser === "safari" ? safariVideo : "instalar-chrome";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const style = (
    <style>{`
      @keyframes ib-slideDown {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .ib-steps { animation: ib-slideDown 0.2s ease; }
      .ib-chevron { display: inline-block; transition: transform 0.2s; }
      .ib-chevron.open { transform: rotate(180deg); }
    `}</style>
  );

  if (platform === "android") {
    return (
      <>
        {style}
        <button
          type="button"
          onClick={onAndroidInstall}
          disabled={androidInstallDisabled}
          style={{
            background: "var(--sand)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 700,
            width: "100%",
            border: "none",
            cursor: androidInstallDisabled ? "default" : "pointer",
            opacity: androidInstallDisabled ? 0.6 : 1,
          }}
        >
          Instalar agora
        </button>
      </>
    );
  }

  const steps = (
    <div
      className="ib-steps"
      style={{
        background: "#fff",
        borderRadius: 10,
        border: "1.5px solid var(--blue-light)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 13, color: "#1a3a5c", textAlign: "center", marginBottom: 10, lineHeight: 1.4 }}>
          Veja no vídeo como instalar. Qual navegador você usa?
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
          {(["safari", "chrome"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrowser(b)}
              style={{
                padding: "7px 18px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                border: browser === b ? "1.5px solid var(--blue-main)" : "1.5px solid var(--border)",
                background: browser === b ? "var(--blue-main)" : "#fff",
                color: browser === b ? "#fff" : "var(--text-muted)",
              }}
            >
              {b === "safari" ? "Safari" : "Chrome"}
            </button>
          ))}
        </div>

        {browser === "chrome" && chromeBlocked ? (
          <div
            style={{
              background: "var(--blue-xlight)",
              border: "1px solid var(--blue-light)",
              borderRadius: 12,
              padding: 14,
              fontSize: 13,
              color: "#1a3a5c",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              ⚠️ Neste iPhone, o Chrome não permite instalar o app.
            </div>
            <div style={{ marginBottom: 10 }}>
              É preciso usar o Safari: copie o link do site, abra o Safari, cole o link na
              barra de endereço e siga o vídeo do Safari.
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                display: "block",
                width: "100%",
                background: copied ? "var(--green-dark, #0F6E56)" : "var(--blue-main)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {copied ? "Link copiado ✓" : "Copiar link do site"}
            </button>
          </div>
        ) : (
          <video
            key={videoSrc}
            src={`/videos/${videoSrc}.mp4`}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 240,
              margin: "0 auto",
              borderRadius: 12,
              border: "1px solid var(--blue-light)",
              background: "var(--blue-main)",
            }}
          />
        )}
      </div>

      {adminWhatsApp && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#666", padding: "10px 12px 12px" }}>
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
  );

  if (!showIosToggle) {
    return (
      <>
        {style}
        {steps}
      </>
    );
  }

  return (
    <>
      {style}
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

      {iosExpanded && <div style={{ marginTop: 10 }}>{steps}</div>}
    </>
  );
}
