'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLoginPage() {
  const router   = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError('Credenciales incorrectas');
      setLoading(false);
      return;
    }

    router.push('/admin');
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-5xl mb-3">🍗</p>
          <h1 className="text-3xl font-black fire-text">Crispy Charles</h1>
          <p className="text-gray-400 mt-1">Panel de administrador</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-brand-gray border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-red transition-colors"
              placeholder="admin@crispycharles.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-brand-gray border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-red transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-3 text-brand-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-lg mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
