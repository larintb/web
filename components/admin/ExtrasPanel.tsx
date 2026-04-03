'use client';

import { useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Extra } from '@/types';

interface Props {
  extras:   Extra[];
  onChange: (extras: Extra[]) => void;
}

const EMPTY: Omit<Extra, 'id'> = {
  name:          '',
  price:         0,
  image_url:     null,
  active:        true,
  display_order: 0,
};

export default function ExtrasPanel({ extras, onChange }: Props) {
  const [modal, setModal]           = useState<'create' | 'edit' | null>(null);
  const [form, setForm]             = useState<Omit<Extra, 'id'>>({ ...EMPTY });
  const [editId, setEditId]         = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  function openCreate() {
    setForm({ ...EMPTY });
    setEditId(null);
    setModal('create');
  }

  function openEdit(e: Extra) {
    setForm({ name: e.name, price: e.price, image_url: e.image_url, active: e.active, display_order: e.display_order });
    setEditId(e.id);
    setModal('edit');
  }

  function closeModal() { setModal(null); setEditId(null); }

  async function toggleActive(e: Extra) {
    onChange(extras.map(x => x.id === e.id ? { ...x, active: !x.active } : x));
    const supabase = createClient();
    await supabase.from('extras').update({ active: !e.active }).eq('id', e.id);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const payload = {
      name:          form.name.trim(),
      price:         form.price,
      image_url:     form.image_url?.trim() || null,
      active:        form.active,
      display_order: form.display_order,
    };

    if (modal === 'create') {
      const { data } = await supabase.from('extras').insert(payload).select().single();
      if (data) onChange([...extras, data as Extra]);
    } else if (editId) {
      await supabase.from('extras').update(payload).eq('id', editId);
      onChange(extras.map(e => e.id === editId ? { ...e, ...payload } : e));
    }

    setSaving(false);
    closeModal();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('extras').delete().eq('id', id);
    onChange(extras.filter(e => e.id !== id));
    setConfirmDel(null);
  }

  const sorted = [...extras].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-5xl text-brand-ink leading-none">Extras</h2>
        <button
          onClick={openCreate}
          className="bg-brand-orange text-white font-bold px-5 py-2.5 rounded-full text-sm hover:opacity-90 transition-opacity active:scale-95"
        >
          + Nuevo extra
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-brand-muted italic">Sin extras registrados</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(e => (
            <div
              key={e.id}
              className={`surface-paper border rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${!e.active ? 'opacity-50' : ''}`}
            >
              {/* Imagen */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-brand-paper flex-shrink-0 border border-brand-line">
                {e.image_url ? (
                  <Image src={e.image_url} alt={e.name} width={56} height={56} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">➕</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-brand-ink text-sm truncate">{e.name}</p>
                <p className="text-xs text-brand-muted mt-0.5">${e.price} MXN</p>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleActive(e)}
                  title={e.active ? 'Desactivar' : 'Activar'}
                  className={`relative w-10 h-5 rounded-full transition-all duration-200 ${e.active ? 'bg-green-500' : 'bg-brand-line'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${e.active ? 'left-5' : 'left-0.5'}`} />
                </button>

                <button
                  onClick={() => openEdit(e)}
                  className="w-8 h-8 rounded-xl bg-brand-paper border border-brand-line flex items-center justify-center text-brand-muted hover:text-brand-ink hover:border-brand-ink transition-colors text-sm"
                >
                  ✏️
                </button>

                {confirmDel === e.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(e.id)} className="text-xs bg-brand-red text-white px-2 py-1 rounded-lg font-bold hover:bg-brand-dark transition-colors">Sí</button>
                    <button onClick={() => setConfirmDel(null)} className="text-xs text-brand-muted px-2 py-1 rounded-lg hover:text-brand-ink transition-colors">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDel(e.id)}
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-4xl text-brand-ink leading-none">
                  {modal === 'create' ? 'Nuevo extra' : 'Editar extra'}
                </h3>
                <button onClick={closeModal} className="text-brand-muted hover:text-brand-ink transition-colors text-xl">✕</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                    placeholder="Ej. Salsa Buffalo"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Precio (MXN) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">URL de imagen</label>
                  <input
                    value={form.image_url ?? ''}
                    onChange={e => setForm({ ...form, image_url: e.target.value })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink text-sm focus:outline-none focus:border-brand-red transition-colors"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-1.5 block">Orden de aparición</label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                    className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>

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

              <div className="flex gap-3 mt-6">
                <button onClick={closeModal} className="flex-1 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink hover:border-brand-ink transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 py-3 rounded-2xl bg-brand-orange text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : modal === 'create' ? 'Crear extra' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
