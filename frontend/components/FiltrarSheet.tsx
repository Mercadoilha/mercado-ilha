"use client";

import { useState } from "react";
import BottomSheet from "./BottomSheet";
import type { CatalogLocality, CatalogSubzone } from "../lib/catalogCache";
import { CONDITION_OPTIONS, type ZoneSelection } from "../lib/feedFilters";

export default function FiltrarSheet({
  localities,
  subzones,
  initial,
  showCondition,
  onApply,
  onClose,
}: {
  localities: CatalogLocality[];
  subzones: CatalogSubzone[];
  initial: ZoneSelection;
  showCondition: boolean;
  onApply: (sel: ZoneSelection) => void;
  onClose: () => void;
}) {
  const [localityIds, setLocalityIds] = useState<number[]>(initial.localityIds);
  const [subzoneIds, setSubzoneIds] = useState<number[]>(initial.subzoneIds);
  const [condition, setCondition] = useState<string>(initial.condition);

  const wholeLoc = new Set(localityIds);
  const looseSub = new Set(subzoneIds);

  const toggleLocality = (id: number) =>
    setLocalityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSubzone = (id: number) =>
    setSubzoneIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const clearAll = () => {
    setLocalityIds([]);
    setSubzoneIds([]);
    setCondition("");
  };

  const apply = () => {
    // Al aplicar, descarta las sub-zonas sueltas ya cubiertas por su localidad entera:
    // evita contarlas dos veces y mantiene la selección coherente.
    const cleanedSubs = subzoneIds.filter((sid) => {
      const sz = subzones.find((s) => s.id === sid);
      return !sz || !wholeLoc.has(sz.locality_id);
    });
    onApply({ localityIds, subzoneIds: cleanedSubs, condition });
    onClose();
  };

  return (
    <BottomSheet title="Filtrar" onClose={onClose}>
      {/* Condição — solo para Produtos */}
      {showCondition && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionTitle}>Condição</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CONDITION_OPTIONS.map((opt) => {
              const active = condition === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCondition(opt.key)}
                  style={{
                    padding: "0.4rem 0.9rem",
                    borderRadius: 999,
                    border: active ? "none" : "1px solid var(--border)",
                    background: active ? "var(--sand)" : "#fff",
                    color: active ? "#fff" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: "0.82rem",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Zonas */}
      <div style={sectionTitle}>Localização</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {localities.map((loc) => {
          const zones = subzones.filter((z) => z.locality_id === loc.id);
          const whole = wholeLoc.has(loc.id);
          return (
            <div key={loc.id}>
              <label style={locRow}>
                <input
                  type="checkbox"
                  checked={whole}
                  onChange={() => toggleLocality(loc.id)}
                  style={checkboxStyle}
                />
                <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b" }}>{loc.name}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  toda a localidade
                </span>
              </label>
              {zones.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 30, marginTop: 4 }}>
                  {zones.map((z) => {
                    const checked = whole || looseSub.has(z.id);
                    return (
                      <label key={z.id} style={{ ...subRow, opacity: whole ? 0.55 : 1 }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={whole}
                          onChange={() => toggleSubzone(z.id)}
                          style={checkboxStyle}
                        />
                        <span style={{ fontSize: "0.86rem", color: "#334155" }}>{z.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botões */}
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        <button type="button" onClick={clearAll} style={clearBtn}>
          Limpar
        </button>
        <button type="button" onClick={apply} style={applyBtn}>
          Aplicar
        </button>
      </div>
    </BottomSheet>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 10,
};

const locRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
};

const subRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  padding: "1px 0",
};

const checkboxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  accentColor: "var(--blue-main)",
  flexShrink: 0,
  cursor: "pointer",
};

const clearBtn: React.CSSProperties = {
  flex: 1,
  padding: "0.75rem",
  borderRadius: 12,
  border: "1px solid var(--blue-main)",
  background: "#fff",
  color: "var(--blue-main)",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const applyBtn: React.CSSProperties = {
  flex: 2,
  padding: "0.75rem",
  borderRadius: 12,
  border: "none",
  background: "var(--blue-main)",
  color: "#fff",
  fontWeight: 700,
  fontSize: "0.9rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
