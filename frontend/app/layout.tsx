import './globals.css';
import type { Metadata } from 'next';
import AuthButton from '../components/AuthButton';

export const metadata: Metadata = {
  title: 'Mercado Ilha',
  description: 'Marketplace para Mercado Ilha con Supabase',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header style={{ borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1.25rem' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/" style={{ fontWeight: 700 }}>Mercado Ilha</a>
            <nav>
              <AuthButton />
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
