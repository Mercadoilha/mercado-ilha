// Helpers puros de los filtros del feed (orden + zonas + condición). Viven fuera de los
// componentes de hoja (OrdenarSheet/FiltrarSheet) para que el feed pueda importar estas
// funciones/tipos sin arrastrar el código de las hojas al bundle inicial — las hojas se
// cargan con next/dynamic solo al abrirlas.

import type { CatalogSubzone } from "./catalogCache";

export const SORT_OPTIONS = [
  { key: "recent", label: "Mais recentes" },
  { key: "price_asc", label: "Menor preço" },
  { key: "price_desc", label: "Maior preço" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

// Etiqueta del botón "Ordenar": muestra la opción activa solo cuando NO es la default.
export function sortButtonLabel(current: string): string {
  if (current === "recent") return "Ordenar";
  const opt = SORT_OPTIONS.find((o) => o.key === current);
  return opt ? `Ordenar: ${opt.label}` : "Ordenar";
}

export const CONDITION_OPTIONS = [
  { key: "", label: "Todos" },
  { key: "Novo", label: "Novo" },
  { key: "Seminovo", label: "Seminovo" },
  { key: "Usado", label: "Usado" },
] as const;

export type ZoneSelection = {
  localityIds: number[]; // localidades marcadas enteras ("toda a localidade")
  subzoneIds: number[]; // sub-zonas sueltas marcadas individualmente
  condition: string; // "" = todas
};

// Cuenta de filtros activos para el badge del botón "Filtrar (N)": cada localidad entera
// = 1, cada sub-zona suelta NO cubierta por una localidad entera = 1, condición = 1.
export function countActiveFilters(sel: ZoneSelection, subzones: CatalogSubzone[]): number {
  const wholeLoc = new Set(sel.localityIds);
  const looseSubs = sel.subzoneIds.filter((sid) => {
    const sz = subzones.find((s) => s.id === sid);
    return !sz || !wholeLoc.has(sz.locality_id);
  });
  return sel.localityIds.length + looseSubs.length + (sel.condition ? 1 : 0);
}
