'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getIngredientData } from '@/lib/product-ingredients';
import { imgUrl } from '@/lib/image-url';
import type { Product } from '@/types';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const router = useRouter();
  const ingredientData = getIngredientData(product.name);
  const baseVariant    = product.variants[0];
  const hasCombo       = product.variants.some(v => /combo/i.test(v.name));
  const hasHot         = product.variants.some(v => /hot/i.test(v.name));

  return (
    <div
      onClick={() => router.push(`/menu/${product.id}`)}
      className="product-card surface-paper flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
    >
      {/* Imagen */}
      <div className="relative h-44 bg-gradient-to-br from-[#FFF8F1] to-[#F3E6D7] overflow-hidden">
        {product.image_url ? (
          <Image src={imgUrl(product.image_url)!} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl select-none">🍗</div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {hasHot && (
            <span className="bg-brand-red text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
              🌶️ HOT
            </span>
          )}
          {hasCombo && (
            <span className="bg-black/55 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide backdrop-blur-sm">
              + Combo
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-display text-4xl text-brand-ink leading-none mb-2">{product.name}</h3>

        {/* Preview ingredientes */}
        {ingredientData ? (
          <p className="text-brand-muted text-xs leading-relaxed flex-1 mb-3 line-clamp-2">
            {ingredientData.items.join(' · ')}
          </p>
        ) : (
          <p className="text-brand-muted text-xs leading-relaxed flex-1 mb-3">
            {product.description ?? 'Hecho para pedir rápido y comer mejor.'}
          </p>
        )}

        {/* Precio + botón */}
        <div className="flex items-center justify-between mt-auto">
          <div>
            <span className="text-brand-ink font-black text-2xl">${baseVariant.price}</span>
            {hasCombo && (
              <span className="ml-2 text-brand-muted text-xs">
                Combo ${product.variants.find(v => /combo/i.test(v.name))?.price}
              </span>
            )}
          </div>
          <div className="w-11 h-11 rounded-2xl bg-brand-red text-white font-black text-2xl flex items-center justify-center shadow-md shadow-brand-red/20">
            +
          </div>
        </div>
      </div>
    </div>
  );
}
