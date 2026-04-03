'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/store/cart';
import ProductCard from '@/components/ProductCard';
import CartDrawer from '@/components/CartDrawer';
import type { Category, Product } from '@/types';

const CATEGORY_META: Record<string, { subtitle: string; gradient: string; emoji: string; image?: string }> = {
  'Chicken Tenders':  { subtitle: 'Crujientes y clásicos', gradient: 'from-[#F3E2D3] to-[#FFF7EF]', emoji: '🍗', image: '/images/chicken_tenders.jpeg' },
  'Chicken Sandwich': { subtitle: 'Brioche y sabor',       gradient: 'from-[#F1E0C8] to-[#FFF7EF]', emoji: '🥪', image: '/images/chicken_sandwich.jpeg' },
  'Fries':            { subtitle: 'Papas y dips',          gradient: 'from-[#F5E7B8] to-[#FFF7EF]', emoji: '🍟', image: '/images/fries.jpeg' },
  'Bebidas':          { subtitle: 'Para acompañar',        gradient: 'from-[#DCEBFF] to-[#FFF7EF]', emoji: '🥤', image: '/images/drinks.png' },
};

function getCategoryMeta(category: Category, productCount: number) {
  return CATEGORY_META[category.name] ?? {
    subtitle: productCount > 1 ? `${productCount} opciones` : 'Una opción',
    gradient: 'from-[#F4EFE8] to-[#FFF9F2]',
    emoji: category.emoji,
  };
}

export default function MenuPage() {
  const router       = useRouter();
  const deliveryType = useCart(s => s.deliveryType);
  const items        = useCart(s => s.items);
  const total        = useCart(s => s.total);

  const [categories,     setCategories]     = useState<Category[]>([]);
  const [products,       setProducts]       = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [cartOpen,       setCartOpen]       = useState(false);
  const [loading,        setLoading]        = useState(true);

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

  const itemCount        = items.reduce((s, i) => s + i.qty, 0);
  const categoryProducts = activeCategory
    ? products.filter(p => p.category_id === activeCategory.id)
    : [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-paper">
      <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-brand-paper/95 backdrop-blur border-b border-brand-line/80">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activeCategory && (
              <button
                onClick={() => setActiveCategory(null)}
                className="text-brand-muted hover:text-brand-ink transition-colors text-xl mr-1"
              >←</button>
            )}
            <div>
              <Image src="/images/logo.png" alt="Crispy Charles" width={120} height={48} className="object-contain" />
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand-muted mt-0.5">
                {activeCategory ? activeCategory.name : 'Menu'}
              </p>
            </div>
          </div>

          {/* Carrito */}
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 bg-brand-red hover:bg-brand-dark text-white font-bold px-4 py-2.5 rounded-full transition-all active:scale-95 shadow-lg shadow-brand-red/15"
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

      <main className="max-w-3xl mx-auto px-4 pb-28 pt-4">

        {/* ══════ VISTA: GRID DE CATEGORÍAS ══════ */}
        {!activeCategory && (
          <>
            {/* Hero banner */}
            <div className="my-5 rounded-[32px] overflow-hidden bg-gradient-to-r from-[#E63232] to-[#FFB35C] p-6 flex items-end justify-between min-h-[160px] shadow-xl shadow-brand-red/10">
              <div>
                <p className="text-white/80 text-xs uppercase tracking-[0.28em] mb-2">Crispy Charles</p>
                <h2 className="font-display text-7xl text-white leading-none drop-shadow-sm">Menu</h2>
              </div>
              <div className="relative w-36 h-36 flex-shrink-0 -mr-4 -mb-6 overflow-hidden">
                <Image
                  src="/images/menu.png"
                  alt="Tender"
                  fill
                  className="object-contain scale-[2.1] -translate-y-2 drop-shadow-2xl"
                />
              </div>
            </div>

            <h2 className="text-xs uppercase tracking-[0.3em] text-brand-muted mb-4">Categorias</h2>
            <div className="grid grid-cols-2 gap-4">
              {categories.map(cat => {
                const catProducts = products.filter(p => p.category_id === cat.id);
                const meta = getCategoryMeta(cat, catProducts.length);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat)}
                    className="group relative surface-paper rounded-[30px] overflow-hidden text-left transition-all duration-200 hover:scale-[1.01] hover:border-brand-red/30 active:scale-[0.98]"
                  >
                    <div className={`relative h-44 bg-gradient-to-br ${meta.gradient} flex items-center justify-center overflow-hidden`}>
                      {meta.image ? (
                        <Image
                          src={meta.image}
                          alt={cat.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-7xl select-none drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                          {meta.emoji}
                        </span>
                      )}
                      <span className="absolute top-3 right-3 bg-white/70 backdrop-blur-sm text-brand-ink text-[10px] font-bold px-2.5 py-1 rounded-full border border-brand-line z-10">
                        {catProducts.length}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-display text-4xl text-brand-ink leading-none">{cat.name}</h3>
                      <p className="text-brand-muted text-xs mt-1 uppercase tracking-[0.2em]">{meta.subtitle}</p>
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
              const meta = CATEGORY_META[activeCategory.name] ?? { gradient: 'from-[#F4EFE8] to-[#FFF9F2]', emoji: activeCategory.emoji, subtitle: 'Opciones del menú' };
              return (
                <div className="relative rounded-[32px] overflow-hidden mb-6 surface-paper">
                  {meta.image ? (
                    <div className="relative h-36">
                      <Image src={meta.image} alt={activeCategory.name} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20 p-6 flex items-center">
                        <div>
                          <h2 className="font-display text-6xl text-white leading-none">{activeCategory.name}</h2>
                          <p className="text-white/70 text-xs uppercase tracking-[0.22em] mt-1">{meta.subtitle}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`bg-gradient-to-r ${meta.gradient} p-6 flex items-center gap-4`}>
                      <span className="text-6xl">{meta.emoji}</span>
                      <div>
                        <h2 className="font-display text-6xl text-brand-ink leading-none">{activeCategory.name}</h2>
                        <p className="text-brand-muted text-xs uppercase tracking-[0.22em] mt-1">{meta.subtitle}</p>
                      </div>
                    </div>
                  )}
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
            className="w-full bg-brand-red text-white font-black py-4 rounded-full text-lg shadow-lg shadow-brand-red/20 active:scale-95 transition-all flex items-center justify-between px-6"
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
