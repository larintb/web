'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order, Settings, OrderStatus, Session, SessionSummary } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  new:       '📋 Nueva',
  preparing: '👨‍🍳 Preparando',
  ready:     '✅ Lista',
  delivered: '🎉 Entregada',
};

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'delivered',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  new:       'bg-blue-500/20 border-blue-500/40 text-blue-300',
  preparing: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  ready:     'bg-green-500/20 border-green-500/40 text-green-300',
  delivered: 'bg-gray-500/20 border-gray-500/40 text-gray-400',
};

function fmt(date: string) {
  return new Date(date).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function duration(open: string, close: string | null) {
  const ms = new Date(close ?? new Date()).getTime() - new Date(open).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function buildSummary(orders: Order[]): SessionSummary {
  const cash_revenue   = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);
  const stripe_revenue = orders.filter(o => o.payment_method === 'stripe' && o.payment_status === 'paid').reduce((s, o) => s + o.total, 0);
  const delivery_fees  = orders.reduce((s, o) => s + (o.delivery_fee ?? 0), 0);

  // Items
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of orders) {
    for (const item of o.items ?? []) {
      const k = `${item.product_name} (${item.variant_name})`;
      if (!itemMap[k]) itemMap[k] = { qty: 0, revenue: 0 };
      itemMap[k].qty     += item.qty;
      itemMap[k].revenue += item.subtotal;
    }
  }

  // Extras
  const extraMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of orders) {
    for (const e of o.extras ?? []) {
      const k = e.extra_name;
      if (!extraMap[k]) extraMap[k] = { qty: 0, revenue: 0 };
      extraMap[k].qty     += e.qty;
      extraMap[k].revenue += e.subtotal;
    }
  }

  return {
    total_orders:   orders.length,
    total_revenue:  cash_revenue + stripe_revenue,
    cash_revenue,
    stripe_revenue,
    delivery_fees,
    items_sold:  Object.entries(itemMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.qty - a.qty),
    extras_sold: Object.entries(extraMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.qty - a.qty),
    orders_snapshot: orders.map(o => ({
      id: o.id, customer_name: o.customer_name, total: o.total,
      payment_method: o.payment_method, payment_status: o.payment_status, status: o.status,
    })),
  };
}

// ─── Subcomponente: Resumen / Reporte ─────────────────────────────────────

