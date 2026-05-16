'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { CartItem, Order, Product, Session, SessionSummary } from '@/types';

// ─── Types ─────────────────────────────────────────────────────────────────

type Range = 'today' | 'week' | 'month' | 'total';

interface Props {
  allProducts:    Product[];
  currentSession: Session | null;
  sessionOrders:  Order[];
  sessions:       Session[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return '$' + Math.round(n).toLocaleString('es-MX');
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function duration(open: string, close: string | null) {
  const ms = new Date(close ?? new Date()).getTime() - new Date(open).getTime();
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function localDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localMonthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function rangeStart(range: Range): string | null {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === 'month') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return null;
}

function buildSummary(orders: Order[]): SessionSummary {
  const active              = orders.filter(o => o.status !== 'cancelled');
  const cash_revenue        = active.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);
  const stripe_revenue      = active.filter(o => o.payment_method === 'stripe' && o.payment_status === 'paid').reduce((s, o) => s + o.total, 0);
  const card_manual_revenue = active.filter(o => o.payment_method === 'card_manual').reduce((s, o) => s + o.total, 0);
  const delivery_fees       = active.reduce((s, o) => s + (o.delivery_fee ?? 0), 0);
  const itemMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of active) {
    for (const item of o.items ?? []) {
      const k = `${item.product_name} (${item.variant_name})`;
      if (!itemMap[k]) itemMap[k] = { qty: 0, revenue: 0 };
      itemMap[k].qty     += item.qty;
      itemMap[k].revenue += item.subtotal;
    }
  }
  const extraMap: Record<string, { qty: number; revenue: number }> = {};
  for (const o of active) {
    for (const e of o.extras ?? []) {
      if (!extraMap[e.extra_name]) extraMap[e.extra_name] = { qty: 0, revenue: 0 };
      extraMap[e.extra_name].qty     += e.qty;
      extraMap[e.extra_name].revenue += e.subtotal;
    }
  }
  return {
    total_orders:        active.length,
    total_revenue:       cash_revenue + stripe_revenue + card_manual_revenue,
    cash_revenue, stripe_revenue, card_manual_revenue, delivery_fees,
    items_sold:  Object.entries(itemMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.qty - a.qty),
    extras_sold: Object.entries(extraMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.qty - a.qty),
    orders_snapshot: orders.map(o => ({
      id: o.id, customer_name: o.customer_name, total: o.total,
      payment_method: o.payment_method, payment_status: o.payment_status, status: o.status,
    })),
  };
}

function groupSessionsByDay(sessions: Session[]) {
  const map = new Map<string, {
    label: string; sessions: Session[];
    revenue: number; orders: number; cash: number; stripe: number; cardManual: number; fees: number;
    cashCount: number; stripeCount: number; cardManualCount: number;
  }>();
  for (const s of sessions) {
    if (!s.closed_at || !s.summary) continue;
    const key   = localDateKey(s.opened_at);
    const label = new Date(s.opened_at).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, { label, sessions: [], revenue: 0, orders: 0, cash: 0, stripe: 0, cardManual: 0, fees: 0, cashCount: 0, stripeCount: 0, cardManualCount: 0 });
    const day = map.get(key)!;
    day.sessions.push(s);
    day.revenue    += s.summary.total_revenue;
    day.orders     += s.summary.total_orders;
    day.cash       += s.summary.cash_revenue;
    day.stripe     += s.summary.stripe_revenue;
    day.cardManual += s.summary.card_manual_revenue ?? 0;
    day.fees       += s.summary.delivery_fees;
    for (const snap of s.summary.orders_snapshot ?? []) {
      if (snap.status === 'cancelled') continue;
      if (snap.payment_method === 'cash') day.cashCount++;
      else if (snap.payment_method === 'stripe') day.stripeCount++;
      else if (snap.payment_method === 'card_manual') day.cardManualCount++;
    }
  }
  return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([key, val]) => ({ key, ...val }));
}

// ─── Session Detail Modal ──────────────────────────────────────────────────

