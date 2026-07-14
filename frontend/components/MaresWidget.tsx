"use client";

import { useEffect, useState } from "react";

interface Tide {
  time: string;
  height: string;
  type: "alta" | "baixa";
}

interface MaresData {
  tides: Tide[];
  date: string;
}

// Rediseño /informacao: sin caja azul — la información va directo sobre el fondo
// blanco de la página, con tipografía más grande (hay una página dedicada, se aprovecha).
export default function MaresWidget() {
  const [data, setData] = useState<MaresData | null>(null);

  useEffect(() => {
    fetch("/api/mares")
      .then((r) => r.json())
      .then((d: MaresData) => {
        if (d.tides && d.tides.length > 0) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div style={{ padding: "4px 2px 14px" }}>
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 19,
          fontWeight: 800,
          color: "#185FA5",
        }}
      >
        〰 Tabela de Marés
      </p>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 13,
          color: "#5a7ea8",
        }}
      >
        {hoje}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 10px",
        }}
      >
        {data.tides.map((t: Tide, i: number) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 15 }}>
              {t.type === "alta" ? "↑" : "↓"}
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#185FA5",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.time}
            </span>
            <span
              style={{
                fontSize: 13,
                color: "#0F6E56",
                fontWeight: 600,
              }}
            >
              {t.height}m
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#5a7ea8",
              }}
            >
              {t.type === "alta" ? "alta" : "baixa"}
            </span>
          </div>
        ))}
      </div>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 10,
          color: "#8aabcc",
          textAlign: "right",
        }}
      >
        fonte: tabuademares.com
      </p>
    </div>
  );
}
