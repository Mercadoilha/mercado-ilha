import "./globals.css";
import type { Metadata, Viewport } from "next";
import BottomNav from "../components/BottomNav";
import RegisterSW from "../components/RegisterSW";
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
    images: [{ url: "/icon-512.png", width: 512, height: 512, type: "image/png" }],
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
      </head>
      <body>
        <SessionProvider>
          {children}
          <BottomNav />
          <RegisterSW />
        </SessionProvider>
      </body>
    </html>
  );
}
