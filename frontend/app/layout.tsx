import "./globals.css";
import type { Metadata, Viewport } from "next";
import BottomNav from "../components/BottomNav";
import RegisterSW from "../components/RegisterSW";

export const viewport: Viewport = {
  themeColor: "#185FA5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
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
      { url: "/mercado-ilha-icone.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/mercado-ilha-icone.svg", type: "image/svg+xml" },
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    title: "Mercado Ilha",
    description: "Marketplace de Tinharé — Morro de São Paulo",
    type: "website",
    locale: "pt_BR",
    images: [{ url: "/logo.svg" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <BottomNav />
        <RegisterSW />
      </body>
    </html>
  );
}
