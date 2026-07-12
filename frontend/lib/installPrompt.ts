import type { BeforeInstallPromptEvent } from "./platform";

/**
 * Captura centralizada del evento `beforeinstallprompt` (Android/Chrome).
 *
 * Por qué existe: el navegador dispara `beforeinstallprompt` UNA sola vez y muy
 * temprano en la carga del documento, y NO lo vuelve a disparar en las navegaciones
 * client-side de Next.js. Si cada componente lo escuchara solo cuando se monta
 * (useEffect), lo perdería: al pasar de la home a /instalar (misma página, sin
 * recargar) el evento ya ocurrió y el botón quedaba inerte.
 *
 * Solución: un script inline en <head> (ver app/layout.tsx) lo captura sincrónicamente
 * ANTES de React, lo guarda en `window.__deferredInstallPrompt` y emite `bip-ready`.
 * Este módulo es la interfaz para leer/consumir ese evento desde cualquier componente.
 */

type WithPrompt = Window & {
  __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
};

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return (window as WithPrompt).__deferredInstallPrompt ?? null;
}

export function clearInstallPrompt(): void {
  if (typeof window === "undefined") return;
  (window as WithPrompt).__deferredInstallPrompt = null;
}

/**
 * Suscribe a cambios de disponibilidad del prompt: se dispara cuando el evento
 * queda capturado (`bip-ready`) o cuando la app se instala (`appinstalled`).
 * Devuelve la función para desuscribirse.
 */
export function onInstallPromptChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("bip-ready", cb);
  window.addEventListener("appinstalled", cb);
  return () => {
    window.removeEventListener("bip-ready", cb);
    window.removeEventListener("appinstalled", cb);
  };
}

/**
 * Dispara el prompt nativo de instalación. Debe llamarse dentro de un gesto del
 * usuario (click). Devuelve true si el usuario aceptó instalar, false si no había
 * prompt disponible o lo rechazó.
 */
export async function triggerInstall(): Promise<boolean> {
  const prompt = getInstallPrompt();
  if (!prompt) return false;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  clearInstallPrompt();
  return choice.outcome === "accepted";
}
