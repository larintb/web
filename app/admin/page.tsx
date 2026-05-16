'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { etaIsoFromMinutes } from '@/lib/eta';
import type { Order, Settings, OrderStatus, Session, SessionSummary, Category, Product, Extra } from '@/types';
import ProductsPanel from '@/components/admin/ProductsPanel';
import ExtrasPanel   from '@/components/admin/ExtrasPanel';
import ReportsTab    from '@/components/admin/ReportsTab';
import POSTab        from '@/components/admin/POSTab';

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  new:       'Nueva',
  preparing: 'Preparando',
  ready:     'Lista',
  delivered: 'Entregada',
  cancelled: 'Cancelada',
};

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new:       'preparing',
  preparing: 'ready',
  ready:     'delivered',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  new:       'bg-white border-2 border-blue-500',
  preparing: 'bg-white border-2 border-orange-500',
  ready:     'bg-white border-2 border-green-500',
  delivered: 'bg-gray-50 border-2 border-gray-300',
  cancelled: 'bg-white border-2 border-red-400',
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  new:       'bg-blue-500 text-white',
  preparing: 'bg-orange-500 text-white',
  ready:     'bg-green-500 text-white',
  delivered: 'bg-gray-400 text-white',
  cancelled: 'bg-red-500 text-white',
};

const STATUS_FILTER_ON: Record<string, string> = {
  all:       'bg-brand-ink text-white',
  new:       'bg-blue-500 text-white',
  preparing: 'bg-orange-500 text-white',
  ready:     'bg-green-500 text-white',
  delivered: 'bg-gray-400 text-white',
  cancelled: 'bg-red-500 text-white',
};

const STATUS_FILTER_OFF: Record<string, string> = {
  all:       'bg-white border border-brand-line text-brand-muted',
  new:       'bg-blue-50 border border-blue-200 text-blue-600',
  preparing: 'bg-orange-50 border border-orange-200 text-orange-600',
  ready:     'bg-green-50 border border-green-200 text-green-600',
  delivered: 'bg-gray-50 border border-gray-200 text-gray-500',
  cancelled: 'bg-red-50 border border-red-200 text-red-500',
};

