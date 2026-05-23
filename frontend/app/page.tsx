import Link from 'next/link';

export default function Home() {
  return (
    <main className="page-container">
      <section>
        <h1>Mercado Ilha</h1>
        <p>Marketplace con Supabase. Esta es la primera fase de la interfaz.</p>
        <div className="card-grid">
          <Link className="card" href="/listings">
            <h2>Listados</h2>
            <p>Ver anuncios activos y navegar por categorías.</p>
          </Link>
          <Link className="card" href="/profile">
            <h2>Mi perfil</h2>
            <p>Accede a tu cuenta, favoritos y conversaciones.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
