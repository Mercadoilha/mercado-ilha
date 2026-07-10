"use client";

import { useState } from "react";
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

const ShareIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ verticalAlign: "middle", display: "inline-block" }}
  >
    <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function InstallInstructions({
  platform,
  onAndroidInstall,
  androidInstallDisabled,
  adminWhatsApp,
  showIosToggle = true,
}: Props) {
  const [iosExpanded, setIosExpanded] = useState(!showIosToggle);

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
            borderRadius: 12,
            padding: "13px 18px",
            fontSize: 15,
            fontWeight: 800,
            width: "100%",
            border: "none",
            cursor: androidInstallDisabled ? "default" : "pointer",
            opacity: androidInstallDisabled ? 0.6 : 1,
            boxShadow: androidInstallDisabled ? "none" : "0 4px 14px rgba(239,159,39,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 19, lineHeight: 1 }}>📲</span>
          <span>Instalar App</span>
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
          É preciso estar no <strong>Safari</strong> para instalar. Se você está em outro
          navegador, abra este site pelo Safari e veja no vídeo como fazer:
        </div>

        <video
          src="/videos/instalar-safari.mp4"
          muted
          loop
          playsInline
          controls
          preload="auto"
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

        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: "#1a3a5c",
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          Se o seu iPhone é anterior ao iPhone 11, o símbolo <ShareIcon /> fica na barra
          inferior do navegador. Os passos seguintes são iguais aos do vídeo.
        </div>
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
          borderRadius: 12,
          padding: "13px 18px",
          fontSize: 15,
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
        <span style={{ fontSize: 19, lineHeight: 1 }}>📲</span>
        <span>Instalar App</span>
        <span className={`ib-chevron${iosExpanded ? " open" : ""}`} style={{ marginLeft: 2 }}>▼</span>
      </button>

      {iosExpanded && <div style={{ marginTop: 10 }}>{steps}</div>}
    </>
  );
}
