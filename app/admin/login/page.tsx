'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
    <div className="min-h-screen bg-brand-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Image src="/images/logo.png" alt="Crispy Charles" width={160} height={64} className="object-contain mx-auto mb-4" />
          <p className="text-xs uppercase tracking-[0.28em] text-brand-muted">Panel de administrador</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="surface-paper rounded-[28px] p-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
                placeholder="admin@crispycharles.com"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">Contraseña</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-brand-red/10 border border-brand-red/30 rounded-xl p-3 text-brand-red text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-lg"
          >
            {loading ? 'Entrando...' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
