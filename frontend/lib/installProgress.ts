/**
 * Estado del indicador de progreso de instalación (Android).
 *
 * Por qué existe: en Android, si el usuario toca un CTA "Instalar App" antes de que
 * Chrome haya disparado `beforeinstallprompt`, la regla del proyecto prohíbe navegar a
 * otra pantalla. En su lugar mostramos una barra fija arriba ("Preparando a instalação…")
 * mientras se espera el prompt, y disparamos la instalación sola al llegar. Este módulo
 * es el canal entre quien pide mostrar la barra (InstallCtaButton, desde cualquier parte
 * del árbol) y la barra en sí (InstallProgressBar, montada una vez en el layout).
 */

export type InstallProgressState =
  | { phase: "hidden" }
  | { phase: "preparing" }
  | { phase: "ready"; onTap: () => void };

const EVT = "install-progress";

let current: InstallProgressState = { phase: "hidden" };

export function getInstallProgress(): InstallProgressState {
  return current;
}

export function setInstallProgress(state: InstallProgressState): void {
  current = state;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<InstallProgressState>(EVT, { detail: state }));
}

/** Suscribe a los cambios de estado. Devuelve la función para desuscribirse. */
export function onInstallProgress(cb: (s: InstallProgressState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<InstallProgressState>).detail);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
