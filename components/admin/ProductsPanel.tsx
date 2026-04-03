'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Category, Product, ProductVariant } from '@/types';

interface Props {
  categories: Category[];
  products:   Product[];
  onChange:   (products: Product[]) => void;
}

const EMPTY_PRODUCT = {
  name:          '',
  description:   '',
  category_id:   '',
  image_url:     '',
  display_order: 0,
  active:        true,
  variants:      [{ name: 'Regular', price: 0 }] as ProductVariant[],
};

export default function ProductsPanel({ categories, products, onChange }: Props) {
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [form, setForm]         = useState(EMPTY_PRODUCT);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...EMPTY_PRODUCT, category_id: categories[0]?.id ?? '', variants: [{ name: 'Regular', price: 0 }] });
    setEditId(null);
    setModal('create');
  }

  function openEdit(p: Product) {
    setForm({
      name:          p.name,
      description:   p.description ?? '',
      category_id:   p.category_id,
      image_url:     p.image_url ?? '',
      display_order: p.display_order,
      active:        p.active,
      variants:      p.variants.length ? p.variants : [{ name: 'Regular', price: 0 }],
    });
    setEditId(p.id);
    setModal('edit');
  }

  function closeModal() { setModal(null); setEditId(null); }

  // ── Toggle activo ─────────────────────────────────────────────────────────

  async function toggleActive(p: Product) {
    const updated = products.map(x => x.id === p.id ? { ...x, active: !x.active } : x);
    onChange(updated);
    const supabase = createClient();
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
  }

  // ── Guardar (crear / editar) ──────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim() || !form.category_id) return;
    setSaving(true);
    const supabase = createClient();

    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      category_id:   form.category_id,
      image_url:     form.image_url.trim() || null,
      display_order: form.display_order,
      active:        form.active,
      variants:      form.variants.filter(v => v.name.trim()),
    };

    if (modal === 'create') {
      const { data } = await supabase.from('products').insert(payload).select('*, categories(*)').single();
      if (data) onChange([...products, data as Product]);
    } else if (editId) {
      await supabase.from('products').update(payload).eq('id', editId);
      onChange(products.map(p => p.id === editId ? { ...p, ...payload } : p));
    }

    setSaving(false);
    closeModal();
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    onChange(products.filter(p => p.id !== id));
    setConfirmDel(null);
  }

  // ── Variantes helpers ─────────────────────────────────────────────────────

  function setVariant(i: number, field: keyof ProductVariant, value: string | number) {
    const variants = form.variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v);
    setForm({ ...form, variants });
  }

  function addVariant() {
    setForm({ ...form, variants: [...form.variants, { name: '', price: 0 }] });
  }

  function removeVariant(i: number) {
    if (form.variants.length <= 1) return;
    setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const byCategory = categories.map(cat => ({
    cat,
    prods: products.filter(p => p.category_id === cat.id).sort((a, b) => a.display_order - b.display_order),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-5xl text-brand-ink leading-none">Productos</h2>
        <button
          onClick={openCreate}
          className="bg-brand-red text-white font-bold px-5 py-2.5 rounded-full text-sm hover:bg-brand-dark transition-colors active:scale-95"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Lista por categoría */}
      <div className="space-y-8">
        {byCategory.map(({ cat, prods }) => (
          <div key={cat.id}>
            <h3 className="text-xs uppercase tracking-[0.28em] text-brand-muted mb-3 flex items-center gap-2">
              <span>{cat.emoji}</span> {cat.name}
              <span className="bg-brand-line rounded-full px-2 py-0.5 text-[10px] font-bold">{prods.length}</span>
            </h3>

            {prods.length === 0 ? (
              <p className="text-sm text-brand-muted pl-6 italic">Sin productos en esta categoría</p>
            ) : (
              <div className="space-y-2">
                {prods.map(p => (
                  <div
                    key={p.id}
                    className={`surface-paper border rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${!p.active ? 'opacity-50' : ''}`}
                  >
                    {/* Imagen */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-paper flex-shrink-0 border border-brand-line">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">{cat.emoji}</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-brand-ink text-sm leading-tight truncate">{p.name}</p>
                      <p className="text-xs text-brand-muted mt-0.5">
                        {p.variants.map(v => `${v.name} $${v.price}`).join(' · ')}
                      </p>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle activo */}
                      <button
                        onClick={() => toggleActive(p)}
                        title={p.active ? 'Desactivar' : 'Activar'}
                        className={`relative w-10 h-5 rounded-full transition-all duration-200 flex-shrink-0 ${p.active ? 'bg-green-500' : 'bg-brand-line'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${p.active ? 'left-5' : 'left-0.5'}`} />
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() => openEdit(p)}
                        className="w-8 h-8 rounded-xl bg-brand-paper border border-brand-line flex items-center justify-center text-brand-muted hover:text-brand-ink hover:border-brand-ink transition-colors text-sm"
                      >
                        ✏️
                      </button>

                      {/* Eliminar */}
                      {confirmDel === p.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-xs bg-brand-red text-white px-2 py-1 rounded-lg font-bold hover:bg-brand-dark transition-colors"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="text-xs text-brand-muted px-2 py-1 rounded-lg hover:text-brand-ink transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(p.id)}
                          className="w-8 h-8 rounded-xl bg-brand-paper border border-brand-line flex items-center justify-center text-brand-muted hover:text-red-500 hover:border-red-300 transition-colors text-sm"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal crear / editar ────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-4xl text-brand-ink leading-none">
                  {modal === 'create' ? 'Nuevo producto' : 'Editar producto'}
                </h3>
                <button onClick={closeModal} className="text-brand-muted hover:text-brand-ink transition-colors text-xl">✕</button>
              </div>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                    placeholder="Ej. Classic Sandwich"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Descripción</label>
                  <input
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                    placeholder="Opcional"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Categoría *</label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Variantes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-[0.22em] text-brand-muted">Variantes *</label>
                    <button onClick={addVariant} className="text-xs text-brand-red font-bold hover:text-brand-dark transition-colors">+ Agregar</button>
                  </div>
                  <div className="space-y-2">
                    {form.variants.map((v, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={v.name}
                          onChange={e => setVariant(i, 'name', e.target.value)}
                          placeholder="Nombre (ej. Regular)"
                          className="flex-1 bg-brand-paper border border-brand-line rounded-xl px-3 py-2.5 text-brand-ink text-sm focus:outline-none focus:border-brand-red transition-colors"
                        />
                        <input
                          type="number"
                          value={v.price}
                          onChange={e => setVariant(i, 'price', Number(e.target.value))}
                          placeholder="Precio"
                          className="w-24 bg-brand-paper border border-brand-line rounded-xl px-3 py-2.5 text-brand-ink text-sm focus:outline-none focus:border-brand-red transition-colors"
                        />
                        {form.variants.length > 1 && (
                          <button
                            onClick={() => removeVariant(i)}
                            className="w-10 rounded-xl border border-brand-line text-brand-muted hover:text-red-500 hover:border-red-300 transition-colors text-sm flex items-center justify-center"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Imagen URL */}
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">URL de imagen</label>
                  <input
                    value={form.image_url}
                    onChange={e => setForm({ ...form, image_url: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink text-sm focus:outline-none focus:border-brand-red transition-colors"
                    placeholder="https://..."
                  />
                </div>

                {/* Display order */}
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Orden de aparición</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>

                {/* Activo */}
                <div className="flex items-center justify-between surface-paper border border-brand-line rounded-xl px-4 py-3">
                  <span className="font-semibold text-brand-ink text-sm">Visible en el menú</span>
                  <button
                    onClick={() => setForm({ ...form, active: !form.active })}
                    className={`relative w-10 h-5 rounded-full transition-all duration-200 ${form.active ? 'bg-green-500' : 'bg-brand-line'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${form.active ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink hover:border-brand-ink transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.category_id}
                  className="flex-1 py-3 rounded-2xl bg-brand-red text-white font-bold hover:bg-brand-dark transition-colors disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : modal === 'create' ? 'Crear producto' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
