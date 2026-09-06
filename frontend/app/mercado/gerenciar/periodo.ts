// Períodos do caixa, sempre no fuso da ilha (America/Bahia): "hoje" é o hoje de
// quem está na feira, não o do servidor nem o do telefone em viagem.

export type PeriodKey = "hoje" | "semana" | "mes" | "mes_passado";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "7 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
];

export function ilhaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bahia" });
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function periodRange(key: PeriodKey): { from: string; to: string } {
  const today = ilhaToday();
  const [y, m] = today.split("-").map(Number);

  switch (key) {
    case "hoje":
      return { from: today, to: today };
    case "semana":
      return { from: shiftDays(today, -6), to: today };
    case "mes":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "mes_passado": {
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const first = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
      const last = shiftDays(`${today.slice(0, 7)}-01`, -1);
      return { from: first, to: last };
    }
  }
}

// "2026-09-05" → "05/09"
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export const DOW_LABELS = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