type PendingAction =
  | { kind: 'advance'; orderId: string; orderCode: string; nextStatus: OrderStatus }
  | { kind: 'cancel';  orderId: string; orderCode: string; refund: boolean };

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
  const active              = orders.filter(o => o.status !== 'cancelled');
  const cash_revenue        = active.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);
  const stripe_revenue      = active.filter(o => o.payment_method === 'stripe' && o.payment_status === 'paid').reduce((s, o) => s + o.total, 0);
  const card_manual_revenue = active.filter(o => o.payment_method === 'card_manual').reduce((s, o) => s + o.total, 0);
  const delivery_fees       = active.reduce((s, o) => s + (o.delivery_fee ?? 0), 0);

  // Items
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of active) {
    for (const item of o.items ?? []) {
      const k = `${item.product_name} (${item.variant_name})`;
      if (!itemMap[k]) itemMap[k] = { qty: 0, revenue: 0 };
      itemMap[k].qty     += item.qty;
      itemMap[k].revenue += item.subtotal;
    }
  }

  // Extras
  const extraMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of active) {
    for (const e of o.extras ?? []) {
      const k = e.extra_name;
      if (!extraMap[k]) extraMap[k] = { qty: 0, revenue: 0 };
      extraMap[k].qty     += e.qty;
      extraMap[k].revenue += e.subtotal;
    }
  }

  return {
    total_orders:        active.length,
    total_revenue:       cash_revenue + stripe_revenue + card_manual_revenue,
    cash_revenue,
    stripe_revenue,
    card_manual_revenue,
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
      <div className="surface-paper rounded-2xl p-4">
        <p className="text-xs text-brand-muted uppercase tracking-[0.2em] mb-1">Periodo</p>
        <p className="text-brand-ink font-semibold">{fmt(session.opened_at)}</p>
        {session.closed_at && (
          <>
            <p className="text-brand-muted text-xs my-0.5">→</p>
            <p className="text-brand-ink font-semibold">{fmt(session.closed_at)}</p>
            <p className="text-xs text-brand-orange mt-1">⏱ Duración: {duration(session.opened_at, session.closed_at)}</p>
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">Total órdenes</p>
          <p className="text-3xl font-black text-brand-ink">{summary.total_orders}</p>
        </div>
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">Ingresos totales</p>
          <p className="text-3xl font-black text-green-600">${summary.total_revenue}</p>
        </div>
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">💵 Efectivo</p>
          <p className="text-2xl font-black text-brand-orange">${summary.cash_revenue}</p>
        </div>
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">💳 Tarjeta</p>
          <p className="text-2xl font-black text-blue-600">${summary.stripe_revenue}</p>
        </div>
        {summary.delivery_fees > 0 && (
          <div className="surface-paper rounded-2xl p-4 col-span-2">
            <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">🛵 Costo de envíos</p>
            <p className="text-xl font-black text-brand-ink">${summary.delivery_fees}</p>
          </div>
        )}
      </div>

      {/* Productos vendidos */}
      {summary.items_sold.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">🍗 Productos vendidos</p>
          <div className="space-y-2">
            {summary.items_sold.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">
                    {item.qty}
                  </span>
                  <span className="text-brand-ink text-sm">{item.name}</span>
                </div>
                <span className="text-brand-ink font-semibold text-sm">${item.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras vendidos */}
      {summary.extras_sold.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">➕ Extras vendidos</p>
          <div className="space-y-2">
            {summary.extras_sold.map((e, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-orange text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">
                    {e.qty}
                  </span>
                  <span className="text-brand-ink text-sm">{e.name}</span>
                </div>
                <span className="text-brand-ink font-semibold text-sm">${e.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle de órdenes */}
      {summary.orders_snapshot.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">📋 Detalle de órdenes</p>
          <div className="space-y-1.5">
            {summary.orders_snapshot.map((o, i) => {
              const cancelled = o.status === 'cancelled';
              return (
                <div key={i} className={`flex justify-between items-center text-sm ${cancelled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs text-brand-muted ${cancelled ? 'line-through' : ''}`}>#{o.id.slice(0,6).toUpperCase()}</span>
                    <span className={`text-brand-ink ${cancelled ? 'line-through' : ''}`}>{o.customer_name}</span>
                    <span className="text-xs">{cancelled ? '❌' : o.payment_method === 'cash' ? '💵' : '💳'}</span>
                  </div>
                  <span className={`text-brand-ink font-bold ${cancelled ? 'line-through' : ''}`}>${o.total}</span>
                </div>
              );
            })}
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
  const [filter,          setFilter]          = useState<OrderStatus | 'all'>('all');
  const [saving,          setSaving]          = useState(false);
  const [tab,             setTab]             = useState<'orders' | 'settings' | 'reports' | 'menu' | 'waiter'>('orders');
  const [ordersSubview,   setOrdersSubview]   = useState<'orders' | 'pos'>('orders');
  const [categories,      setCategories]      = useState<Category[]>([]);
  const [allProducts,     setAllProducts]     = useState<Product[]>([]);
  const [allExtras,       setAllExtras]       = useState<Extra[]>([]);
  const [closingSummary,  setClosingSummary]  = useState<SessionSummary | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [printerLastSeen, setPrinterLastSeen] = useState<string | null | undefined>(undefined);
  const [printerTick,     setPrinterTick]     = useState(0);
  const [pendingAction,   setPendingAction]   = useState<PendingAction | null>(null);
  const [acceptMinutes,   setAcceptMinutes]   = useState(20);
  const [cancelReason,    setCancelReason]    = useState('');
  const [showBusinessConfirm, setShowBusinessConfirm] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const supabase = createClient();

    supabase.from('settings').select('*').eq('id', 1).single()
      .then(({ data }) => setSettings(data));

    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => setOrders(data ?? []));

    supabase.from('categories').select('*').order('display_order')
      .then(({ data }) => setCategories(data ?? []));

    supabase.from('products').select('*, categories(*)').order('display_order')
      .then(({ data }) => setAllProducts((data ?? []) as Product[]));

    supabase.from('extras').select('*').order('display_order')
      .then(({ data }) => setAllExtras((data ?? []) as Extra[]));

    supabase.from('sessions').select('*').order('opened_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        const list = data ?? [];
        setSessions(list);
        // Sesión activa = la que no tiene closed_at
        const active = list.find((s: Session) => !s.closed_at) ?? null;
        setCurrentSession(active);
      });

    // Estado inicial de la impresora
    supabase.from('printers').select('last_seen_at').order('updated_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        setPrinterLastSeen(data && data.length > 0 ? data[0].last_seen_at : null);
      });

    // Realtime para órdenes y estado de impresora
    const channel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },
        (p) => setOrders(prev => [p.new as Order, ...prev])
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },
        (p) => setOrders(prev => prev.map(o => o.id === p.new.id ? p.new as Order : o))
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printers' },
        (p) => { if (p.new && 'last_seen_at' in p.new) setPrinterLastSeen((p.new as { last_seen_at: string }).last_seen_at); }
      )
      .subscribe();

    // Re-evalúa el estado de la impresora cada 30s para detectar heartbeat perdido
    const staleness = setInterval(() => setPrinterTick(t => t + 1), 30_000);

    return () => { supabase.removeChannel(channel); clearInterval(staleness); };
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

  async function _updateOrderStatus(orderId: string, status: OrderStatus) {
    const supabase = createClient();
    const update: Record<string, unknown> = { status };
    if (status === 'preparing') {
      update.estimated_ready_at = etaIsoFromMinutes(acceptMinutes);
    } else if (status === 'delivered') {
      const order = orders.find(o => o.id === orderId);
      if (order?.payment_method === 'cash') update.payment_status = 'paid';
    }
    await supabase.from('orders').update(update).eq('id', orderId);
    if (status === 'preparing' || status === 'ready') {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          const { whatsapp_error } = await res.json().catch(() => ({}));
          console.error('[admin] WhatsApp notify falló:', whatsapp_error);
        }
      } catch (err) {
        console.error('[admin] notify fetch error:', err);
      }
    }
  }

  function updateOrderStatus(orderId: string, nextStatus: OrderStatus, orderCode: string) {
    if (nextStatus === 'preparing') {
      setAcceptMinutes(settings?.prep_minutes_per_batch ?? 20);
    }
    setPendingAction({ kind: 'advance', orderId, orderCode, nextStatus });
  }

  function cancelOrder(orderId: string, orderCode: string, refund: boolean) {
    setPendingAction({ kind: 'cancel', orderId, orderCode, refund });
  }

  function executeAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    const reason = cancelReason.trim();

    // Cerrar modal inmediatamente — la operación corre en background
    closePendingAction();

    if (action.kind === 'advance') {
      _updateOrderStatus(action.orderId, action.nextStatus);
    } else {
      fetch(`/api/admin/orders/${action.orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      }).then(res => {
        if (!res.ok) res.json().then(d => console.error('[admin] cancel error:', d.error)).catch(() => {});
      }).catch(err => console.error('[admin] cancel fetch error:', err));
    }
  }

  function closePendingAction() {
    setPendingAction(null);
    setCancelReason('');
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

  const queueCount = sessionOrders.filter(o => o.status === 'new' || o.status === 'preparing').length;

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">

      {/* ── Modal de confirmación abrir/cerrar ── */}
      {showBusinessConfirm && settings && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 flex items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <p className="text-5xl mb-3">{settings.business_open ? '🔒' : '🟢'}</p>
              <h2 className="font-display text-5xl text-brand-ink leading-none">
                {settings.business_open ? 'Cerrar el local' : 'Abrir el local'}
              </h2>
              <p className="text-brand-muted text-sm mt-2">
                {settings.business_open
                  ? 'Se cerrará el turno actual y se generará el resumen del día.'
                  : 'Los clientes podrán ver el menú y hacer pedidos.'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBusinessConfirm(false)}
                className="flex-1 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowBusinessConfirm(false); handleBusinessToggle(); }}
                className={`flex-1 py-3 rounded-2xl font-semibold text-white transition-colors ${settings.business_open ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
              >
                {settings.business_open ? 'Sí, cerrar' : 'Sí, abrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de resumen al cerrar ── */}
      {showSummaryModal && closingSummary && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 flex items-start justify-center p-4 overflow-y-auto">
          <div className="surface-paper rounded-3xl w-full max-w-lg my-6 p-6">
            <div className="text-center mb-6">
              <p className="text-4xl mb-2">🔒</p>
              <h2 className="font-display text-6xl text-brand-ink leading-none">Resumen del día</h2>
              <p className="text-brand-muted text-sm mt-1">El negocio ha cerrado</p>
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

      {/* ── Modal de confirmación de acción ── */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 flex items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-sm p-6">
            <h2 className="font-display text-5xl text-brand-ink leading-none mb-2">
              {pendingAction.kind === 'cancel'
                ? `Rechazar #${pendingAction.orderCode}`
                : pendingAction.nextStatus === 'preparing'
                ? `Aceptar #${pendingAction.orderCode}`
                : `Marcar como ${STATUS_LABELS[pendingAction.nextStatus]}`}
            </h2>
            <p className="text-brand-muted text-sm mt-2 mb-4">
              {pendingAction.kind === 'cancel'
                ? pendingAction.refund
                  ? '⚠️ Se procesará un reembolso automático en Stripe y se notificará al cliente.'
                  : 'Se notificará al cliente que la orden fue cancelada.'
                : pendingAction.nextStatus === 'preparing'
                ? 'Esto inicia la preparación y notifica al cliente por WhatsApp.'
                : `La orden pasará al estado "${STATUS_LABELS[pendingAction.nextStatus]}".`}
            </p>
            {pendingAction.kind === 'advance' && pendingAction.nextStatus === 'preparing' && (
              <div className="mb-5 flex items-center justify-between bg-brand-paper rounded-2xl p-4">
                <button
                  onClick={() => setAcceptMinutes(m => Math.max(5, m - 5))}
                  className="w-10 h-10 rounded-full border border-brand-line text-brand-ink font-black text-lg flex items-center justify-center hover:bg-brand-line transition-colors"
                >−</button>
                <div className="text-center">
                  <p className="font-display text-5xl text-brand-red leading-none">{acceptMinutes}</p>
                  <p className="text-xs text-brand-muted mt-0.5">minutos</p>
                </div>
                <button
                  onClick={() => setAcceptMinutes(m => m + 5)}
                  className="w-10 h-10 rounded-full border border-brand-line text-brand-ink font-black text-lg flex items-center justify-center hover:bg-brand-line transition-colors"
                >+</button>
              </div>
            )}
            {pendingAction.kind === 'cancel' && (
              <div className="mb-5">
                <label className="text-xs uppercase tracking-[0.2em] text-brand-muted block mb-1.5">Razón (se enviará al cliente)</label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Por favor no pases al negocio."
                  className="w-full bg-brand-paper border border-brand-line rounded-xl px-3 py-2 text-brand-ink text-sm placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors resize-none"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={closePendingAction}
                className="flex-1 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeAction}
                className={`flex-1 py-3 rounded-2xl font-semibold text-white transition-colors ${
                  pendingAction.kind === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-red hover:bg-red-700'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-brand-paper/95 backdrop-blur border-b border-brand-line/80">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍗</span>
            <div>
              <h1 className="font-display text-4xl text-brand-ink leading-none">Crispy Charles</h1>
              {saving && <p className="text-xs text-brand-muted">Guardando...</p>}
              {currentSession && settings?.business_open && !saving && (
                <p className="text-xs text-green-600 font-semibold">
                  Abierto desde {fmtTime(currentSession.opened_at)} · {duration(currentSession.opened_at, null)}
                </p>
              )}
              {currentSession && settings?.business_open && queueCount > 0 && (
                <p className="text-xs text-brand-muted">
                  Cola: {queueCount} {queueCount === 1 ? 'orden' : 'órdenes'}
                </p>
              )}
            </div>
            {printerLastSeen !== undefined && (() => {
              void printerTick; // fuerza re-render cada 30s para re-evaluar Date.now()
              const online = printerLastSeen !== null
                && (Date.now() - new Date(printerLastSeen).getTime()) < 90_000;
              return (
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${online ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {online ? 'Impresora' : 'Sin impresora'}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.open('/menu?preview=1', '_blank')}
              className="text-brand-muted hover:text-brand-ink text-sm transition-colors font-semibold border border-brand-line rounded-xl px-3 py-1.5"
            >
              👁 Vista previa
            </button>
            <button
              disabled={saving}
              onClick={() => setShowBusinessConfirm(true)}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-all disabled:opacity-60 ${settings?.business_open ? 'bg-green-100 hover:bg-green-200' : 'bg-brand-line/60 hover:bg-brand-line'}`}
            >
              <span className={`text-sm font-semibold ${settings?.business_open ? 'text-green-700' : 'text-brand-muted'}`}>
                {saving ? '...' : settings?.business_open ? '🟢 Abierto' : '🔴 Cerrado'}
              </span>
              <div className={`relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${settings?.business_open ? 'bg-green-500' : 'bg-brand-line'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${settings?.business_open ? 'left-6' : 'left-1'}`} />
              </div>
            </button>
            <button onClick={logout} className="text-brand-muted hover:text-brand-ink text-sm transition-colors font-semibold">Salir →</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1">
          {(['orders', 'waiter', 'reports', 'menu', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === t ? 'bg-brand-red text-white' : 'text-brand-muted hover:text-brand-ink'}`}
            >
              {t === 'orders'   && <>Órdenes {newCount > 0 && <span className="ml-1 bg-brand-orange text-white text-xs rounded-full px-1.5">{newCount}</span>}</>}
              {t === 'waiter'   && 'Mesero'}
              {t === 'reports'  && 'Reportes'}
              {t === 'menu'     && 'Menú'}
              {t === 'settings' && 'Configuración'}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* ══════════════ TAB: ÓRDENES + POS ══════════════ */}
        {tab === 'orders' && (
          <div>
            {/* Mobile: toggle entre órdenes y caja */}
            <div className="flex gap-2 mb-4 lg:hidden">
              <button onClick={() => setOrdersSubview('orders')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${ordersSubview === 'orders' ? 'bg-brand-red text-white' : 'bg-white border border-brand-line text-brand-muted'}`}>
                Órdenes {newCount > 0 && <span className="ml-1 bg-brand-orange text-white text-xs rounded-full px-1.5">{newCount}</span>}
              </button>
              <button onClick={() => setOrdersSubview('pos')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${ordersSubview === 'pos' ? 'bg-brand-red text-white' : 'bg-white border border-brand-line text-brand-muted'}`}>
                🏪 Caja
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-start">

              {/* ── Lista de órdenes (sticky) ── */}
              <div className={`lg:sticky lg:top-28 lg:flex lg:flex-col lg:h-[calc(100vh-8rem)] ${ordersSubview === 'pos' ? 'hidden lg:flex' : ''}`}>

                {/* ── Contador de órdenes del turno ── */}
                {currentSession && settings?.business_open && (() => {
                  const TIER1_MAX = 40;
                  const validOrders = sessionOrders.filter(o => o.status !== 'cancelled');
                  const count   = validOrders.length;
                  const tier    = count <= TIER1_MAX ? 1 : 2;
                  const barPct  = tier === 1
                    ? Math.min(100, (count / TIER1_MAX) * 100)
                    : Math.min(100, ((count - TIER1_MAX) / TIER1_MAX) * 100);
                  const cashCount = validOrders.filter(o => o.payment_method !== 'stripe').length;
                  const cardCount = validOrders.filter(o => o.payment_method === 'stripe').length;
                  return (
                    <div className="mb-4 flex-shrink-0 surface-paper rounded-2xl p-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-brand-muted uppercase tracking-[0.15em]">Órdenes del turno</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tier === 1 ? 'bg-brand-orange/20 text-brand-orange' : 'bg-purple-100 text-purple-600'}`}>
                            T{tier}
                          </span>
                        </div>
                        <span className="font-display text-4xl text-brand-ink leading-none">{count}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-brand-line overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${tier === 1 ? 'bg-brand-orange' : 'bg-purple-500'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-brand-muted mb-3">
                        <span>{tier === 1 ? `${count} / ${TIER1_MAX}` : `+${count - TIER1_MAX} sobre T1`}</span>
                        <span>{tier === 1 ? `${TIER1_MAX - count} para T2` : `T1 completado ✓`}</span>
                      </div>

                      {/* Desglose efectivo / tarjeta */}
                      <div className="flex gap-2">
                        <div className="flex-1 bg-green-500 rounded-xl px-3 py-2 flex items-center gap-2">
                          <div>
                            <p className="text-xs text-green-100 leading-none">Efectivo</p>
                            <p className="font-black text-white text-lg leading-tight">{cashCount}</p>
                          </div>
                        </div>
                        <div className="flex-1 bg-blue-500 rounded-xl px-3 py-2 flex items-center gap-2">
                          <div>
                            <p className="text-xs text-blue-100 leading-none">Tarjeta</p>
                            <p className="font-black text-white text-lg leading-tight">{cardCount}</p>
                          </div>
                        </div>
                      </div>

                      {/* Mini log de órdenes válidas */}
                      {validOrders.length > 0 && (
                        <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                          {[...validOrders].reverse().map((o, i) => (
                            <div key={o.id} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-brand-muted font-mono w-5 text-right flex-shrink-0">{validOrders.length - i}</span>
                                <span className="font-mono text-brand-muted">#{o.id.slice(0,6).toUpperCase()}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${o.payment_method === 'stripe' || o.payment_method === 'card_manual' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                  {o.payment_method === 'stripe' || o.payment_method === 'card_manual' ? 'T' : 'E'}
                                </span>
                                <span className="text-brand-muted truncate max-w-[80px]">{o.customer_name}</span>
                              </div>
                              <span className="font-semibold text-brand-ink">${o.total}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
                  {(['all', 'new', 'preparing', 'ready', 'delivered', 'cancelled'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all ${filter === f ? STATUS_FILTER_ON[f] : STATUS_FILTER_OFF[f]}`}
                    >
                      {f === 'all' ? 'Todas' : STATUS_LABELS[f]}
                    </button>
                  ))}
                </div>

                <div className="overflow-y-auto flex-1 pr-1">
                {!currentSession ? (
                  <div className="text-center py-20 text-brand-muted">
                    <p className="text-4xl mb-3">🔒</p>
                    <p className="font-semibold text-brand-ink">El negocio está cerrado</p>
                    <p className="text-sm mt-1">Abre el negocio para empezar a recibir órdenes</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-20 text-brand-muted">
                    <p className="text-4xl mb-3">🍽️</p>
                    <p>Sin órdenes {filter !== 'all' ? `"${STATUS_LABELS[filter as OrderStatus]}"` : 'en esta sesión aún'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map(order => {
                      const isDelivered = order.status === 'delivered';
                      return (
                        <div key={order.id} className={`rounded-2xl p-5 transition-all duration-300 ${STATUS_COLORS[order.status]} ${isDelivered ? 'opacity-50' : ''}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-black text-lg text-brand-ink ${isDelivered ? 'line-through' : ''}`}>
                                  #{order.id.slice(0, 6).toUpperCase()}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}>
                                  {STATUS_LABELS[order.status]}
                                </span>
                              </div>
                              <p className={`text-sm text-brand-muted mt-0.5 ${isDelivered ? 'line-through' : ''}`}>
                                {order.customer_name} · {order.customer_phone}
                              </p>
                              <p className="text-xs opacity-60 mt-0.5">
                                {fmtTime(order.created_at)} · {order.delivery_type === 'pickup' ? '🏪 Recoger' : '🛵 Domicilio'} · {order.payment_method === 'stripe' ? '💳 Stripe' : order.payment_method === 'card_manual' ? '💳 Terminal' : '💵 Efectivo'} · {order.payment_status === 'paid' ? 'Pagado' : 'Pendiente'}{order.source === 'pos' ? ' · 🏪 POS' : ''}
                                {order.estimated_ready_at && order.status !== 'delivered' && order.status !== 'cancelled' && (
                                  <> · ⏱ {fmtTime(order.estimated_ready_at)}</>
                                )}
                              </p>
                            </div>
                            <span className={`text-2xl font-black text-brand-ink ${isDelivered ? 'line-through opacity-60' : ''}`}>${order.total}</span>
                          </div>
                          <div className={`text-sm mb-3 space-y-0.5 text-brand-ink ${isDelivered ? 'line-through' : ''}`}>
                            {order.items.map((item, i) => (
                              <p key={i} className="opacity-90">{item.qty}× {item.product_name} ({item.variant_name})</p>
                            ))}
                            {order.extras.map((e, i) => (
                              <p key={i} className="opacity-70">+ {e.qty}× {e.extra_name}</p>
                            ))}
                            {order.notes && <p className="opacity-60 italic">{order.notes}</p>}
                            {order.delivery_address && <p className="opacity-70">{order.delivery_address}</p>}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {STATUS_NEXT[order.status] && (
                              <button
                                onClick={() => updateOrderStatus(order.id, STATUS_NEXT[order.status]!, order.id.slice(0, 6).toUpperCase())}
                                className="btn-primary text-sm py-2 px-4"
                              >
                                {order.status === 'new' ? '✅ Aceptar Orden' : `→ ${STATUS_LABELS[STATUS_NEXT[order.status]!]}`}
                              </button>
                            )}
                            {order.status === 'new' && (
                              <button
                                onClick={() => cancelOrder(order.id, order.id.slice(0, 6).toUpperCase(), order.payment_method === 'stripe' && order.payment_status === 'paid')}
                                className="text-sm py-2 px-4 rounded-xl border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 transition-colors font-semibold"
                              >
                                ❌ Rechazar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>

              {/* ── Caja POS (fluye con la página) ── */}
              <div className={ordersSubview === 'orders' ? 'hidden lg:block' : ''}>
                <p className="hidden lg:block text-xs text-brand-muted uppercase tracking-[0.2em] mb-3">🏪 Caja</p>
                <POSTab
                  categories={categories}
                  allProducts={allProducts}
                  allExtras={allExtras}
                  compact
                />
              </div>

            </div>
          </div>
        )}

        {/* ══════════════ TAB: MESERO ══════════════ */}
        {tab === 'waiter' && (
          <POSTab
            categories={categories}
            allProducts={allProducts}
            allExtras={allExtras}
            compact
          />
        )}

        {/* ══════════════ TAB: REPORTES ══════════════ */}
        {tab === 'reports' && (
          <ReportsTab
            allProducts={allProducts}
            currentSession={settings?.business_open ? currentSession : null}
            sessionOrders={sessionOrders}
            sessions={sessions}
          />
        )}

        {/* ══════════════ TAB: CONFIGURACIÓN ══════════════ */}
        {tab === 'menu' && (
          <div>
            <ProductsPanel
              categories={categories}
              products={allProducts}
              onChange={setAllProducts}
            />
            <ExtrasPanel
              extras={allExtras}
              onChange={setAllExtras}
            />
          </div>
        )}

        {tab === 'settings' && settings && (
          <div className="space-y-4 max-w-lg">
            <div className="surface-paper rounded-2xl p-5">
              <h3 className="font-display text-4xl text-brand-ink leading-none mb-4">Opciones de entrega</h3>
              <div className="space-y-3">
                {([['pickup_enabled', '🏪 Recoger en tienda', 'Clientes recogen su pedido'], ['delivery_enabled', '🛵 Domicilio', `Costo: $${settings.delivery_fee} MXN`]] as const).map(([key, label, sub]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-brand-ink">{label}</p>
                      <p className="text-xs text-brand-muted">{sub}</p>
                    </div>
                    <button
                      onClick={() => toggleSetting(key, !settings[key])}
                      disabled={saving}
                      className={`relative w-12 h-6 rounded-full transition-all duration-200 ${settings[key] ? 'bg-brand-orange' : 'bg-brand-line'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${settings[key] ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-paper rounded-2xl p-5">
              <h3 className="font-display text-4xl text-brand-ink leading-none mb-3">Horarios de atención</h3>
              <input type="text" value={settings.business_hours}
                onChange={e => setSettings({ ...settings, business_hours: e.target.value })}
                onBlur={e => toggleSetting('business_hours', e.target.value)}
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>

            <div className="surface-paper rounded-2xl p-5">
              <h3 className="font-display text-4xl text-brand-ink leading-none mb-2">Mensaje al cerrar</h3>
              <p className="text-xs text-brand-muted mb-3">Se envía por WhatsApp a quien nos escriba estando cerrados</p>
              <textarea value={settings.closed_message}
                onChange={e => setSettings({ ...settings, closed_message: e.target.value })}
                onBlur={e => toggleSetting('closed_message', e.target.value)}
                rows={4}
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors resize-none"
              />
            </div>

            <div className="surface-paper rounded-2xl p-5">
              <h3 className="font-display text-4xl text-brand-ink leading-none mb-3">Costo de domicilio (MXN)</h3>
              <input type="number" value={settings.delivery_fee}
                onChange={e => setSettings({ ...settings, delivery_fee: Number(e.target.value) })}
                onBlur={e => toggleSetting('delivery_fee', Number(e.target.value))}
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>

            <div className="surface-paper rounded-2xl p-5">
              <h3 className="font-display text-4xl text-brand-ink leading-none mb-2">Tiempo base al aceptar (min)</h3>
              <p className="text-xs text-brand-muted mb-3">Valor inicial del selector cuando el negocio acepta una orden</p>
              <input type="number" value={settings.prep_minutes_per_batch}
                onChange={e => setSettings({ ...settings, prep_minutes_per_batch: Number(e.target.value) })}
                onBlur={e => toggleSetting('prep_minutes_per_batch', Number(e.target.value))}
                className="w-full bg-brand-paper border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
