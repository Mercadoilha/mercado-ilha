import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BottomNav from "../components/BottomNav";
import RegisterSW from "../components/RegisterSW";
import InstallProgressBar from "../components/InstallProgressBar";
import VisitTracker from "../components/VisitTracker";
import { SessionProvider } from "../contexts/SessionContext";

export const viewport: Viewport = {
  themeColor: "#185FA5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ),
  title: "Mercado Ilha",
  description: "Marketplace de Tinharé. Compre, venda e encontre serviços na ilha.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mercado Ilha",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Mercado Ilha",
    description: "Marketplace de Tinharé",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/icon-192.png", width: 192, height: 192, type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* CSS crítico INLINE de la cortina de entrada (azul + logo). Va acá, no en
            globals.css, para que se pinte en el PRIMER paint sin depender de la carga del
            stylesheet externo hasheado. Antes la cortina vivía solo en globals.css: cuando ese
            archivo tardaba (p. ej. tras un bump de versión del service worker que vacía su
            caché), la primera pintura salía en blanco y el azul aparecía recién al llegar el
            CSS. Estos mismos valores están replicados en globals.css (idénticos → no reinician
            la animación). Azul hardcodeado (#185FA5) porque la variable --blue-main también
            vive en el CSS externo. Respeta standalone / android-pwa / reduced-motion. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              "#browser-splash{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:#185FA5;animation:browser-splash-out 700ms ease-out forwards;pointer-events:none}#browser-splash img{width:auto;height:64px}@keyframes browser-splash-out{0%,45%{opacity:1}100%{opacity:0;visibility:hidden}}@media (display-mode:standalone){#browser-splash{display:none}}html.android-pwa #browser-splash{display:flex}@media (prefers-reduced-motion:reduce){#browser-splash{display:none}}",
          }}
        />
        {/* Android PWA: el splash nativo solo pinta el ícono cuadrado (la bolsa), no admite
            imagen propia como iOS. Este script (síncrono, corre antes del primer paint) marca
            <html> cuando es Android instalado; el CSS muestra ahí la cortina con el logo
            completo (igual al splash de iPhone). Solo togglea una clase: si fallara, la cortina
            queda oculta (comportamiento actual) — nunca puede trabar la app. El fade sigue
            siendo 100% CSS. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(/android/i.test(navigator.userAgent)&&matchMedia('(display-mode: standalone)').matches){document.documentElement.className+=' android-pwa'}}catch(e){}",
          }}
        />
        {/* Captura temprana del prompt de instalación (Android/Chrome). El evento
            `beforeinstallprompt` se dispara una sola vez, muy pronto, y NO se repite en
            las navegaciones internas de Next. Este script síncrono lo guarda en
            window.__deferredInstallPrompt antes de que React monte, para que el botón
            "Instalar App" siga funcionando aunque el usuario navegue a /instalar.
            Ver lib/installPrompt.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.__deferredInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredInstallPrompt=e;window.dispatchEvent(new Event('bip-ready'))});window.addEventListener('appinstalled',function(){window.__deferredInstallPrompt=null});",
          }}
        />
        {/* Fix bug conocido de Safari mobile (solo navegador, no PWA instalado): en la carga
            inicial la barra de Safari a veces queda "expandida" tapando parte del banner azul
            del topo, y solo se acomoda cuando el usuario hace scroll. Un scroll de 1px, forzado
            apenas termina de cargar, hace que Safari recalcule su chrome sin que se note
            (overscroll-behavior:none evita cualquier rebote visible). No corre en standalone
            (ahí no existe esa barra) y no bloquea ni retrasa nada del render. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(!matchMedia('(display-mode: standalone)').matches){addEventListener('load',function(){if(scrollY===0)scrollTo(0,1)})}",
          }}
        />
        {/* Pre-establish connections to external services before JS executes */}
        <link rel="preconnect" href="https://ywminblmiwjsxbntszbc.supabase.co" />
        <link rel="dns-prefetch" href="https://ywminblmiwjsxbntszbc.supabase.co" />
        <link rel="preconnect" href="https://pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev" crossOrigin="" />
        <link rel="dns-prefetch" href="https://pub-d6279f6f1d8b4352953818cd9e119e87.r2.dev" />
        {/* Startup images de iOS (T8 V2): iOS no usa background_color del manifest; sin
            estos el PWA abre en blanco. Tags estáticos (cero costo de runtime); si un
            tamaño no matchea, iOS cae al blanco actual (nunca peor). Android/desktop los
            ignoran. PNGs generados con sharp: logo.svg centrado sobre #185FA5. */}
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-750-1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125-2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-828-1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1242-2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1170-2532.png" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1284-2778.png" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1179-2556.png" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        <link rel="apple-touch-startup-image" href="/splash/apple-splash-1290-2796.png" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
      </head>
      <body>
        {/* Cortina azul de entrada solo-navegador (pedida por el usuario 2026-07-08). El PWA
            instalado ya tiene su splash nativo del OS (apple-touch-startup-image arriba /
            background_color del manifest en Android) — @media (display-mode: standalone) la
            oculta por completo ahí (CSS, evaluado antes del primer paint). En navegador cubre
            con la marca el arranque y se desvanece SOLA con una animación CSS (sin JS): así es
            imposible que quede trabada tapando la app si algo fallara, y no hay riesgo de
            mismatch de hidratación. Solo aparece en la carga real (hard load); el RootLayout
            no se remonta en la navegación interna, así que NO reaparece entre rutas → cero
            impacto en la velocidad de navegación. */}
        <div id="browser-splash" aria-hidden="true">
          <img src="/logo.svg" alt="" />
        </div>
        <SessionProvider>
          {children}
          <BottomNav />
          <RegisterSW />
          <InstallProgressBar />
          <VisitTracker />
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
