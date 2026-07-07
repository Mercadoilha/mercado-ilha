// Normalización de texto de búsqueda, espejo de las columnas *_norm de la DB
// (fase-19-busca-sem-acentos.sql): minúsculas y sin acentos, para que "pao"
// coincida con "Pão" en los dos lados (sugerencias y resultados).

export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Palabras de la búsqueda, normalizadas y sin los caracteres que rompen la
// sintaxis de los filtros .or()/.ilike() de PostgREST. Cada palabra se filtra
// por separado (AND), así "pão caseiro" encuentra "Pão integral caseiro".
export function foldWords(q: string): string[] {
  return fold(q)
    .replace(/[,()"'\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
