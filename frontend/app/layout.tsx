import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BottomNav from "../components/BottomNav";
import RegisterSW from "../components/RegisterSW";
import SplashScreen from "../components/SplashScreen";
import SplashSponsorSync from "../components/SplashSponsorSync";
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
  description: "Marketplace de Tinharé — Morro de São Paulo. Compre, venda e encontre serviços na ilha.",
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
    description: "Marketplace de Tinharé — Morro de São Paulo",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/icon-192.png", width: 192, height: 192, type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
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
        <SplashScreen />
        <SessionProvider>
          {children}
          <BottomNav />
          <RegisterSW />
          <SplashSponsorSync />
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
