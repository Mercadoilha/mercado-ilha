"use client";

import { useState } from "react";

// Morro de São Paulo → Valença
const MORRO_VALENCA_LANCHA = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];
const MORRO_VALENCA_CONVENCIONAL = [
  "05:10", "05:40", "06:10", "06:40", "07:00", "07:30",
  "08:00", "09:00", "09:30", "10:00", "10:30", "11:00",
  "11:30", "12:30", "13:00", "14:00", "14:30", "15:00",
  "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

// Valença → Morro de São Paulo
const VALENCA_MORRO_LANCHA = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
];
const VALENCA_MORRO_CONVENCIONAL = [
  "06:00", "06:30", "07:00", "07:30", "08:30", "09:30",
  "10:00", "11:00", "11:30", "12:30", "13:00", "14:00",
  "15:00", "15:30", "16:00", "17:00", "18:20",
];

const ROUTES = {
  ida: {
    label: "Morro → Valença",
    lancha: MORRO_VALENCA_LANCHA,
    convencional: MORRO_VALENCA_CONVENCIONAL,
  },
  volta: {
    label: "Valença → Morro",
    lancha: VALENCA_MORRO_LANCHA,
    convencional: VALENCA_MORRO_CONVENCIONAL,
  },
} as const;

type RouteKey = keyof typeof ROUTES;

function TimeChip({ time }: { time: string }) {
  return (
    <span
      style={{
        fontSize: 13,
        color: "#185FA5",
        background: "#f6faff",
        border: "1px solid #B5D4F4",
        borderRadius: 6,
        padding: "3px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {time}
    </span>
  );
}

// Rediseño /informacao: sin caja azul — la información va directo sobre el fondo
// blanco de la página, con tipografía más grande (hay una página dedicada, se aprovecha).
export default function BarcosWidget() {
  const [route, setRoute] = useState<RouteKey>("ida");
  const current = ROUTES[route];

  return (
    <div style={{ padding: "14px 2px 4px", borderTop: "1px solid var(--border)" }}>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 19,
          fontWeight: 800,
          color: "#185FA5",
        }}
      >
        ⛴ Horários de Barcos
      </p>

      {/* Seletor de sentido */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {(Object.keys(ROUTES) as RouteKey[]).map((key) => {
          const active = key === route;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setRoute(key)}
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                padding: "8px 6px",
                borderRadius: 8,
                border: active ? "1px solid #185FA5" : "1px solid #B5D4F4",
                background: active ? "#185FA5" : "#fff",
                color: active ? "#fff" : "#5a7ea8",
                transition: "background .15s, color .15s",
              }}
            >
              {ROUTES[key].label}
            </button>
          );
        })}
      </div>

      <p
        style={{
          margin: "0 0 6px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0F6E56",
        }}
      >
        Lancha rápida
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {current.lancha.map((t) => (
          <TimeChip key={t} time={t} />
        ))}
      </div>

      <p
        style={{
          margin: "0 0 6px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0F6E56",
        }}
      >
        Barco convencional
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {current.convencional.map((t) => (
          <TimeChip key={t} time={t} />
        ))}
      </div>

      <p
        style={{
          margin: "12px 0 0",
          fontSize: 12,
          fontWeight: 700,
          color: "#0F6E56",
        }}
      >
        O translado passa pelo atracadouro.
      </p>

      <p
        style={{
          margin: "6px 0 0",
          fontSize: 11,
          color: "#8aabcc",
        }}
      >
        Aos domingos e feriados os horários são reduzidos, favor consultar no local.
      </p>
    </div>
  );
}
