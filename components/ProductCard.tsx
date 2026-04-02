'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/store/cart';
import type { Product, ProductVariant } from '@/types';

interface Props {
  product: Product;
}

const PRODUCT_COPY: Record<string, string> = {
  tenders: 'Crujiente, jugoso y directo al punto.',
  combo: 'Porción completa para antojo grande.',
  sandwich: 'Pan suave, pollo crujiente y buen balance.',
  fries: 'Papas doradas con dip para acompañar.',
  bebida: 'Fría y lista para completar el pedido.',
  drink: 'Fría y lista para completar el pedido.',
};

function getShortDescription(product: Product) {
  if (product.description?.trim()) return product.description.trim();

  const haystack = `${product.name} ${product.categories?.name ?? ''}`.toLowerCase();

  const matched = Object.entries(PRODUCT_COPY).find(([key]) => haystack.includes(key));
  if (matched) return matched[1];

  return 'Hecho para pedir rápido y comer mejor.';
}

export default function ProductCard({ product }: Props) {
  const addItem = useCart(s => s.addItem);
  const [selected, setSelected] = useState<ProductVariant>(product.variants[0]);
  const [added, setAdded]       = useState(false);

  function handleAdd() {
    addItem({
      product_id:   product.id,
      product_name: product.name,
      variant_name: selected.name,
      unit_price:   selected.price,
      qty:          1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="product-card surface-paper flex flex-col">
      {/* Imagen */}
      <div className="relative h-44 bg-gradient-to-br from-[#FFF8F1] to-[#F3E6D7]">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl select-none">
            🍗
          </div>
        )}
        {/* Badge HOT */}
        {selected.badge && (
          <span className="absolute top-3 right-3 bg-brand-red text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.2em]">
            {selected.badge}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display text-4xl text-brand-ink leading-none mb-2">{product.name}</h3>
        <p className="text-brand-muted text-xs leading-relaxed mb-3 flex-1">
          {getShortDescription(product)}
        </p>

        {/* Variantes */}
        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {product.variants.map(v => (
              <button
                key={v.name}
                onClick={() => setSelected(v)}
                title={v.includes ?? ''}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                  selected.name === v.name
                    ? 'bg-brand-red text-white border-brand-red'
                    : 'bg-white text-brand-muted border-brand-line hover:border-brand-red/30'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        {selected.includes && (
          <p className="text-brand-red text-[11px] mb-3 uppercase tracking-[0.18em]">{selected.includes}</p>
        )}

        {/* Precio + Agregar */}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-brand-ink font-black text-2xl">${selected.price}</span>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 ${
              added
                ? 'bg-green-500 text-white scale-95'
                : 'bg-brand-red hover:bg-brand-dark text-white'
            }`}
          >
            {added ? '✓ Agregado' : '+ Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
