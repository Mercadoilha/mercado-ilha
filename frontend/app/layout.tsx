import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mercado Ilha',
  description: 'Marketplace para Mercado Ilha con Supabase',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
