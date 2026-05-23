"use client";

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { data, error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Revisa tu correo para el enlace mágico (magic link).');
  };

  return (
    <main className="page-container">
      <h1>Iniciar sesión</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420 }}>
        <label htmlFor="email">Correo electrónico</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }} required />
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
          {loading ? 'Enviando...' : 'Enviar enlace'}
        </button>
      </form>
      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </main>
  );
}
