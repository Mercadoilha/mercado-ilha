export type Platform = "android" | "ios" | "other";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream) return "ios";
  return "other";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

/**
 * ¿El app ya está instalado en este dispositivo? Es más amplio que isStandalone():
 * detecta la PWA instalada AUNQUE se esté abriendo desde el navegador (ej. al entrar
 * por un link o escanear el QR con la cámara → abre en Chrome, no en la app instalada).
 * Usa navigator.getInstalledRelatedApps() (Chrome/Edge Android), que reporta la PWA como
 * instalada gracias a `related_applications` (platform "webapp") en el manifest. En iOS y
 * navegadores sin soporte no hay forma de saberlo desde el navegador → cae a isStandalone().
 */
export async function isAppInstalled(): Promise<boolean> {
  if (isStandalone()) return true;
  const nav = navigator as any;
  if (typeof nav.getInstalledRelatedApps === "function") {
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (Array.isArray(apps) && apps.some((a: any) => a.platform === "webapp")) {
        return true;
      }
    } catch {
      /* API no disponible o bloqueada: seguimos con el fallback */
    }
  }
  return false;
}

export type IosBrowser = "safari" | "chrome" | "firefox" | "edge" | "opera" | "other";

/**
 * Detecta el navegador dentro de iOS. En iOS la PWA solo se puede instalar desde
 * Safari; Chrome/Firefox/Edge/Opera usan el mismo motor pero NO ofrecen "Adicionar
 * à tela inicial". Se identifican por su marca en el user agent (CriOS, FxiOS, etc.).
 * Solo tiene sentido llamarla cuando detectPlatform() === "ios".
 */
export function detectIosBrowser(): IosBrowser {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return "chrome";
  if (/FxiOS/i.test(ua)) return "firefox";
  if (/EdgiOS/i.test(ua)) return "edge";
  if (/OPiOS|OPT\//i.test(ua)) return "opera";
  // Safari real: incluye "Safari" y "Version/". Los in-app webviews (Instagram,
  // Facebook) no traen "Version/" → se tratan como "other" (no-Safari).
  if (/Safari/i.test(ua) && /Version\//i.test(ua)) return "safari";
  return "other";
}

/** true solo en iPhone/iPad usando Safari (único navegador que instala la PWA en iOS). */
export function isIosSafari(): boolean {
  return detectPlatform() === "ios" && detectIosBrowser() === "safari";
}
