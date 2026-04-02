'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/store/cart';
import type { Settings } from '@/types';

export default function LandingPage() {
  const router   = useRouter();
  const setType  = useCart(s => s.setDeliveryType);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => { setSettings(data); setLoading(false); });
  }, []);

  function choose(type: 'pickup' | 'delivery') {
    const fee = type === 'delivery' ? (settings?.delivery_fee ?? 80) : 0;
    setType(type, fee);
    router.push('/menu');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-black">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Negocio cerrado
  if (!settings?.business_open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-6 text-center">
        <div className="text-7xl mb-6">🔒</div>
        <h1 className="text-3xl font-black mb-3">Estamos cerrados</h1>
        <p className="text-gray-400 text-lg max-w-sm">
          {settings?.closed_message ?? 'Gracias por visitarnos. ¡Vuelve pronto!'}
        </p>
        <div className="mt-6 bg-brand-gray rounded-2xl px-6 py-4">
          <p className="text-sm text-gray-400 mb-1">Horarios de atención</p>
          <p className="text-white font-semibold">{settings?.business_hours}</p>
        </div>
        <p className="mt-8 text-brand-red font-bold text-lg fire-text">Crispy Charles 🔥</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black px-6">
      {/* Logo / Header */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🍗</div>
        <h1 className="text-5xl font-black tracking-tight fire-text">Crispy Charles</h1>
        <p className="text-gray-400 mt-2 text-lg">Sabor que cruje 🔥</p>
      </div>

      {/* Elegir tipo de entrega */}
      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-gray-300 font-medium mb-6 text-lg">¿Cómo quieres tu pedido?</p>

        {settings?.pickup_enabled && (
          <button
            onClick={() => choose('pickup')}
            className="w-full bg-brand-gray hover:bg-brand-card border border-white/10 hover:border-brand-red/50 rounded-2xl p-5 text-left transition-all duration-200 group active:scale-95"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">🏪</span>
              <div>
                <p className="text-white font-bold text-xl group-hover:text-brand-red transition-colors">Recoger en tienda</p>
                <p className="text-gray-400 text-sm">Pasa por tu pedido cuando esté listo</p>
              </div>
              <span className="ml-auto text-gray-600 group-hover:text-brand-red transition-colors text-2xl">→</span>
            </div>
          </button>
        )}

        {settings?.delivery_enabled && (
          <button
            onClick={() => choose('delivery')}
            className="w-full bg-brand-gray hover:bg-brand-card border border-white/10 hover:border-brand-orange/50 rounded-2xl p-5 text-left transition-all duration-200 group active:scale-95"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">🛵</span>
              <div>
                <p className="text-white font-bold text-xl group-hover:text-brand-orange transition-colors">Domicilio</p>
                <p className="text-gray-400 text-sm">
                  Te lo llevamos — costo de envío{' '}
                  <span className="text-brand-orange font-semibold">${settings.delivery_fee}</span>
                </p>
              </div>
              <span className="ml-auto text-gray-600 group-hover:text-brand-orange transition-colors text-2xl">→</span>
            </div>
          </button>
        )}
      </div>

      <p className="mt-12 text-gray-600 text-sm">
        {settings?.business_hours}
      </p>
    </div>
  );
}
