'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/store/cart';
import { getIngredientData } from '@/lib/product-ingredients';
import { imgUrl } from '@/lib/image-url';
import type { Product, Extra, ProductVariant } from '@/types';

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const addItem  = useCart(s => s.addItem);
  const addExtra = useCart(s => s.addExtra);

  const [product,  setProduct]  = useState<Product | null>(null);
  const [extras,   setExtras]   = useState<Extra[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [variant,   setVariant]   = useState<ProductVariant | null>(null);
  const [qty,       setQty]       = useState(1);
  const [selExtras, setSelExtras] = useState<Record<string, number>>({});
  const [added,     setAdded]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('products').select('*, categories(*)').eq('id', productId).single(),
      supabase.from('extras').select('*').eq('active', true).order('display_order'),
    ]).then(([{ data: prod }, { data: exts }]) => {
      setProduct(prod);
      setVariant(prod?.variants?.[0] ?? null);
      setExtras(exts ?? []);
      setLoading(false);
    });
  }, [productId]);

  if (loading || !product || !variant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-paper">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const ingredientData = getIngredientData(product.name);

  const extraTotal = Object.entries(selExtras).reduce((sum, [id, q]) => {
    const extra = extras.find(e => e.id === id);
    return sum + (extra?.price ?? 0) * q;
  }, 0);

  const lineTotal = variant.price * qty + extraTotal;

  function handleAdd() {
    if (!product || !variant) return;
    addItem({
      product_id:   product.id,
      product_name: product.name,
      variant_name: variant.name,
      unit_price:   variant.price,
      qty,
    });
    Object.entries(selExtras).forEach(([extra_id, q]) => {
      if (q <= 0) return;
      const extra = extras.find(e => e.id === extra_id);
      if (extra) addExtra({ extra_id, extra_name: extra.name, qty: q, unit_price: extra.price });
    });
    setAdded(true);
    setTimeout(() => router.back(), 900);
  }

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">

      {/* ── Hero image ── */}
      <div className="relative w-full bg-gradient-to-br from-[#F3E2D3] to-[#FFF7EF]"
        style={{ height: 'min(56vw, 400px)', minHeight: 220 }}>
        {product.image_url ? (
          <Image
            src={imgUrl(product.image_url, { width: 828, quality: 80 })!}
            alt={product.name}
            fill
            sizes="(max-width: 672px) 100vw, 672px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-9xl select-none">🍗</div>
        )}
        {/* Gradient fade al fondo */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-brand-paper to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center font-bold text-brand-ink shadow-md hover:bg-white transition-colors"
        >
          ←
        </button>
      </div>

      {/* ── Content ── */}
      <div className="max-w-2xl mx-auto pb-32">

        {/* Precio + Nombre */}
        <div className="px-5 pt-5 pb-5 border-b border-brand-line">
          <p className="text-brand-red font-black text-xl mb-1">${variant.price}</p>
          <h1 className="font-display text-7xl text-brand-ink leading-none">{product.name}</h1>
          {ingredientData && (
            <p className="text-brand-muted text-sm mt-2 leading-relaxed">
              {ingredientData.items.join(' · ')}
            </p>
          )}
        </div>

        {/* Variante selector */}
        {product.variants.length > 1 && (
          <div className="px-5 py-5 border-b border-brand-line">
            <h2 className="font-display text-4xl text-brand-ink leading-none mb-4">Elige tu variante</h2>
            <div className="flex flex-wrap gap-2.5">
              {product.variants.map(v => {
                const active = variant.name === v.name;
                return (
                  <button
                    key={v.name}
                    onClick={() => setVariant(v)}
                    className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                      active
                        ? 'border-brand-red bg-brand-red/5'
                        : 'border-brand-line bg-white hover:border-brand-red/40'
                    }`}
                  >
                    <span className={`font-bold text-sm ${active ? 'text-brand-red' : 'text-brand-ink'}`}>
                      {v.badge ? `${v.badge} ` : ''}{v.name}
                    </span>
                    <span className="text-brand-muted text-xs font-medium">${v.price}</span>
                    {v.includes && (
                      <span className="text-brand-muted text-[11px] mt-0.5 leading-tight">{v.includes}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ingredientes detallados */}
        {ingredientData && (
          <div className="px-5 py-5 border-b border-brand-line">
            <h2 className="font-display text-4xl text-brand-ink leading-none mb-4">Incluye</h2>
            <ul className="space-y-2.5">
              {ingredientData.items.map(ing => (
                <li key={ing} className="flex items-center gap-3 text-sm text-brand-ink">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange flex-shrink-0" />
                  {ing}
                </li>
              ))}
              {ingredientData.comboAdd && variant.name.toLowerCase().includes('combo') &&
                ingredientData.comboAdd.map(ing => (
                  <li key={ing} className="flex items-center gap-3 text-sm text-brand-red">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0" />
                    {ing}
                  </li>
                ))
              }
            </ul>
          </div>
        )}

        {/* Extras */}
        {extras.length > 0 && (
          <div className="px-5 py-5">
            <div className="mb-4">
              <h2 className="font-display text-4xl text-brand-ink leading-none">Extras</h2>
              <p className="text-brand-muted text-xs uppercase tracking-[0.2em] mt-1">Agrega lo que quieras</p>
            </div>
            <div className="space-y-0">
              {extras.map(extra => {
                const q = selExtras[extra.id] ?? 0;
                return (
                  <div key={extra.id} className="flex items-center gap-3 py-4 border-b border-brand-line last:border-0">
                    {/* Icono del extra */}
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-[#FFF8F1] to-[#F3E6D7] flex-shrink-0">
                      {extra.image_url ? (
                        <Image src={imgUrl(extra.image_url, { width: 96, quality: 75 })!} alt={extra.name} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🍶</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-brand-ink font-semibold text-sm">{extra.name}</p>
                      <p className="text-brand-red text-sm font-bold mt-0.5">+${extra.price}</p>
                    </div>
                    {q > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelExtras(s => ({ ...s, [extra.id]: Math.max(0, (s[extra.id] ?? 0) - 1) }))}
                          className="w-8 h-8 rounded-full border border-brand-line bg-white text-brand-ink font-bold flex items-center justify-center hover:border-brand-red transition-colors"
                        >−</button>
                        <span className="font-black text-sm w-4 text-center text-brand-ink">{q}</span>
                        <button
                          onClick={() => setSelExtras(s => ({ ...s, [extra.id]: (s[extra.id] ?? 0) + 1 }))}
                          className="w-8 h-8 rounded-full bg-brand-red text-white font-bold flex items-center justify-center hover:bg-brand-dark transition-colors"
                        >+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelExtras(s => ({ ...s, [extra.id]: 1 }))}
                        className="w-8 h-8 rounded-full border-2 border-brand-line bg-white text-brand-muted font-bold flex items-center justify-center hover:border-brand-red hover:text-brand-red transition-all text-xl leading-none"
                      >+</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Sticky bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-brand-paper/95 backdrop-blur border-t border-brand-line">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {/* Qty */}
          <div className="flex items-center gap-1.5 bg-white border border-brand-line rounded-2xl px-3 py-2.5 flex-shrink-0">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-brand-ink hover:bg-brand-red hover:text-white transition-colors text-lg leading-none"
            >−</button>
            <span className="font-black text-brand-ink w-6 text-center">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-brand-ink hover:bg-brand-red hover:text-white transition-colors text-lg leading-none"
            >+</button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={added}
            className={`flex-1 py-3.5 rounded-2xl font-black text-base transition-all active:scale-95 shadow-lg ${
              added
                ? 'bg-green-500 text-white shadow-green-500/20'
                : 'bg-brand-red hover:bg-brand-dark text-white shadow-brand-red/20'
            }`}
          >
            {added ? '✓ Agregado' : `Agregar al carrito  ·  $${lineTotal}`}
          </button>
        </div>
      </div>
    </div>
  );
}
