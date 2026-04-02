'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/store/cart';
import ProductCard from '@/components/ProductCard';
import CartDrawer from '@/components/CartDrawer';
import type { Category, Product } from '@/types';

// Subtítulos y gradientes por categoría
const CATEGORY_META: Record<string, { subtitle: string; gradient: string; emoji: string }> = {
  'Chicken Tenders':  { subtitle: 'Tiras de pollo frito crujientes con dip',  gradient: 'from-red-900/80 to-brand-black', emoji: '🍗' },
  'Chicken Sandwich': { subtitle: 'En pan brioche o Texas toast',              gradient: 'from-orange-900/80 to-brand-black', emoji: '🥪' },
  'Fries':            { subtitle: 'Papas sazonadas y especiales',              gradient: 'from-yellow-900/80 to-brand-black', emoji: '🍟' },
  'Bebidas':          { subtitle: 'Refresco o jugo natural',                   gradient: 'from-blue-900/80 to-brand-black',   emoji: '🥤' },
};

export default function MenuPage() {
  const router       = useRouter();
  const deliveryType = useCart(s => s.deliveryType);
  const items        = useCart(s => s.items);
  const total        = useCart(s => s.total);

  const [categories,       setCategories]       = useState<Category[]>([]);
  const [products,         setProducts]         = useState<Product[]>([]);
  const [activeCategory,   setActiveCategory]   = useState<Category | null>(null);
  const [cartOpen,         setCartOpen]         = useState(false);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    if (!deliveryType) router.replace('/');
  }, [deliveryType, router]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('categories').select('*').eq('active', true).order('display_order'),
      supabase.from('products').select('*, categories(*)').eq('active', true).order('display_order'),
    ]).then(([{ data: cats }, { data: prods }]) => {
      setCategories(cats ?? []);
      setProducts(prods ?? []);
      setLoading(false);
    });
  }, []);

  const itemCount       = items.reduce((s, i) => s + i.qty, 0);
  const categoryProducts = activeCategory
    ? products.filter(p => p.category_id === activeCategory.id)
    : [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-black">
      <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-black">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-brand-black/95 backdrop-blur border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-gray-400 hover:text-white transition-colors text-xl mr-1"
              >←</button>
            )}
            <div>
              <h1 className="text-xl font-black fire-text">Crispy Charles</h1>
              <p className="text-xs text-gray-400">
                {deliveryType === 'pickup' ? '🏪 Recoger' : '🛵 Domicilio'}
                {activeCategory ? ` · ${activeCategory.name}` : ' · Menú'}
              </p>
            </div>
          </div>
          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-brand-red hover:bg-brand-dark text-white font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95"
          >
            <span>🛒</span>
            {itemCount > 0 && <span className="font-black">${total()}</span>}
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-28">

        {/* ══════ VISTA: GRID DE CATEGORÍAS ══════ */}
        {!activeCategory && (
          <>
            {/* Hero banner */}
            <div className="my-5 rounded-3xl overflow-hidden bg-gradient-to-r from-brand-red to-brand-orange p-6 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium mb-1">Sabor que cruje 🔥</p>
                <h2 className="text-3xl font-black text-white leading-tight">
                  ¿Qué se te<br />antoja hoy?
                </h2>
              </div>
              <span className="text-7xl select-none">🍗</span>
            </div>

            {/* Grid de categorías estilo Raising Cane's */}
            <h2 className="text-2xl font-black text-white mb-4">MENÚ</h2>
            <div className="grid grid-cols-2 gap-4">
              {categories.map(cat => {
                const meta = CATEGORY_META[cat.name] ?? {
                  subtitle: '',
                  gradient: 'from-gray-900/80 to-brand-black',
                  emoji: cat.emoji,
                };
                const catProducts = products.filter(p => p.category_id === cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat)}
                    className="group relative bg-brand-card border border-white/5 rounded-3xl overflow-hidden text-left transition-all duration-200 hover:scale-[1.02] hover:border-brand-red/40 hover:shadow-xl hover:shadow-brand-red/10 active:scale-[0.98]"
                  >
                    {/* Imagen / placeholder */}
                    <div className={`relative h-40 bg-gradient-to-b ${meta.gradient} flex items-center justify-center`}>
                      <span className="text-7xl select-none drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                        {meta.emoji}
                      </span>
                      {/* Badge de cantidad */}
                      <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                        {catProducts.length} items
                      </span>
                    </div>
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-black text-white text-base uppercase tracking-widest leading-tight">
                        {cat.name}
                      </h3>
                      <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                        {meta.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ══════ VISTA: PRODUCTOS DE UNA CATEGORÍA ══════ */}
        {activeCategory && (
          <div className="pt-5 animate-fade-in">
            {/* Categoría hero */}
            {(() => {
              const meta = CATEGORY_META[activeCategory.name] ?? { gradient: 'from-gray-900/60 to-brand-black', emoji: activeCategory.emoji, subtitle: '' };
              return (
                <div className={`rounded-3xl overflow-hidden bg-gradient-to-r ${meta.gradient} p-6 mb-6 flex items-center gap-4`}>
                  <span className="text-6xl">{meta.emoji}</span>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase">{activeCategory.name}</h2>
                    <p className="text-white/60 text-sm mt-0.5">{meta.subtitle}</p>
                  </div>
                </div>
              );
            })()}

            {/* Grid de productos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FAB carrito móvil */}
      {itemCount > 0 && !cartOpen && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-20 md:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-brand-red text-white font-black py-4 rounded-2xl text-lg shadow-lg shadow-brand-red/30 active:scale-95 transition-all flex items-center justify-between px-6"
          >
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm">{itemCount} items</span>
            <span>Ver carrito</span>
            <span className="font-black">${total()}</span>
          </button>
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
