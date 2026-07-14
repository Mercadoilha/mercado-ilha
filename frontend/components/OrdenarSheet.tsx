"use client";

import BottomSheet from "./BottomSheet";
import { SORT_OPTIONS, type SortKey } from "../lib/feedFilters";

export default function OrdenarSheet({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet title="Ordenar" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {SORT_OPTIONS.map((opt) => {
          const active = current === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                onSelect(opt.key);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                border: "none",
                background: active ? "var(--blue-xlight)" : "transparent",
                borderRadius: 12,
                padding: "0.85rem 0.9rem",
                fontSize: "0.95rem",
                fontWeight: active ? 700 : 500,
                color: active ? "var(--blue-main)" : "#334155",
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>{opt.label}</span>
              {/* Radio visual */}
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  flexShrink: 0,
                  border: active ? "6px solid var(--blue-main)" : "2px solid var(--border)",
                  background: "#fff",
                }}
              />
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