function SummaryView({ summary, session }: { summary: SessionSummary; session: Session }) {
  return (
    <div className="space-y-4">
      {/* Periodo */}
      <div className="bg-brand-gray rounded-2xl p-4">
        <p className="text-xs text-gray-400 mb-1">Periodo</p>
        <p className="text-white font-semibold">{fmt(session.opened_at)}</p>
        {session.closed_at && (
          <>
            <p className="text-gray-400 text-xs my-0.5">→</p>
            <p className="text-white font-semibold">{fmt(session.closed_at)}</p>
            <p className="text-xs text-brand-orange mt-1">⏱ Duración: {duration(session.opened_at, session.closed_at)}</p>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total órdenes</p>
          <p className="text-3xl font-black text-white">{summary.total_orders}</p>
        </div>
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Ingresos totales</p>
          <p className="text-3xl font-black text-green-400">${summary.total_revenue}</p>
        </div>
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">💵 Efectivo en caja</p>
          <p className="text-2xl font-black text-brand-orange">${summary.cash_revenue}</p>
        </div>
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">💳 Cobrado en Stripe</p>
          <p className="text-2xl font-black text-blue-400">${summary.stripe_revenue}</p>
        </div>
        {summary.delivery_fees > 0 && (
          <div className="bg-brand-gray rounded-2xl p-4 col-span-2">
            <p className="text-xs text-gray-400 mb-1">🛵 Costo de envíos</p>
            <p className="text-xl font-black text-white">${summary.delivery_fees}</p>
          </div>
        )}
      </div>

      {/* Productos vendidos */}
      {summary.items_sold.length > 0 && (
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">🍗 Productos vendidos</p>
          <div className="space-y-2">
            {summary.items_sold.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">
                    {item.qty}
                  </span>
                  <span className="text-gray-300 text-sm">{item.name}</span>
                </div>
                <span className="text-white font-semibold text-sm">${item.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras vendidos */}
      {summary.extras_sold.length > 0 && (
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">➕ Extras vendidos</p>
          <div className="space-y-2">
            {summary.extras_sold.map((e, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-orange text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">
                    {e.qty}
                  </span>
                  <span className="text-gray-300 text-sm">{e.name}</span>
                </div>
                <span className="text-white font-semibold text-sm">${e.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle de órdenes */}
      {summary.orders_snapshot.length > 0 && (
        <div className="bg-brand-gray rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-3">📋 Detalle de órdenes</p>
          <div className="space-y-1.5">
            {summary.orders_snapshot.map((o, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">#{o.id.slice(0,6).toUpperCase()}</span>
                  <span className="text-gray-300">{o.customer_name}</span>
                  <span className="text-xs">{o.payment_method === 'cash' ? '💵' : '💳'}</span>
                </div>
                <span className="text-white font-bold">${o.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [settings,        setSettings]        = useState<Settings | null>(null);
  const [orders,          setOrders]          = useState<Order[]>([]);
  const [sessions,        setSessions]        = useState<Session[]>([]);
  const [currentSession,  setCurrentSession]  = useState<Session | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filter,          setFilter]          = useState<OrderStatus | 'all'>('all');
  const [saving,          setSaving]          = useState(false);
  const [tab,             setTab]             = useState<'orders' | 'settings' | 'reports'>('orders');
  const [closingSummary,  setClosingSummary]  = useState<SessionSummary | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const supabase = createClient();

    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data));

    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setOrders(data ?? []));

    supabase.from('sessions').select('*').order('opened_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        const list = data ?? [];
        setSessions(list);
        // Sesión activa = la que no tiene closed_at
        const active = list.find((s: Session) => !s.closed_at) ?? null;
        setCurrentSession(active);
      });

    // Realtime para órdenes
    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        (p) => setOrders(prev => [p.new as Order, ...prev])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (p) => setOrders(prev => prev.map(o => o.id === p.new.id ? p.new as Order : o))
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Toggle principal del negocio ────────────────────────────────────────
  async function handleBusinessToggle() {
    if (!settings || saving) return;
    const opening = !settings.business_open;

    // Actualización optimista: el switch gira de inmediato
    setSettings(s => s ? { ...s, business_open: opening } : s);
    setSaving(true);

    const supabase = createClient();

    if (opening) {
      // --- ABRIR ---
      await supabase.from('settings').update({ business_open: true }).eq('id', 1);

      const { data: session } = await supabase
        .from('sessions')
        .insert({ opened_at: new Date().toISOString() })
        .select()
        .single();

      if (session) {
        setCurrentSession(session);
        setSessions(prev => [session, ...prev]);
      }
    } else {
      // --- CERRAR ---
      await supabase.from('settings').update({ business_open: false }).eq('id', 1);

      // Calcular resumen con las órdenes de la sesión activa (si existe)
      let summary: SessionSummary = buildSummary([]);
      const closed_at = new Date().toISOString();

      if (currentSession) {
        const { data: sessionOrders } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', currentSession.opened_at)
          .lte('created_at', closed_at)
          .order('created_at', { ascending: true });

        summary = buildSummary(sessionOrders ?? []);

        await supabase
          .from('sessions')
          .update({ closed_at, summary })
          .eq('id', currentSession.id);

        const closedSession: Session = { ...currentSession, closed_at, summary };
        setSessions(prev => prev.map(s => s.id === currentSession.id ? closedSession : s));
        setCurrentSession(null);
      }

      setClosingSummary(summary);
      setShowSummaryModal(true);
    }

    setSaving(false);
  }

  async function toggleSetting(key: keyof Settings, value: boolean | string | number) {
    if (!settings) return;
    setSaving(true);
    const supabase = createClient();
    setSettings({ ...settings, [key]: value as never, updated_at: new Date().toISOString() });
    await supabase.from('settings').update({ [key]: value }).eq('id', 1);
    setSaving(false);
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const supabase = createClient();
    await supabase.from('orders').update({ status }).eq('id', orderId);
    if (status === 'preparing' || status === 'ready') {
      fetch(`/api/admin/orders/${orderId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(console.error);
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
  }

  // Órdenes de la sesión activa solamente (tab Órdenes)
  const sessionOrders = currentSession
    ? orders.filter(o => new Date(o.created_at) >= new Date(currentSession.opened_at))
    : [];

  // Tab Órdenes: solo muestra las de la sesión actual, con filtro de status encima
  const filteredOrders = filter === 'all'
    ? sessionOrders
    : sessionOrders.filter(o => o.status === filter);

  // Nuevas = solo las de la sesión activa
  const newCount = sessionOrders.filter(o => o.status === 'new').length;

  return (
    <div className="min-h-screen bg-brand-black">

      {/* ── Modal de resumen al cerrar ── */}
      {showSummaryModal && closingSummary && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-brand-black border border-white/10 rounded-3xl w-full max-w-lg my-6 p-6">
            <div className="text-center mb-6">
              <p className="text-4xl mb-2">🔒</p>
              <h2 className="text-2xl font-black">Resumen del día</h2>
              <p className="text-gray-400 text-sm mt-1">El negocio ha cerrado</p>
            </div>
            {sessions[0] && <SummaryView summary={closingSummary} session={sessions[0]} />}
            <button
              onClick={() => { setShowSummaryModal(false); setClosingSummary(null); }}
              className="btn-primary w-full mt-6"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal de detalle de sesión ── */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-brand-black border border-white/10 rounded-3xl w-full max-w-lg my-6 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">Reporte de sesión</h2>
              <button onClick={() => setSelectedSession(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>
            {selectedSession.summary
              ? <SummaryView summary={selectedSession.summary} session={selectedSession} />
              : (
                <div className="text-center py-10 text-gray-500">
                  <p className="text-3xl mb-2">🟢</p>
                  <p>Sesión activa — cierra el negocio para ver el resumen</p>
                  {(() => {
                    const liveSummary = buildSummary(sessionOrders);
                    return (
                      <div className="mt-6 text-left">
                        <p className="text-xs text-gray-500 mb-3 text-center">Vista previa en tiempo real</p>
                        <SummaryView summary={liveSummary} session={selectedSession} />
                      </div>
                    );
                  })()}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-brand-black/95 backdrop-blur border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍗</span>
            <div>
              <h1 className="text-lg font-black">Crispy Charles</h1>
              {saving && <p className="text-xs text-gray-400">Guardando...</p>}
              {currentSession && !saving && (
                <p className="text-xs text-green-400">
                  Abierto desde {fmtTime(currentSession.opened_at)} · {duration(currentSession.opened_at, null)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled={saving}
              onClick={handleBusinessToggle}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all disabled:opacity-60 ${settings?.business_open ? 'bg-green-500/20 hover:bg-green-500/30' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <span className="text-sm font-semibold text-gray-200">
                {saving ? '...' : settings?.business_open ? '🟢 Abierto' : '🔴 Cerrado'}
              </span>
              <div className={`relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${settings?.business_open ? 'bg-green-500' : 'bg-gray-500'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${settings?.business_open ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
            <button onClick={logout} className="text-gray-400 hover:text-white text-sm transition-colors">Salir →</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1">
          {(['orders', 'reports', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === t ? 'bg-brand-red text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t === 'orders'   && <>Órdenes {newCount > 0 && <span className="ml-1 bg-brand-orange text-white text-xs rounded-full px-1.5">{newCount}</span>}</>}
              {t === 'reports'  && '📊 Reportes'}
              {t === 'settings' && 'Configuración'}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ══════════════ TAB: ÓRDENES ══════════════ */}
        {tab === 'orders' && (
          <div>
            <div className="flex gap-2 flex-wrap mb-6">
              {(['all', 'new', 'preparing', 'ready', 'delivered'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all ${filter === f ? 'bg-brand-red text-white' : 'bg-brand-gray text-gray-400 hover:text-white'}`}
                >
                  {f === 'all' ? 'Todas' : STATUS_LABELS[f as OrderStatus]}
                </button>
              ))}
            </div>

            {!currentSession ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-4xl mb-3">🔒</p>
                <p className="font-semibold text-gray-400">El negocio está cerrado</p>
                <p className="text-sm mt-1">Abre el negocio para empezar a recibir órdenes</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-4xl mb-3">🍽️</p>
                <p>Sin órdenes {filter !== 'all' ? `"${STATUS_LABELS[filter as OrderStatus]}"` : 'en esta sesión aún'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const isDelivered = order.status === 'delivered';
                  return (
                    <div key={order.id} className={`border rounded-2xl p-5 transition-all duration-300 ${STATUS_COLORS[order.status]} ${isDelivered ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-black text-lg ${isDelivered ? 'line-through' : ''}`}>
                              #{order.id.slice(0, 6).toUpperCase()}
                            </span>
                            {isDelivered && (
                              <span className="text-xs bg-gray-600 text-gray-300 font-bold px-2 py-0.5 rounded-full">✓ Completada</span>
                            )}
                          </div>
                          <p className={`text-sm opacity-80 mt-0.5 ${isDelivered ? 'line-through' : ''}`}>
                            {order.customer_name} · {order.customer_phone}
                          </p>
                          <p className="text-xs opacity-60 mt-0.5">
                            {fmtTime(order.created_at)} · {order.delivery_type === 'pickup' ? '🏪 Recoger' : '🛵 Domicilio'} · {order.payment_method === 'stripe' ? '💳' : '💵'} {order.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </p>
                        </div>
                        <span className={`text-2xl font-black ${isDelivered ? 'line-through opacity-60' : ''}`}>${order.total}</span>
                      </div>
                      <div className={`text-sm mb-3 space-y-0.5 ${isDelivered ? 'line-through' : ''}`}>
                        {order.items.map((item, i) => (
                          <p key={i} className="opacity-90">{item.qty}× {item.product_name} ({item.variant_name})</p>
                        ))}
                        {order.extras.map((e, i) => (
                          <p key={i} className="opacity-70">+ {e.qty}× {e.extra_name}</p>
                        ))}
                        {order.notes && <p className="opacity-60 italic">📝 {order.notes}</p>}
                        {order.delivery_address && <p className="opacity-70">📍 {order.delivery_address}</p>}
                      </div>
                      {STATUS_NEXT[order.status] && (
                        <button
                          onClick={() => updateOrderStatus(order.id, STATUS_NEXT[order.status]!)}
                          className="btn-primary text-sm py-2 px-4"
                        >
                          → {STATUS_LABELS[STATUS_NEXT[order.status]!]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ TAB: REPORTES ══════════════ */}
        {tab === 'reports' && (
          <div>
            {/* Sesión activa en vivo */}
            {currentSession && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <p className="font-black text-green-400">Sesión activa</p>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Abierto {fmt(currentSession.opened_at)} · {duration(currentSession.opened_at, null)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSession(currentSession)}
                    className="text-sm bg-green-500/20 hover:bg-green-500/40 text-green-300 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    Ver en vivo →
                  </button>
                </div>
                {/* Mini KPIs live */}
                {(() => {
                  const live = buildSummary(sessionOrders);
                  return (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-brand-black/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-white">{live.total_orders}</p>
                        <p className="text-xs text-gray-400">órdenes</p>
                      </div>
                      <div className="bg-brand-black/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-brand-orange">${live.cash_revenue}</p>
                        <p className="text-xs text-gray-400">💵 efectivo</p>
                      </div>
                      <div className="bg-brand-black/40 rounded-xl p-3 text-center">
                        <p className="text-2xl font-black text-blue-400">${live.stripe_revenue}</p>
                        <p className="text-xs text-gray-400">💳 tarjeta</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Historial de sesiones */}
            <h2 className="text-lg font-black mb-4 text-white">Historial de turnos</h2>
            {sessions.filter(s => s.closed_at).length === 0 && !currentSession ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-4xl mb-3">📊</p>
                <p>Aún no hay reportes guardados</p>
                <p className="text-sm mt-1">Se generan automáticamente al cerrar el negocio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.filter(s => s.closed_at && s.summary).map(session => {
                  const s = session.summary!;
                  return (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="w-full bg-brand-gray hover:bg-brand-card border border-white/10 hover:border-brand-red/40 rounded-2xl p-5 text-left transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-white">
                            {new Date(session.opened_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtTime(session.opened_at)} – {fmtTime(session.closed_at!)} · {duration(session.opened_at, session.closed_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-green-400">${s.total_revenue}</p>
                          <p className="text-xs text-gray-400">{s.total_orders} órdenes</p>
                        </div>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <span className="text-brand-orange font-semibold">💵 ${s.cash_revenue}</span>
                        <span className="text-blue-400 font-semibold">💳 ${s.stripe_revenue}</span>
                        {s.delivery_fees > 0 && <span className="text-gray-400">🛵 ${s.delivery_fees}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-right">Ver reporte completo →</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Todas las órdenes */}
            {orders.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-black mb-4 text-white">Todas las órdenes</h2>
                <div className="space-y-2">
                  {orders.map(o => (
                    <div key={o.id} className="bg-brand-gray rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-gray-500 flex-shrink-0">#{o.id.slice(0,6).toUpperCase()}</span>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{o.customer_name}</p>
                          <p className="text-gray-400 text-xs">{fmt(o.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-black text-gray-400">{STATUS_LABELS[o.status]}</span>
                        <span className="text-xs">{o.payment_method === 'cash' ? '💵' : '💳'}</span>
                        <span className="text-white font-bold text-sm">${o.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ TAB: CONFIGURACIÓN ══════════════ */}
        {tab === 'settings' && settings && (
          <div className="space-y-4 max-w-lg">
            <div className="bg-brand-gray rounded-2xl p-5">
              <h3 className="font-bold mb-4">Opciones de entrega</h3>
              <div className="space-y-3">
                {([['pickup_enabled', '🏪 Recoger en tienda', 'Clientes recogen su pedido'], ['delivery_enabled', '🛵 Domicilio', `Costo: $${settings.delivery_fee} MXN`]] as const).map(([key, label, sub]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-xs text-gray-400">{sub}</p>
                    </div>
                    <button
                      onClick={() => toggleSetting(key, !settings[key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${settings[key] ? 'bg-green-500' : 'bg-gray-600'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings[key] ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-brand-gray rounded-2xl p-5">
              <h3 className="font-bold mb-3">Horarios de atención</h3>
              <input type="text" value={settings.business_hours}
                onChange={e => setSettings({ ...settings, business_hours: e.target.value })}
                onBlur={e => toggleSetting('business_hours', e.target.value)}
                className="w-full bg-brand-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>

            <div className="bg-brand-gray rounded-2xl p-5">
              <h3 className="font-bold mb-3">Mensaje cuando estamos cerrados</h3>
              <p className="text-xs text-gray-400 mb-2">Se envía por WhatsApp a quien nos escriba estando cerrados</p>
              <textarea value={settings.closed_message}
                onChange={e => setSettings({ ...settings, closed_message: e.target.value })}
                onBlur={e => toggleSetting('closed_message', e.target.value)}
                rows={4}
                className="w-full bg-brand-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors resize-none"
              />
            </div>

            <div className="bg-brand-gray rounded-2xl p-5">
              <h3 className="font-bold mb-3">Costo de domicilio (MXN)</h3>
              <input type="number" value={settings.delivery_fee}
                onChange={e => setSettings({ ...settings, delivery_fee: Number(e.target.value) })}
                onBlur={e => toggleSetting('delivery_fee', Number(e.target.value))}
                className="w-full bg-brand-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
