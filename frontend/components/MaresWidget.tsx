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
    <div
      style={{
        margin: "0 0 4px",
        padding: "10px 14px",
        background: "#E6F1FB",
        borderRadius: 10,
        border: "1px solid #B5D4F4",
      }}
    >
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 15,
          fontWeight: 700,
          color: "#185FA5",
        }}
      >
        〰 Tabela de Marés
      </p>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          color: "#5a7ea8",
        }}
      >
        {hoje}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3px 8px",
        }}
      >
        {data.tides.map((t: Tide, i: number) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span style={{ fontSize: 13 }}>
              {t.type === "alta" ? "↑" : "↓"}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "#185FA5",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.time}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#0F6E56",
                fontWeight: 600,
              }}
            >
              {t.height}m
            </span>
            <span
              style={{
                fontSize: 10,
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
          margin: "6px 0 0",
          fontSize: 9,
          color: "#8aabcc",
          textAlign: "right",
        }}
      >
        fonte: tabuademares.com
      </p>
    </div>
  );
}