function SummaryView({ summary, session }: { summary: SessionSummary; session: Session }) {
  return (
    <div className="space-y-4">
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
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total órdenes',    value: String(summary.total_orders),     color: 'text-brand-ink'    },
          { label: 'Ingresos totales', value: fmtMoney(summary.total_revenue),  color: 'text-green-600'    },
          { label: '💵 Efectivo',       value: fmtMoney(summary.cash_revenue),  color: 'text-brand-orange' },
          { label: '💳 Stripe',         value: fmtMoney(summary.stripe_revenue), color: 'text-blue-600'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="surface-paper rounded-2xl p-4">
            <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
        {(summary.card_manual_revenue ?? 0) > 0 && (
          <div className="surface-paper rounded-2xl p-4 col-span-2">
            <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">💳 Terminal (POS)</p>
            <p className="text-2xl font-black text-indigo-600">{fmtMoney(summary.card_manual_revenue)}</p>
          </div>
        )}
        {summary.delivery_fees > 0 && (
          <div className="surface-paper rounded-2xl p-4 col-span-2">
            <p className="text-xs text-brand-muted uppercase tracking-[0.15em] mb-1">🛵 Envíos cobrados</p>
            <p className="text-xl font-black text-brand-ink">{fmtMoney(summary.delivery_fees)}</p>
          </div>
        )}
      </div>
      {summary.items_sold.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">🍗 Productos vendidos</p>
          <div className="space-y-2">
            {summary.items_sold.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-red text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">{item.qty}</span>
                  <span className="text-brand-ink text-sm">{item.name}</span>
                </div>
                <span className="text-brand-ink font-semibold text-sm">{fmtMoney(item.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {summary.extras_sold.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">➕ Extras vendidos</p>
          <div className="space-y-2">
            {summary.extras_sold.map((e, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-brand-orange text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">{e.qty}</span>
                  <span className="text-brand-ink text-sm">{e.name}</span>
                </div>
                <span className="text-brand-ink font-semibold text-sm">{fmtMoney(e.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {summary.orders_snapshot.length > 0 && (
        <div className="surface-paper rounded-2xl p-4">
          <p className="text-sm font-bold text-brand-ink mb-3">📋 Detalle de órdenes</p>
          <div className="space-y-1.5">
            {summary.orders_snapshot.map((o, i) => {
              const cancelled = o.status === 'cancelled';
              return (
                <div key={i} className={`flex justify-between items-center text-sm ${cancelled ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs text-brand-muted ${cancelled ? 'line-through' : ''}`}>#{o.id.slice(0, 6).toUpperCase()}</span>
                    <span className={`text-brand-ink ${cancelled ? 'line-through' : ''}`}>{o.customer_name}</span>
                    <span className="text-xs">{cancelled ? '❌' : o.payment_method === 'cash' ? '💵' : '💳'}</span>
                  </div>
                  <span className={`text-brand-ink font-bold ${cancelled ? 'line-through' : ''}`}>{fmtMoney(o.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ReportsTab({ allProducts, currentSession, sessionOrders, sessions }: Props) {
  const [range,           setRange]           = useState<Range>('week');
  const [orders,          setOrders]          = useState<Order[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [expandedDay,     setExpandedDay]     = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [csvLoading,      setCsvLoading]      = useState(false);
  const [customersPage,   setCustomersPage]   = useState(0);

  useEffect(() => {
    setLoading(true);
    setCustomersPage(0);
    const supabase = createClient();
    const since    = rangeStart(range);
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(2000);
    if (since) q = q.gte('created_at', since);
    q.then(({ data }) => { setOrders(data ?? []); setLoading(false); });
  }, [range]);

  // ─── Analytics ───────────────────────────────────────────────────────────

  const a = useMemo(() => {
    const completed = orders.filter(o => o.status !== 'cancelled');
    const cancelled = orders.filter(o => o.status === 'cancelled');

    const revenue       = completed.reduce((s, o) => s + o.total, 0);
    const avgTicket     = completed.length > 0 ? Math.round(revenue / completed.length) : 0;
    const cashOrders      = completed.filter(o => o.payment_method === 'cash');
    const stripeOrders    = completed.filter(o => o.payment_method === 'stripe');
    const cardManualOrders= completed.filter(o => o.payment_method === 'card_manual');
    const cashRev         = cashOrders.reduce((s, o) => s + o.total, 0);
    const stripeRev       = stripeOrders.reduce((s, o) => s + o.total, 0);
    const cardManualRev   = cardManualOrders.reduce((s, o) => s + o.total, 0);
    const cashCount       = cashOrders.length;
    const stripeCount     = stripeOrders.length;
    const cardManualCount = cardManualOrders.length;

    // Per-day breakdown by payment method
    const dayPayMap = new Map<string, { label: string; cash: number; stripe: number; cardManual: number; total: number }>();
    for (const o of completed) {
      const key = localDateKey(o.created_at);
      if (!dayPayMap.has(key)) {
        dayPayMap.set(key, {
          label: new Date(key + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
          cash: 0, stripe: 0, cardManual: 0, total: 0,
        });
      }
      const d = dayPayMap.get(key)!;
      d.total++;
      if (o.payment_method === 'cash') d.cash++;
      else if (o.payment_method === 'stripe') d.stripe++;
      else if (o.payment_method === 'card_manual') d.cardManual++;
    }
    const dayPayBreakdown = [...dayPayMap.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, v]) => ({ key, ...v }));
    const cancelLoss    = cancelled.reduce((s, o) => s + o.total, 0);
    const cancelRate = orders.length > 0 ? Math.round(cancelled.length / orders.length * 100) : 0;

    const pickupCount   = completed.filter(o => o.delivery_type === 'pickup').length;
    const deliveryCount = completed.filter(o => o.delivery_type === 'delivery').length;

    // Hour buckets (0–23 local time)
    const hourBuckets = Array(24).fill(0) as number[];
    for (const o of completed) hourBuckets[new Date(o.created_at).getHours()]++;
    const maxHour = Math.max(1, ...hourBuckets);

    // Trend bars
    let trendBars: { key: string; label: string; revenue: number }[] = [];
    if (range === 'week' || range === 'month') {
      const daysBack = range === 'week' ? 6 : 29;
      const dayMap   = new Map<string, number>();
      const now      = new Date();
      for (let i = daysBack; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayMap.set(localDateKey(d.toISOString()), 0);
      }
      for (const o of completed) {
        const k = localDateKey(o.created_at);
        if (dayMap.has(k)) dayMap.set(k, dayMap.get(k)! + o.total);
      }
      trendBars = [...dayMap.entries()].map(([key, rev]) => ({
        key,
        revenue: rev,
        label: new Date(key + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      }));
    } else if (range === 'total') {
      const monthMap = new Map<string, number>();
      for (const o of completed) {
        const k = localMonthKey(o.created_at);
        monthMap.set(k, (monthMap.get(k) ?? 0) + o.total);
      }
      trendBars = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, rev]) => {
        const [yr, mo] = key.split('-');
        return {
          key,
          revenue: rev,
          label: new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        };
      });
    }
    const maxTrendRev = Math.max(1, ...trendBars.map(b => b.revenue));

    // Products
    const prodMap = new Map<string, { qty: number; revenue: number }>();
    for (const o of completed) {
      for (const item of o.items ?? []) {
        const ex = prodMap.get(item.product_name) ?? { qty: 0, revenue: 0 };
        prodMap.set(item.product_name, { qty: ex.qty + item.qty, revenue: ex.revenue + item.subtotal });
      }
    }
    const topProducts = [...prodMap.entries()].map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue);

    const extraMap = new Map<string, { qty: number; revenue: number }>();
    for (const o of completed) {
      for (const e of o.extras ?? []) {
        const ex = extraMap.get(e.extra_name) ?? { qty: 0, revenue: 0 };
        extraMap.set(e.extra_name, { qty: ex.qty + e.qty, revenue: ex.revenue + e.subtotal });
      }
    }
    const topExtras = [...extraMap.entries()].map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue);

    const soldNames = new Set(topProducts.map(p => p.name));
    const deadProds = allProducts.filter(p => p.active && !soldNames.has(p.name));

    // Customers (deduplicated by phone)
    const custMap = new Map<string, { name: string; orders: number; total: number; lastDate: string }>();
    for (const o of completed) {
      const phone = o.customer_phone?.trim() ?? '';
      if (!phone) continue;
      const ex = custMap.get(phone);
      if (!ex) {
        custMap.set(phone, { name: o.customer_name, orders: 1, total: o.total, lastDate: o.created_at });
      } else {
        const newer = o.created_at > ex.lastDate;
        custMap.set(phone, {
          name:     newer ? o.customer_name : ex.name,
          orders:   ex.orders + 1,
          total:    ex.total + o.total,
          lastDate: newer ? o.created_at : ex.lastDate,
        });
      }
    }
    const topCustomers = [...custMap.entries()]
      .map(([phone, d]) => ({ phone, ...d }))
      .sort((a, b) => b.total - a.total);

    // Weekly cutoff (current Mon–Sun)
    const now2   = new Date();
    const monday = new Date(now2);
    monday.setDate(now2.getDate() + (now2.getDay() === 0 ? -6 : 1 - now2.getDay()));
    monday.setHours(0, 0, 0, 0);
    const weeklyOrds = completed.filter(o => new Date(o.created_at) >= monday);

    return {
      revenue, avgTicket,
      orderCount: completed.length, cancelCount: cancelled.length, cancelRate, cancelLoss,
      cashRev, stripeRev, cardManualRev,
      cashCount, stripeCount, cardManualCount,
      dayPayBreakdown,
      cashPct:    revenue > 0 ? Math.round(cashRev / revenue * 100) : 50,
      pickupCount, deliveryCount,
      pickupPct:  (pickupCount + deliveryCount) > 0 ? Math.round(pickupCount / (pickupCount + deliveryCount) * 100) : 50,
      hourBuckets, maxHour,
      trendBars, maxTrendRev,
      topProducts, topExtras, deadProds, topCustomers,
      weeklyOrders:  weeklyOrds.length,
      weeklyRevenue: weeklyOrds.reduce((s, o) => s + o.total, 0),
    };
  }, [orders, allProducts, range]);

  async function downloadCsv() {
    setCsvLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const rows     = data ?? [];
    const cell     = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header   = ['ID','Fecha','Cliente','Telefono','Entrega','Metodo_Pago','Estado_Pago','Estado','Subtotal','Envio','Total','Items','Notas'];
    const lines    = rows.map(o => [
      o.id.slice(0, 6).toUpperCase(), o.created_at, o.customer_name, o.customer_phone,
      o.delivery_type, o.payment_method, o.payment_status, o.status,
      o.subtotal, o.delivery_fee, o.total,
      (o.items ?? []).map((i: CartItem) => `${i.qty}x ${i.product_name} (${i.variant_name})`).join(' | '),
      o.notes ?? '',
    ].map(cell).join(','));
    const csv  = '﻿' + [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const anchor      = document.createElement('a');
    anchor.href       = url;
    anchor.download   = `bitacora-crispy-charles-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCsvLoading(false);
  }

  const dayGroups = useMemo(() => groupSessionsByDay(sessions), [sessions]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Session detail modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 flex items-start justify-center p-4 overflow-y-auto">
          <div className="surface-paper rounded-3xl w-full max-w-lg my-6 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-5xl text-brand-ink leading-none">Reporte de sesión</h2>
              <button onClick={() => setSelectedSession(null)} className="text-brand-muted hover:text-brand-ink text-2xl leading-none">×</button>
            </div>
            {selectedSession.summary
              ? <SummaryView summary={selectedSession.summary} session={selectedSession} />
              : (
                <div>
                  <p className="text-center text-brand-muted text-sm mb-4">Sesión activa — vista previa en tiempo real</p>
                  <SummaryView summary={buildSummary(sessionOrders)} session={selectedSession} />
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month', 'total'] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${range === r ? 'bg-brand-red text-white' : 'bg-white border border-brand-line text-brand-muted hover:text-brand-ink'}`}
          >
            {r === 'today' ? 'Hoy' : r === 'week' ? 'Semana' : r === 'month' ? 'Mes' : 'Total'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-brand-muted">
          <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Cargando analytics...</p>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">Revenue total</p>
              <p className="text-3xl font-black text-green-600">{fmtMoney(a.revenue)}</p>
            </div>
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">Ticket promedio</p>
              <p className="text-3xl font-black text-brand-ink">{fmtMoney(a.avgTicket)}</p>
              {a.orderCount > 0 && <p className="text-[10px] text-brand-muted mt-0.5">{a.orderCount} órdenes</p>}
            </div>
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">💵 Efectivo</p>
              <p className="text-2xl font-black text-brand-orange">{fmtMoney(a.cashRev)}</p>
              <p className="text-[10px] text-brand-muted mt-0.5">{a.cashCount} {a.cashCount === 1 ? 'orden' : 'órdenes'} · {a.cashPct}%</p>
            </div>
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">💳 Stripe</p>
              <p className="text-2xl font-black text-blue-600">{fmtMoney(a.stripeRev)}</p>
              <p className="text-[10px] text-brand-muted mt-0.5">{a.stripeCount} {a.stripeCount === 1 ? 'orden' : 'órdenes'}</p>
            </div>
            {a.cardManualRev > 0 && (
              <div className="surface-paper rounded-2xl p-4 col-span-2">
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">💳 Terminal (POS)</p>
                <p className="text-2xl font-black text-indigo-600">{fmtMoney(a.cardManualRev)}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{a.cardManualCount} {a.cardManualCount === 1 ? 'orden' : 'órdenes'}</p>
              </div>
            )}
          </div>

          {/* ── Órdenes por método por día ── */}
          {a.dayPayBreakdown.length > 0 && (
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-3">Órdenes por método de pago · por día</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-brand-muted text-left">
                      <th className="pb-2 font-semibold">Fecha</th>
                      <th className="pb-2 font-semibold text-right text-brand-orange">Efectivo</th>
                      <th className="pb-2 font-semibold text-right text-blue-600">Stripe</th>
                      <th className="pb-2 font-semibold text-right text-indigo-600">Terminal</th>
                      <th className="pb-2 font-semibold text-right text-brand-ink">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-line">
                    {a.dayPayBreakdown.map(d => (
                      <tr key={d.key}>
                        <td className="py-2 text-brand-ink capitalize">{d.label}</td>
                        <td className="py-2 text-right font-semibold text-brand-orange">{d.cash > 0 ? d.cash : '—'}</td>
                        <td className="py-2 text-right font-semibold text-blue-600">{d.stripe > 0 ? d.stripe : '—'}</td>
                        <td className="py-2 text-right font-semibold text-indigo-600">{d.cardManual > 0 ? d.cardManual : '—'}</td>
                        <td className="py-2 text-right font-black text-brand-ink">{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Cancellations + Delivery split ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-1">Pérdida cancelaciones</p>
              <p className={`text-2xl font-black ${a.cancelLoss > 0 ? 'text-red-500' : 'text-brand-muted'}`}>
                {fmtMoney(a.cancelLoss)}
              </p>
              {a.cancelCount > 0
                ? <p className="text-[10px] text-red-400 mt-0.5">{a.cancelCount} ords · {a.cancelRate}%</p>
                : <p className="text-[10px] text-green-600 mt-0.5">Sin cancelaciones 🎉</p>}
            </div>
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-2">Tipo de entrega</p>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-brand-ink">🏪 {a.pickupPct}%</span>
                <span className="font-semibold text-purple-600">🛵 {100 - a.pickupPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-brand-line overflow-hidden flex">
                <div className="h-full bg-brand-red transition-all" style={{ width: `${a.pickupPct}%` }} />
                <div className="h-full bg-purple-400 flex-1" />
              </div>
              <div className="flex justify-between text-[9px] text-brand-muted mt-1">
                <span>{a.pickupCount} pickup</span>
                <span>{a.deliveryCount} domicilio</span>
              </div>
            </div>
          </div>

          {/* ── Revenue trend ── */}
          {a.trendBars.length > 1 && (() => {
            const trendConfig: ChartConfig = {
              revenue: { label: 'Revenue', color: 'var(--chart-1)' },
            };
            return (
              <div className="surface-paper rounded-2xl p-4">
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-3">
                  {range === 'total' ? 'Revenue por mes' : 'Tendencia de ingresos'}
                </p>
                <ChartContainer config={trendConfig} className="h-[140px] w-full">
                  <BarChart data={a.trendBars} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9, fill: '#8c7b65' }}
                      interval={a.trendBars.length <= 7 ? 0 : Math.floor(a.trendBars.length / 6)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 9, fill: '#8c7b65' }}
                      tickFormatter={v => `$${(v as number).toLocaleString('es-MX')}`}
                      width={56}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(246,241,232,0.8)' }}
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-semibold text-[#171717]">
                              {fmtMoney(value as number)}
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            );
          })()}

          {/* ── Horas pico ── */}
          {(() => {
            const hourData = a.hourBuckets.map((orders, h) => ({
              hour: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
              orders,
              intensity: a.maxHour > 0 ? orders / a.maxHour : 0,
            }));
            const hourConfig: ChartConfig = {
              orders: { label: 'Órdenes', color: 'var(--chart-1)' },
            };
            return (
              <div className="surface-paper rounded-2xl p-4">
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-3">Horas pico</p>
                {a.orderCount === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-4">Sin datos para este periodo</p>
                ) : (
                  <ChartContainer config={hourConfig} className="h-[110px] w-full">
                    <BarChart data={hourData} margin={{ top: 4, right: 0, left: -32, bottom: 0 }} barCategoryGap="10%">
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 8, fill: '#8c7b65' }}
                        interval={5}
                      />
                      <YAxis hide />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(246,241,232,0.8)' }}
                        content={
                          <ChartTooltipContent
                            formatter={(value) => (
                              <span className="font-mono font-semibold text-[#171717]">
                                {value as number} {(value as number) === 1 ? 'orden' : 'órdenes'}
                              </span>
                            )}
                          />
                        }
                      />
                      <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                        {hourData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.intensity === 0
                              ? '#e8d8c6'
                              : `rgba(230,50,50,${0.15 + entry.intensity * 0.85})`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </div>
            );
          })()}

          {/* ── Corte semanal ── */}
          <div className="surface-paper rounded-2xl p-4 border-l-4 border-brand-orange">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-0.5">Corte semanal</p>
                <p className="text-xs text-brand-muted">Lun – Dom · semana en curso</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-brand-orange">{fmtMoney(a.weeklyRevenue)}</p>
                <p className="text-xs text-brand-muted">{a.weeklyOrders} {a.weeklyOrders === 1 ? 'orden' : 'órdenes'}</p>
              </div>
            </div>
          </div>

          {/* ── Top productos ── */}
          {a.topProducts.length > 0 && (
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-4">Top productos</p>
              <div className="space-y-3">
                {a.topProducts.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-brand-muted w-4 text-right flex-shrink-0">{i + 1}</span>
                        <span className="text-sm font-medium text-brand-ink truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-brand-muted">{p.qty} uds</span>
                        <span className="text-xs font-bold text-brand-ink w-16 text-right">{fmtMoney(p.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-brand-line ml-6 overflow-hidden">
                      <div className="h-full bg-brand-red rounded-full" style={{ width: `${(p.revenue / a.topProducts[0].revenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top extras ── */}
          {a.topExtras.length > 0 && (
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-4">Top extras</p>
              <div className="space-y-3">
                {a.topExtras.map((e, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-black text-brand-muted w-4 text-right flex-shrink-0">{i + 1}</span>
                        <span className="text-sm font-medium text-brand-ink truncate">{e.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-brand-muted">{e.qty} uds</span>
                        <span className="text-xs font-bold text-brand-ink w-16 text-right">{fmtMoney(e.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-brand-line ml-6 overflow-hidden">
                      <div className="h-full bg-brand-orange rounded-full" style={{ width: `${(e.revenue / a.topExtras[0].revenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Productos sin ventas ── */}
          {a.deadProds.length > 0 && (
            <div className="surface-paper rounded-2xl p-4">
              <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mb-0.5">Productos sin ventas</p>
              <p className="text-[10px] text-brand-muted mb-3">Activos en el menú, sin órdenes en este periodo</p>
              <div className="flex flex-wrap gap-2">
                {a.deadProds.map((p, i) => (
                  <span key={i} className="text-xs bg-brand-paper border border-brand-line rounded-full px-3 py-1 text-brand-muted">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Top clientes ── */}
          {a.topCustomers.length > 0 && (() => {
            const PAGE_SIZE  = 10;
            const totalPages = Math.ceil(a.topCustomers.length / PAGE_SIZE);
            const pageItems  = a.topCustomers.slice(customersPage * PAGE_SIZE, (customersPage + 1) * PAGE_SIZE);
            return (
              <div className="surface-paper rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em]">
                    Clientes frecuentes · {a.topCustomers.length} en total
                  </p>
                </div>
                <div className="space-y-3">
                  {pageItems.map((c, i) => {
                    const globalIdx = customersPage * PAGE_SIZE + i;
                    return (
                      <div key={c.phone} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          globalIdx === 0 ? 'bg-yellow-100' : globalIdx === 1 ? 'bg-gray-100' : globalIdx === 2 ? 'bg-orange-100' : 'bg-brand-paper border border-brand-line'
                        }`}>
                          {globalIdx === 0 ? '🥇' : globalIdx === 1 ? '🥈' : globalIdx === 2 ? '🥉'
                            : <span className="text-[10px] font-black text-brand-muted">{globalIdx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-ink truncate">{c.name}</p>
                          <p className="text-[10px] text-brand-muted">{c.phone} · {c.orders} {c.orders === 1 ? 'orden' : 'órdenes'}</p>
                        </div>
                        <p className="font-black text-brand-ink text-sm flex-shrink-0">{fmtMoney(c.total)}</p>
                      </div>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-line">
                    <button
                      onClick={() => setCustomersPage(p => p - 1)}
                      disabled={customersPage === 0}
                      className="px-3 py-1.5 rounded-xl border border-brand-line text-sm font-semibold text-brand-muted hover:text-brand-ink disabled:opacity-30 transition-colors"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs text-brand-muted">
                      {customersPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCustomersPage(p => p + 1)}
                      disabled={customersPage >= totalPages - 1}
                      className="px-3 py-1.5 rounded-xl border border-brand-line text-sm font-semibold text-brand-muted hover:text-brand-ink disabled:opacity-30 transition-colors"
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* ── Historial header + CSV ── */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="font-display text-5xl text-brand-ink leading-none">Historial</h2>
        <button onClick={downloadCsv} disabled={csvLoading}
          className="text-xs px-3 py-2 rounded-xl border border-brand-line bg-white hover:bg-brand-paper text-brand-muted font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {csvLoading ? 'Generando...' : <><span>📥</span> Exportar CSV</>}
        </button>
      </div>

      {/* ── Live session ── */}
      {currentSession && (() => {
        const live = buildSummary(sessionOrders);
        return (
          <div className="rounded-2xl overflow-hidden border border-green-200 bg-green-50">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                <div>
                  <p className="font-black text-green-700 leading-none">Turno en curso</p>
                  <p className="text-xs text-green-600/80 mt-0.5">Desde {fmtTime(currentSession.opened_at)} · {duration(currentSession.opened_at, null)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSession(currentSession)}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                Detalle →
              </button>
            </div>
            <div className={`grid gap-px bg-green-200 border-t border-green-200 ${(live.card_manual_revenue ?? 0) > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {[
                { label: 'Órdenes',     value: String(live.total_orders),                         color: 'text-brand-ink'    },
                { label: 'Total',       value: fmtMoney(live.total_revenue),                      color: 'text-green-700'    },
                { label: '💵 Efectivo', value: fmtMoney(live.cash_revenue),                       color: 'text-brand-orange' },
                { label: '💳 Stripe',   value: fmtMoney(live.stripe_revenue),                     color: 'text-blue-600'     },
                ...((live.card_manual_revenue ?? 0) > 0 ? [{ label: '💳 Terminal', value: fmtMoney(live.card_manual_revenue), color: 'text-indigo-600' }] : []),
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/80 px-3 py-3 text-center">
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-[10px] text-brand-muted uppercase tracking-[0.15em] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Empty state ── */}
      {dayGroups.length === 0 && !currentSession && (
        <div className="text-center py-16 text-brand-muted">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold text-brand-ink">Sin reportes aún</p>
          <p className="text-sm mt-1">Se generan al cerrar el negocio</p>
        </div>
      )}

      {/* ── Day groups ── */}
      <div className="space-y-3">
        {dayGroups.map(day => {
          const isOpen   = expandedDay === day.key;
          const total    = day.cash + day.stripe;
          const cashPct  = total > 0 ? Math.round(day.cash / total * 100) : 50;
          return (
            <div key={day.key} className="surface-paper rounded-2xl overflow-hidden">
              <button onClick={() => setExpandedDay(isOpen ? null : day.key)}
                className="w-full px-5 pt-4 pb-4 text-left hover:bg-brand-paper/40 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted mb-0.5">
                      {day.sessions.length} {day.sessions.length === 1 ? 'turno' : 'turnos'}
                    </p>
                    <p className="font-bold text-brand-ink text-base capitalize">{day.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-green-600">{fmtMoney(day.revenue)}</p>
                    <p className="text-xs text-brand-muted">{day.orders} {day.orders === 1 ? 'orden' : 'órdenes'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs mb-2.5 flex-wrap">
                  <span className="font-semibold text-brand-orange">💵 {fmtMoney(day.cash)} <span className="font-normal text-brand-muted">({day.cashCount})</span></span>
                  <span className="font-semibold text-blue-600">💳 {fmtMoney(day.stripe)} <span className="font-normal text-brand-muted">({day.stripeCount})</span></span>
                  {day.cardManual > 0 && <span className="font-semibold text-indigo-600">Terminal {fmtMoney(day.cardManual)} <span className="font-normal text-brand-muted">({day.cardManualCount})</span></span>}
                  {day.fees > 0 && <span className="text-brand-muted">🛵 {fmtMoney(day.fees)}</span>}
                  <span className="ml-auto text-brand-muted font-medium text-xs">{isOpen ? '▲ Ocultar' : '▼ Ver turnos'}</span>
                </div>
                <div className="h-1.5 rounded-full bg-brand-line overflow-hidden flex">
                  <div className="h-full bg-brand-orange transition-all" style={{ width: `${cashPct}%` }} />
                  <div className="h-full bg-blue-400 flex-1" />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-brand-line">
                  {day.sessions.map((session, i) => {
                    const s      = session.summary!;
                    const sTotal = s.cash_revenue + s.stripe_revenue;
                    const sCashPct = sTotal > 0 ? Math.round(s.cash_revenue / sTotal * 100) : 50;
                    return (
                      <button key={session.id} onClick={() => setSelectedSession(session)}
                        className={`w-full px-5 py-4 text-left hover:bg-brand-paper/50 transition-colors flex items-center justify-between gap-4 ${i > 0 ? 'border-t border-brand-line' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-brand-ink">
                            Turno {fmtTime(session.opened_at)} – {fmtTime(session.closed_at!)}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-brand-muted">⏱ {duration(session.opened_at, session.closed_at)}</span>
                            <span className="text-[10px] text-brand-muted">·</span>
                            <span className="text-[10px] text-brand-muted">{s.total_orders} {s.total_orders === 1 ? 'orden' : 'órdenes'}</span>
                            <span className="text-[10px] text-brand-orange">💵 {fmtMoney(s.cash_revenue)}</span>
                            <span className="text-[10px] text-blue-600">💳 {fmtMoney(s.stripe_revenue)}</span>
                            {(s.card_manual_revenue ?? 0) > 0 && <span className="text-[10px] text-indigo-600">💳T {fmtMoney(s.card_manual_revenue)}</span>}
                          </div>
                          <div className="h-1 rounded-full bg-brand-line overflow-hidden flex mt-2 w-24">
                            <div className="h-full bg-brand-orange" style={{ width: `${sCashPct}%` }} />
                            <div className="h-full bg-blue-400 flex-1" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="font-black text-brand-ink">{fmtMoney(s.total_revenue)}</p>
                          <span className="text-brand-muted text-xs">→</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
