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

export function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
