'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { imgUrl } from '@/lib/image-url';
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
      <div className="min-h-screen flex items-center justify-center bg-brand-paper">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Negocio cerrado
  if (!settings?.business_open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-paper px-6 text-center">
        <div className="text-7xl mb-6">🔒</div>
        <h1 className="font-display text-6xl text-brand-ink mb-2">Cerrado</h1>
        <p className="text-brand-muted text-base max-w-sm leading-relaxed">
          {settings?.closed_message ?? 'Gracias por visitarnos. ¡Vuelve pronto!'}
        </p>
        <div className="mt-6 surface-paper rounded-2xl px-6 py-4">
          <p className="text-xs uppercase tracking-[0.25em] text-brand-muted mb-2">Horario</p>
          <p className="text-brand-ink font-semibold">{settings?.business_hours}</p>
        </div>
        <p className="mt-8 text-brand-red font-bold text-lg font-display">Crispy Charles</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image src={imgUrl('logo.png')!} alt="Crispy Charles" width={200} height={100} className="object-contain" />
        </div>

        <div className="w-full space-y-4">

        {settings?.pickup_enabled && (
          <button
            onClick={() => choose('pickup')}
            className="w-full surface-paper hover:bg-white border border-brand-line rounded-[28px] p-5 text-left transition-all duration-200 group active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-red/10 flex items-center justify-center text-3xl">🏪</div>
              <div className="min-w-0">
                <p className="font-display text-4xl leading-none text-brand-ink">Recoger</p>
                <p className="text-brand-muted text-sm mt-1">Pasa por tu pedido</p>
              </div>
              <span className="ml-auto text-brand-red text-2xl">→</span>
            </div>
          </button>
        )}

        {settings?.delivery_enabled && (
          <button
            onClick={() => choose('delivery')}
            className="w-full surface-paper hover:bg-white border border-brand-line rounded-[28px] p-5 text-left transition-all duration-200 group active:scale-[0.98]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-orange/10 flex items-center justify-center text-3xl">🛵</div>
              <div className="min-w-0">
                <p className="font-display text-4xl leading-none text-brand-ink">Domicilio</p>
                <p className="text-brand-muted text-sm mt-1">Te lo llevamos</p>
              </div>
              <span className="ml-auto text-brand-red text-2xl">→</span>
            </div>
          </button>
        )}
        </div>

        <p className="mt-8 text-center text-xs uppercase tracking-[0.3em] text-brand-muted">
          {settings?.business_hours}
        </p>
      </div>
    </div>
  );
}
