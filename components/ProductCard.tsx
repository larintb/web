'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/store/cart';
import type { Product, ProductVariant } from '@/types';

interface Props {
  product: Product;
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
    <div className="product-card bg-brand-card border border-white/5 flex flex-col">
      {/* Imagen */}
      <div className="relative h-44 bg-brand-gray">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl select-none">
            🍗
          </div>
        )}
        {/* Badge HOT */}
        {selected.badge && (
          <span className="absolute top-2 right-2 bg-brand-orange text-white text-xs font-bold px-2 py-1 rounded-full">
            {selected.badge} HOT
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-white text-base leading-tight mb-1 uppercase tracking-wide">{product.name}</h3>
        {product.description && (
          <p className="text-gray-400 text-xs leading-relaxed mb-3 flex-1">{product.description}</p>
        )}

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
                    : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'
                }`}
              >
                {v.badge} {v.name}
              </button>
            ))}
          </div>
        )}

        {selected.includes && (
          <p className="text-brand-orange text-xs mb-3">⭐ {selected.includes}</p>
        )}

        {/* Precio + Agregar */}
        <div className="flex items-center justify-between mt-auto">
          <span className="text-white font-black text-xl">${selected.price}</span>
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
