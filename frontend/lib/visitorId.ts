/**
 * Anonymous visitor id, persisted in localStorage.
 *
 * Used only for tracking metrics (WhatsApp clicks, banner clicks, views).
 * It is NOT tied to identity — just a stable random id so we can tell
 * "how many distinct visitors" apart from "how many raw clicks".
 *
 * Returns null on the server / when localStorage is unavailable.
 */
const KEY = "mi_visitor_id";

const SESSION_KEY = "mi_session_id";

function randomId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = randomId("v");
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Id de la sesión actual (sessionStorage): muere al cerrar la pestaña.
 * Sirve para separar "cuántas veces entraron al app" de "cuántas
 * pantallas abrieron" — un mismo visitor_id puede tener N sesiones.
 */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId("s");
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
