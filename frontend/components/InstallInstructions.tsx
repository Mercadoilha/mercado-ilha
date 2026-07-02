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

      {([
        { num: 1, text: <>Toque no ícone de <strong style={{ color: "var(--blue-main)" }}>Compartilhar</strong> (quadrado com seta para cima) na barra do Safari</> },
        { num: 2, text: <>Role para baixo e toque em <strong style={{ color: "var(--blue-main)" }}>&ldquo;Adicionar à Tela de Início&rdquo;</strong></> },
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
